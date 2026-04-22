/**
 * Factor Backtest API Route
 * Runs factor_backtest_v6.py locally and returns HTML report
 */
import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const BACKTEST_DIR = '/Users/alpha/.openclaw/workspace-quant_engineer/skills/因子回测报告'
const ALPHA_PY_DIR = '/Users/alpha/.openclaw/workspace-quant_engineer/skills/文章转因子'
const REPORTS_DIR = path.join(BACKTEST_DIR, 'factor_reports')
const SCRIPT_PATH = path.join(BACKTEST_DIR, 'factor_backtest_v6.py')
const ECHARTS_CDN = 'https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js'

// In-memory task store for async backtest tracking
const tasks: Record<string, {
  status: 'running' | 'done' | 'error'
  factors: string[]
  results: Record<string, any>
  error?: string
  logs: string[]
  startTime: number
}> = {}

function generateTaskId(): string {
  return `bt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { factors, startDate, endDate, groupNum, benchmark, neutralize, model = 'gemini-2.5-flash' } = body

    if (!factors || !Array.isArray(factors) || factors.length === 0) {
      return NextResponse.json({ success: false, error: '请选择至少一个因子' })
    }

    // Sanitize factor names
    const safeFactors = factors.map((f: string) => f.replace(/[^a-zA-Z0-9_]/g, '')).filter(Boolean)
    if (safeFactors.length === 0) {
      return NextResponse.json({ success: false, error: '因子名称无效' })
    }

    const taskId = generateTaskId()
    tasks[taskId] = {
      status: 'running',
      factors: safeFactors,
      results: {},
      logs: [],
      startTime: Date.now(),
    }

    // Construct arguments
    const args = ['factor_backtest_v6.py', '--factors', ...safeFactors]
    if (startDate) { args.push('--start_date', startDate) }
    if (endDate) { args.push('--end_date', endDate) }
    if (benchmark) { args.push('--benchmark', benchmark) }
    if (groupNum) { args.push('--group_num', groupNum.toString()) }
    if (neutralize !== undefined) { args.push('--neutralize', neutralize ? '1' : '0') }

    console.log(`[Backtest] Starting task ${taskId} with args:`, args.join(' '))

    const pyProcess = spawn('python3', args, {
      cwd: BACKTEST_DIR,
      env: { ...process.env, PYTHONPATH: `${ALPHA_PY_DIR}:${process.env.PYTHONPATH || ''}` },
    })

    pyProcess.stdout.on('data', (data) => {
      const txt = data.toString().replace(/\r/g, '\n')
      tasks[taskId].logs.push(txt)
    })
    pyProcess.stderr.on('data', (data) => {
      const txt = data.toString().replace(/\r/g, '\n')
      tasks[taskId].logs.push(txt)
    })

    pyProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`[Backtest] Task ${taskId} error code:`, code)
        tasks[taskId].status = 'error'
        tasks[taskId].error = `脚本退出码: ${code}`
        return
      }

      console.log(`[Backtest] Task ${taskId} main backtest completed. Starting enhancement...`)
      tasks[taskId].logs.push("\n>>> 正在进行 AI 深度诊断与报告增强...\n")

      const geminiKey = process.env.GEMINI_API_KEY || ''
      const enhanceArgs = [
        'enhance_report.py', 
        '--factors', ...safeFactors, 
        '--model', model,
        ...(geminiKey ? ['--api_key', geminiKey] : [])
      ]
      const enhanceProcess = spawn('python3', enhanceArgs, {
        cwd: BACKTEST_DIR,
        env: { ...process.env, PYTHONPATH: `${ALPHA_PY_DIR}:${process.env.PYTHONPATH || ''}` },
      })

      enhanceProcess.stdout.on('data', (data) => tasks[taskId].logs.push(data.toString().replace(/\r/g, '\n')))
      enhanceProcess.stderr.on('data', (data) => tasks[taskId].logs.push(data.toString().replace(/\r/g, '\n')))

      enhanceProcess.on('close', (enhanceCode) => {
        console.log(`[Backtest] Task ${taskId} enhancement completed (code ${enhanceCode})`)
        
        // Collect results: read generated HTML reports
        const results: Record<string, any> = {}
        for (const factor of safeFactors) {
          const reportPath = path.join(REPORTS_DIR, `report_${factor}.html`)
          if (fs.existsSync(reportPath)) {
            results[factor] = {
              success: true,
              reportPath,
              reportSize: fs.statSync(reportPath).size,
            }
          } else {
            results[factor] = {
              success: false,
              error: '未找到生成的报告文件',
            }
          }
        }

        tasks[taskId].results = results
        tasks[taskId].status = 'done'
      })
    })

    pyProcess.on('error', (err) => {
      tasks[taskId].status = 'error'
      tasks[taskId].error = err.message
    })

    return NextResponse.json({
      success: true,
      data: { taskId, factors: safeFactors, message: '回测任务已启动' }
    })
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ success: false, error: `服务器错误：${errMsg}` })
  }
}

// GET: Check backtest task status or fetch report HTML
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('taskId')
  const factor = searchParams.get('factor')

  // If factor is specified, return the HTML report directly
  if (factor) {
    const safeFactor = factor.replace(/[^a-zA-Z0-9_]/g, '')
    const reportPath = path.join(REPORTS_DIR, `report_${safeFactor}.html`)
    if (fs.existsSync(reportPath)) {
      let html = fs.readFileSync(reportPath, 'utf-8')
      // Replace relative echarts path with CDN so charts render in iframe
      html = html.replace(/src="\.\.?\/echarts\.min\.js"/g, `src="${ECHARTS_CDN}"`)
      html = html.replace(/src='\.\.\/echarts\.min\.js'/g, `src='${ECHARTS_CDN}'`)
      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }
    return NextResponse.json({ success: false, error: '报告不存在' })
  }

  // Otherwise check task status
  if (!taskId || !tasks[taskId]) {
    return NextResponse.json({ success: false, error: '任务不存在' })
  }

  const task = tasks[taskId]
  return NextResponse.json({
    success: true,
    data: {
      status: task.status,
      factors: task.factors,
      results: task.results,
      error: task.error,
      logs: task.logs,
      elapsed: Math.round((Date.now() - task.startTime) / 1000),
    }
  })
}
