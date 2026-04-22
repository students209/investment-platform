/**
 * Factor Iterate API Route
 * Full multi-stage pipeline:
 *   Stage 1: evolve_factors.py (Gemini → generate new factor code)
 *   Stage 2: iterative_backtest.py (run backtest on base + new factors)
 *   Auto-Evolve: repeat up to maxRounds (default 3)
 */
import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const ITERATE_DIR = '/Users/alpha/.openclaw/workspace-quant_engineer/skills/因子回测迭代'
const ALPHA_PY_DIR = '/Users/alpha/.openclaw/workspace-quant_engineer/skills/文章转因子'

// In-memory task store
const tasks: Record<string, {
  status: 'running' | 'done' | 'error'
  factors: string[]
  results: any
  logs: string[]
  error?: string
  startTime: number
  outputDir: string
}> = {}

function generateTaskId(): string {
  return `iter_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// Helper: run a python script and collect its output
function runPython(script: string, args: string[], cwd: string, env: Record<string, string>): Promise<{ code: number, stdout: string, stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn('python3', [script, ...args], { cwd, env: { ...process.env, ...env } as any })
    let stdout = '', stderr = ''
    proc.stdout.on('data', (d) => { stdout += d.toString() })
    proc.stderr.on('data', (d) => { stderr += d.toString() })
    proc.on('close', (code) => resolve({ code: code || 0, stdout, stderr }))
    proc.on('error', (err) => resolve({ code: 1, stdout, stderr: err.message }))
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { factors, rounds = 1, params = {}, model = 'gemini-2.5-flash', customPrompt = '' } = body

    if (!factors || !Array.isArray(factors) || factors.length === 0) {
      return NextResponse.json({ success: false, error: '请选择至少一个因子' })
    }

    const baseFactor = factors[0].replace(/[^a-zA-Z0-9_]/g, '')
    if (!baseFactor) {
      return NextResponse.json({ success: false, error: '因子名称无效' })
    }

    const geminiKey = process.env.GEMINI_API_KEY || ''
    if (!geminiKey) {
      return NextResponse.json({ success: false, error: '未配置 GEMINI_API_KEY，因子迭代需要 Gemini API 支持' })
    }

    let rootFactor = baseFactor
    const matchMatch = baseFactor.match(/^(alpha_\d+)/)
    if (matchMatch) {
      rootFactor = matchMatch[1]
    }

    const maxRounds = Math.min(rounds, 3) // Hard cap at 3 generations
    const taskId = generateTaskId()
    const outputDir = path.join(ITERATE_DIR, rootFactor)

    tasks[taskId] = {
      status: 'running',
      factors: [baseFactor],
      results: null,
      logs: [],
      startTime: Date.now(),
      outputDir,
    }

    // Run the multi-stage pipeline in background
    ;(async () => {
      const log = (msg: string) => {
        // Sanitize: mask API key in any log output
        let sanitized = msg
        if (geminiKey && geminiKey.length > 8) {
          const masked = geminiKey.slice(0, 4) + '****' + geminiKey.slice(-4)
          sanitized = sanitized.replaceAll(geminiKey, masked)
        }
        tasks[taskId].logs.push(sanitized + '\n')
      }

      try {
        // Ensure output directory exists
        fs.mkdirSync(outputDir, { recursive: true })

        let currentFactor = baseFactor
        const allNewFactors: string[] = []

        for (let round = 1; round <= maxRounds; round++) {
          log(`\n${'='.repeat(60)}`)
          log(`🧬 第 ${round}/${maxRounds} 轮因子进化`)
          log(`   当前母本因子: ${currentFactor}`)
          log(`${'='.repeat(60)}\n`)

          // ---- Stage 1: Evolve (Gemini generates new factor code) ----
          log('📖 Stage 1: 调用 Gemini 生成改进版因子...')

          const evolveArgs = [
            '--factor_name', currentFactor,
            '--api_key', geminiKey,
            '--round', round.toString(),
            '--output_dir', outputDir,
            '--model', model,
          ]
          if (customPrompt) {
            evolveArgs.push('--custom_prompt', customPrompt)
          }

          const evolveResult = await runPython(
            'evolve_factors.py',
            evolveArgs,
            ITERATE_DIR,
            { PYTHONPATH: `${ALPHA_PY_DIR}:${process.env.PYTHONPATH || ''}` }
          )

          // Stream evolve output to logs
          const evolveOutput = evolveResult.stdout + evolveResult.stderr
          log(evolveOutput)

          if (evolveResult.code !== 0) {
            log(`❌ Stage 1 失败 (exit code: ${evolveResult.code})`)
            tasks[taskId].status = 'error'
            tasks[taskId].error = `进化脚本执行失败`
            return
          }

          // Parse new factor names from EVOLVE_RESULT_START/END
          let evolveData: any = null
          const evolveMatch = evolveOutput.match(/EVOLVE_RESULT_START\n([\s\S]*?)\nEVOLVE_RESULT_END/)
          if (evolveMatch) {
            try {
              evolveData = JSON.parse(evolveMatch[1])
            } catch (e) {
              log(`⚠️ 进化结果解析失败: ${e}`)
            }
          }

          if (!evolveData || !evolveData.synced_names || evolveData.synced_names.length === 0) {
            log('⚠️ 未生成有效的新因子，终止进化')
            break
          }

          const newFactorNames = evolveData.synced_names
          allNewFactors.push(...newFactorNames)
          log(`\n✅ Stage 1 完成: 生成了 ${newFactorNames.length} 个新因子`)
          newFactorNames.forEach((n: string) => log(`   → ${n}`))

          // Build improvement reasons map for tracking
          const reasonsMap: Record<string, string> = {}
          for (const nf of evolveData.new_factors || []) {
            reasonsMap[nf.name] = nf.logic_summary || nf.improvement_reason || '自动进化'
          }

          // ---- Stage 2: Backtest (run all factors including base) ----
          log(`\n📊 Stage 2: 运行快速回测 (原因子 + ${newFactorNames.length} 个新因子)...`)

          const backtestFactors = [currentFactor, ...newFactorNames]
          const backtestArgs = [
            'iterative_backtest.py',
            '--factors', ...backtestFactors,
            '--start_date', params.startDate || '2022-01-01',
            '--end_date', params.endDate || '2024-12-31',
            '--benchmark', params.benchmark || '中证500',
            '--group_num', (params.groupNum || 10).toString(),
            '--neutralize', params.neutralize ? '1' : '0',
            '--record',
            '--output_dir', outputDir,
            '--base_factor', currentFactor,
            '--improvement_reasons', JSON.stringify(reasonsMap),
          ]

          // Use spawn for live streaming
          await new Promise<void>((resolve) => {
            const proc = spawn('python3', backtestArgs, {
              cwd: ITERATE_DIR,
              env: { ...process.env, PYTHONPATH: `${ALPHA_PY_DIR}:${process.env.PYTHONPATH || ''}` } as any,
            })

            proc.stdout.on('data', (data) => {
              tasks[taskId].logs.push(data.toString().replace(/\r/g, '\n'))
            })
            proc.stderr.on('data', (data) => {
              tasks[taskId].logs.push(data.toString().replace(/\r/g, '\n'))
            })
            proc.on('close', () => resolve())
            proc.on('error', (err) => {
              log(`回测进程错误: ${err.message}`)
              resolve()
            })
          })

          log(`\n✅ Stage 2 完成: 第 ${round} 轮回测已完成`)

          // ---- Auto-Evolve: Pick best factor for next round ----
          if (round < maxRounds) {
            log('\n🔍 分析结果，选择最佳母本进入下一轮...')

            // Re-read tracking to find best sharpe
            const trackingPath = path.join(outputDir, 'iteration_tracking.md')
            if (fs.existsSync(trackingPath)) {
              const tracking = fs.readFileSync(trackingPath, 'utf-8')
              const lines = tracking.split('\n').filter(l => l.startsWith('|') && !l.includes(':---'))
              
              let bestFactor = currentFactor
              let bestSharpe = -Infinity

              for (const line of lines) {
                const cells = line.split('|').map(c => c.trim()).filter(Boolean)
                if (cells.length >= 8) {
                  const iterFactor = cells[2]
                  const sharpeStr = cells[7] // "old vs new"
                  const newSharpe = parseFloat(sharpeStr.split('vs').pop()?.trim() || '0')
                  if (!isNaN(newSharpe) && newSharpe > bestSharpe) {
                    bestSharpe = newSharpe
                    bestFactor = iterFactor
                  }
                }
              }

              if (bestFactor !== currentFactor) {
                log(`   🏆 最佳因子: ${bestFactor} (夏普: ${bestSharpe.toFixed(2)})`)
                currentFactor = bestFactor
              } else {
                log('   ⚠️ 未找到比当前母本更好的因子，终止进化')
                break
              }
            }
          }
        }

        // ---- Done: Collect results ----
        log(`\n${'='.repeat(60)}`)
        log(`🎉 因子进化完成！共 ${allNewFactors.length} 个新因子`)
        log(`${'='.repeat(60)}`)

        // Read final tracking table
        let trackingContent = ''
        const trackingPath = path.join(outputDir, 'iteration_tracking.md')
        if (fs.existsSync(trackingPath)) {
          trackingContent = fs.readFileSync(trackingPath, 'utf-8')
        }

        // Read board HTML if available
        let boardHtml = ''
        const boardPath = path.join(outputDir, '因子进化血统看板.html')
        if (fs.existsSync(boardPath)) {
          boardHtml = fs.readFileSync(boardPath, 'utf-8')
        }

        // Parse JSON_RESULTS from the last backtest output
        const allLogs = tasks[taskId].logs.join('')
        let metrics: any = null
        const jsonMatch = allLogs.match(/JSON_RESULTS_START\n([\s\S]*?)\nJSON_RESULTS_END/)
        if (jsonMatch) {
          try { metrics = JSON.parse(jsonMatch[1]) } catch {}
        }

        tasks[taskId].results = {
          metrics,
          tracking: trackingContent,
          boardHtml,
          newFactors: allNewFactors,
        }
        tasks[taskId].status = 'done'

      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e)
        tasks[taskId].logs.push(`\n❌ Pipeline 异常: ${errMsg}\n`)
        tasks[taskId].status = 'error'
        tasks[taskId].error = errMsg
      }
    })()

    return NextResponse.json({
      success: true,
      data: { taskId, factors: [baseFactor], rounds: maxRounds, message: '因子进化任务已启动' }
    })
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ success: false, error: `服务器错误：${errMsg}` })
  }
}

// GET: Check iteration task status / read per-factor tracking
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('taskId')
  const factorName = searchParams.get('factorName')

  // Get per-factor tracking data
  if (factorName) {
    let rootFactor = factorName
    const matchMatch = factorName.match(/^(alpha_\d+)/)
    if (matchMatch) {
      rootFactor = matchMatch[1]
    }
    const factorDir = path.join(ITERATE_DIR, rootFactor)

    // Run consolidation script to merge all pedigree data sources
    try {
      const consolidateResult = await runPython(
        'consolidate_pedigree.py',
        ['--root_factor', rootFactor],
        ITERATE_DIR,
        { PYTHONPATH: `${ITERATE_DIR}:${process.env.PYTHONPATH || ''}` }
      )
      if (consolidateResult.code !== 0) {
        console.warn(`Pedigree consolidation warning: ${consolidateResult.stderr.slice(0, 200)}`)
      }
    } catch (e) {
      console.warn(`Pedigree consolidation failed: ${e}`)
    }

    let trackingContent = ''
    let boardHtml = ''

    const trackingPath = path.join(factorDir, 'iteration_tracking.md')
    if (fs.existsSync(trackingPath)) {
      trackingContent = fs.readFileSync(trackingPath, 'utf-8')
    }

    const boardPath = path.join(factorDir, '因子进化血统看板.html')
    if (fs.existsSync(boardPath)) {
      boardHtml = fs.readFileSync(boardPath, 'utf-8')
    }

    return NextResponse.json({
      success: true,
      data: {
        tracking: trackingContent,
        boardHtml,
        hasData: trackingContent.length > 0,
      }
    })
  }

  // Get task status if taskId is provided
  if (taskId) {
    if (!tasks[taskId]) {
      return NextResponse.json({ success: false, error: '任务不存在' })
    }

    const task = tasks[taskId]
    return NextResponse.json({
      success: true,
      data: {
        status: task.status,
        factors: task.factors,
        results: task.results,
        logs: task.logs,
        error: task.error,
        elapsed: Math.round((Date.now() - task.startTime) / 1000),
      }
    })
  }

  // Get general listing if no taskId or factorName
  // List all factor directories that have iteration data
    const iteratedFactors: string[] = []
    if (fs.existsSync(ITERATE_DIR)) {
      const entries = fs.readdirSync(ITERATE_DIR, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const trackingPath = path.join(ITERATE_DIR, entry.name, 'iteration_tracking.md')
          if (fs.existsSync(trackingPath)) {
            iteratedFactors.push(entry.name)
          }
        }
      }
    }
  return NextResponse.json({
    success: true,
    data: { iteratedFactors }
  })
}
