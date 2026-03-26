/**
 * Factor Backtest API Route
 * Runs factor_backtest_v6.py locally and returns HTML report
 */
import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'

const BACKTEST_DIR = '/Users/alpha/.openclaw/workspace-quant_engineer/skills/因子回测报告'
const REPORTS_DIR = path.join(BACKTEST_DIR, 'factor_reports')
const SCRIPT_PATH = path.join(BACKTEST_DIR, 'factor_backtest_v6.py')

// In-memory task store for async backtest tracking
const tasks: Record<string, {
  status: 'running' | 'done' | 'error'
  factors: string[]
  results: Record<string, any>
  error?: string
  startTime: number
}> = {}

function generateTaskId(): string {
  return `bt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { factors, startDate, endDate } = body

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
      startTime: Date.now(),
    }

    // Run the backtest script asynchronously
    const factorArgs = safeFactors.join(' ')
    const cmd = `cd "${BACKTEST_DIR}" && python3 factor_backtest_v6.py --factors ${factorArgs}`

    console.log(`[Backtest] Starting task ${taskId}: ${cmd}`)

    exec(cmd, { timeout: 600000, maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[Backtest] Task ${taskId} error:`, error.message)
        tasks[taskId].status = 'error'
        tasks[taskId].error = stderr || error.message
        return
      }

      console.log(`[Backtest] Task ${taskId} completed`)

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
      const html = fs.readFileSync(reportPath, 'utf-8')
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
      elapsed: Math.round((Date.now() - task.startTime) / 1000),
    }
  })
}
