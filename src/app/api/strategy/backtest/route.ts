/**
 * Strategy Backtest API Route
 * POST: Start a backtest task
 * GET: Query task status / list strategies / get report / get trades
 */
import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { GoogleGenAI } from '@google/genai'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''

const SKILL_DIR = '/Users/alpha/.openclaw/workspace-quant_engineer/skills/策略回测报告'
const FACTOR_SKILL_DIR = '/Users/alpha/.openclaw/workspace-quant_engineer/skills/文章转因子'

// In-memory task store (shared via globalThis for SSE stream access)
type TaskStatus = 'running' | 'done' | 'error'
interface Task {
  id: string
  factorName: string
  status: TaskStatus
  logs: string[]
  startedAt: number
  finishedAt?: number
  error?: string
  params: Record<string, any>
}

const g = globalThis as any
if (!g.__backtestTasks) g.__backtestTasks = new Map<string, Task>()
const tasks: Map<string, Task> = g.__backtestTasks

function generateId() {
  return `bt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      factorName,
      startDate = '2022-01-01',
      endDate = '2024-12-31',
      holdCount = 5,
      rebalanceDays = 5,
      model = 'gemini-3.1-flash-lite-preview',
    } = body

    if (!factorName) {
      return NextResponse.json({ success: false, error: '缺少因子名称' }, { status: 400 })
    }

    const taskId = generateId()
    const task: Task = {
      id: taskId,
      factorName,
      status: 'running',
      logs: [],
      startedAt: Date.now(),
      params: { startDate, endDate, holdCount, rebalanceDays, model },
    }
    tasks.set(taskId, task)

    const TARGET_DIR = path.join(SKILL_DIR, 'strategy', factorName)
    if (!fs.existsSync(TARGET_DIR)) {
      fs.mkdirSync(TARGET_DIR, { recursive: true })
    }

    // Create a wrapper script that overrides CONFIG and runs the backtest
    const wrapperCode = `
import sys, os
os.chdir(${JSON.stringify(TARGET_DIR)})
sys.path.insert(0, ${JSON.stringify(SKILL_DIR)})

# Patch CONFIG before importing
import run_integrated_backtest as rib
rib.CONFIG['factor_name'] = ${JSON.stringify(factorName)}
rib.CONFIG['start_date'] = ${JSON.stringify(startDate)}
rib.CONFIG['end_date'] = ${JSON.stringify(endDate)}
rib.CONFIG['hold_count'] = ${holdCount}
rib.CONFIG['rebalance_days'] = ${rebalanceDays}

# Reset caches
rib.StrategyAnalysis.LOCAL_DATA_CACHE = {}
rib.StrategyAnalysis.PRICE_CACHE = {}
import glob
for f in ["price_cache.json", "sector_cache.csv"]:
    fp = os.path.join(${JSON.stringify(SKILL_DIR)}, f)
    if os.path.exists(fp):
        os.remove(fp)

# Run backtest
rib.run_backtest_logic()
# Run analysis
rib.run_analysis_main()
print("===BACKTEST_COMPLETE===")
`
    const wrapperPath = path.join(TARGET_DIR, `_wrapper_${taskId}.py`)
    fs.writeFileSync(wrapperPath, wrapperCode, 'utf-8')

    // Spawn the backtest process
    const env = { ...process.env, PYTHONPATH: FACTOR_SKILL_DIR }
    const proc = spawn('python3', [wrapperPath], {
      cwd: TARGET_DIR,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    proc.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(l => l.trim())
      lines.forEach(line => task.logs.push(line))
    })

    proc.stderr.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(l => l.trim())
      lines.forEach(line => task.logs.push(`[stderr] ${line}`))
    })

    proc.on('close', async (code) => {
      // Clean up wrapper
      try { fs.unlinkSync(wrapperPath) } catch {}

      if (code === 0) {
        // Generate AI Analysis Markdown
        try {
          task.logs.push('[系统] 正在调用 AI 生成策略诊断分析报告...')
          if (GEMINI_API_KEY) {
            const tradePath = path.join(TARGET_DIR, 'trade_loss_rank.csv')
            const basicDataPath = path.join(TARGET_DIR, 'basic_data.csv')
            const kpiPath = path.join(TARGET_DIR, 'kpi.json')
            if (fs.existsSync(basicDataPath) || fs.existsSync(tradePath)) {
               let reqData = `回测设定的完整区间视角: ${startDate} 至 ${endDate}\n`
               if (fs.existsSync(kpiPath)) {
                   const kpiData = fs.readFileSync(kpiPath, 'utf-8')
                   reqData += `\n【核心汇总指标 (KPI)】:\n${kpiData}\n`
               }
               if (fs.existsSync(tradePath)) {
                   const tradeRows = fs.readFileSync(tradePath, 'utf-8').split('\n').filter(l => l.trim())
                   reqData += `\n交易明细(包含历史最大亏损和盈利采样):\n`
                   reqData += tradeRows.slice(0, 30).join('\n')
                   if (tradeRows.length > 60) {
                       reqData += '\n... (省略中间大量交易记录) ...\n'
                       reqData += tradeRows.slice(-30).join('\n')
                   } else if (tradeRows.length > 30) {
                       reqData += '\n' + tradeRows.slice(30).join('\n')
                   }
               } else if (fs.existsSync(basicDataPath)) {
                   const basicRows = fs.readFileSync(basicDataPath, 'utf-8').split('\n').filter(l => l.trim())
                   reqData += `\n每日净值和持仓(前后采样):\n`
                   reqData += basicRows.slice(0, 30).join('\n')
                   if (basicRows.length > 60) {
                       reqData += '\n... (省略中间海量持仓日记录) ...\n'
                       reqData += basicRows.slice(-30).join('\n')
                   }
               }
               const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })
               const prompt = `你是一名顶级量化基金经理。以下是该策略在上述全周期内的评估数据，其中【核心汇总指标 (KPI)】是整个周期的准确全局统计结果，【交易明细】是首尾采样数据（请不要被采样数据的时间误导）：\n${reqData}\n结合你的金融知识，写一份专业的 Markdown 格式策略深度诊断分析报告。请以我提供的 KPI 数据为准（如胜率、收益率、回撤等），绝对不要自己根据采样数据去重新计算！结合交易明细评估策略优缺点并提出针对性改进建议。直接输出紧凑的 Markdown 文本（不要包含代码块标记）。`
               const resp = await ai.models.generateContent({
                  model: model || 'gemini-3.1-flash-lite-preview',
                  contents: prompt,
                  config: { temperature: 0.3 }
               })
               const analysisText = resp.text || ''
               fs.writeFileSync(path.join(TARGET_DIR, `strategy_analysis_${factorName}.md`), analysisText, 'utf-8')
                
               // Auto-generate description.txt if missing (so card descriptions show up for backtested strategies too)
               const descFilePath = path.join(TARGET_DIR, 'description.txt')
               if (!fs.existsSync(descFilePath) && analysisText.length > 0) {
                 // Try to extract from markdown: look for first heading or first meaningful sentence
                 const lines = analysisText.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('---') && !l.startsWith('```'))
                 const firstSentence = lines.find(l => l.trim().length > 10 && l.trim().length < 200)
                 if (firstSentence) {
                   fs.writeFileSync(descFilePath, firstSentence.trim().replace(/^\*+|\*+$/g, '').replace(/^[>-]\s*/, ''), 'utf-8')
                   task.logs.push('[系统] 📝 已自动生成策略概要描述')
                 }
               }
            }
          } else {
             task.logs.push('[系统] ⚠️ 未配置 GEMINI_API_KEY，跳过 AI 诊断生成')
          }
        } catch (e: any) {
             task.logs.push(`[系统] ⚠️ AI 生成失败: ${e.message}`)
        }

        // Run merge_report.py
        task.logs.push('[系统] 回测完成，开始合并报告...')
        const mergeProc = spawn('python3', [path.join(SKILL_DIR, 'merge_report.py'), '--factor', factorName, '--dir', TARGET_DIR], {
          cwd: TARGET_DIR,
          env,
          stdio: ['ignore', 'pipe', 'pipe'],
        })

        mergeProc.stdout.on('data', (data: Buffer) => {
          data.toString().split('\n').filter(l => l.trim()).forEach(line => task.logs.push(line))
        })
        mergeProc.stderr.on('data', (data: Buffer) => {
          data.toString().split('\n').filter(l => l.trim()).forEach(line => task.logs.push(`[merge-stderr] ${line}`))
        })

        mergeProc.on('close', (mergeCode) => {
          if (mergeCode === 0) {
            task.status = 'done'
            task.logs.push('[系统] ✅ 报告合并完成！')
          } else {
            // Even if merge fails, backtest data is available
            task.status = 'done'
            task.logs.push('[系统] ⚠️ 报告合并可能未完全成功，但回测数据已生成')
          }
          task.finishedAt = Date.now()
        })
      } else {
        task.status = 'error'
        task.error = `回测进程退出码: ${code}`
        task.logs.push(`[系统] ❌ 回测失败 (exit code: ${code})`)
        task.finishedAt = Date.now()
      }
    })

    return NextResponse.json({
      success: true,
      data: { taskId, factorName, status: 'running' },
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  // Query task status
  const taskId = searchParams.get('taskId')
  if (taskId) {
    const task = tasks.get(taskId)
    if (!task) {
      return NextResponse.json({ success: false, error: '任务不存在' }, { status: 404 })
    }
    return NextResponse.json({
      success: true,
      data: {
        id: task.id,
        factorName: task.factorName,
        status: task.status,
        logs: task.logs,
        error: task.error,
        params: task.params,
        startedAt: task.startedAt,
        finishedAt: task.finishedAt,
      },
    })
  }

  // List all strategies with completed reports
  const listMode = searchParams.get('list')
  if (listMode === 'true') {
    try {
      const strategyRoot = path.join(SKILL_DIR, 'strategy')
      if (!fs.existsSync(strategyRoot)) fs.mkdirSync(strategyRoot, { recursive: true })
      
      const folders = fs.readdirSync(strategyRoot)
      const reports = folders.map(folder => {
        const folderPath = path.join(strategyRoot, folder)
        if (!fs.statSync(folderPath).isDirectory()) return null
        
        const reportFile = `Final_Strategy_Report_${folder}.html`
        const htmlPath = path.join(folderPath, reportFile)
        if (!fs.existsSync(htmlPath)) return null
        
        const stat = fs.statSync(htmlPath)
        // Detect iteration status
        const iterMatch = folder.match(/^(.*?)_v\d+[a-z]?$/)
        const isIterated = !!iterMatch
        const rootFactor = iterMatch ? iterMatch[1] : folder

        // Try to load KPI for card display
        let kpiSummary: Record<string, any> | null = null
        const kpiPath = path.join(folderPath, 'kpi.json')
        if (fs.existsSync(kpiPath)) {
          try { kpiSummary = JSON.parse(fs.readFileSync(kpiPath, 'utf-8')) } catch {}
        }

        let description = '人工或因子生成的原始策略'
        const descPath = path.join(folderPath, 'description.txt')
        if (fs.existsSync(descPath)) {
          description = fs.readFileSync(descPath, 'utf-8').trim()
        } else if (isIterated) {
          const variantLetter = folder.slice(-1)
          if (variantLetter === 'a') description = '🛡️ 防御扩展版：强化风险控制，严格约束回撤'
          else if (variantLetter === 'b') description = '🔥 进攻增强版：放宽阈值，积极捕捉趋势收益'
          else if (variantLetter === 'c') description = '⚖️ 稳健均衡版：引入中性化过滤，稳定持仓控制'
          else description = '由AI导向迭代的演进变体策略'
        }

        return {
          factorName: folder,
          reportFile,
          createdAt: stat.mtime.toISOString(),
          fileSize: stat.size,
          isIterated,
          rootFactor,
          kpiSummary,
          description,
        }
      }).filter(Boolean)

      // Also list custom strategies
      const customDir = path.join(SKILL_DIR, 'custom_strategies')
      let customStrategies: string[] = []
      if (fs.existsSync(customDir)) {
        customStrategies = fs.readdirSync(customDir)
          .filter(f => f.endsWith('.py'))
          .map(f => f.replace('.py', ''))
      }

      return NextResponse.json({
        success: true,
        data: { reports, customStrategies },
      })
    } catch (e: any) {
      return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
  }

  // Get report HTML
  const reportFactor = searchParams.get('report')
  if (reportFactor) {
    const reportPath = path.join(SKILL_DIR, 'strategy', reportFactor, `Final_Strategy_Report_${reportFactor}.html`)
    if (!fs.existsSync(reportPath)) {
      return new NextResponse('报告文件不存在', { status: 404 })
    }
    const html = fs.readFileSync(reportPath, 'utf-8')
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // Get trade details
  const tradesFactor = searchParams.get('trades')
  if (tradesFactor) {
    // Parse trade_loss_rank.csv
    const csvPath = path.join(SKILL_DIR, 'strategy', tradesFactor, 'trade_loss_rank.csv')
    if (!fs.existsSync(csvPath)) {
      return NextResponse.json({ success: false, error: '交易明细文件不存在' }, { status: 404 })
    }
    try {
      const csvContent = fs.readFileSync(csvPath, 'utf-8')
      const lines = csvContent.split('\n').filter(l => l.trim())
      if (lines.length < 2) {
        return NextResponse.json({ success: true, data: { trades: [] } })
      }
      const headers = lines[0].split(',').map(h => h.trim())
      const trades = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim())
        const row: Record<string, string> = {}
        headers.forEach((h, i) => { row[h] = values[i] || '' })
        return row
      }).filter(r => r['证券名称'] || r['证券代码'])

      return NextResponse.json({ success: true, data: { trades } })
    } catch (e: any) {
      return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: false, error: '无效的请求参数' }, { status: 400 })
}
