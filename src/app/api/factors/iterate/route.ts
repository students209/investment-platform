/**
 * Factor Iterate API Route
 * Runs iterative_backtest.py locally and returns comparison metrics
 */
import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'

const ITERATE_DIR = '/Users/alpha/.openclaw/workspace-quant_engineer/skills/因子回测迭代'
const SCRIPT_PATH = path.join(ITERATE_DIR, 'iterative_backtest.py')
const TRACKING_PATH = path.join(ITERATE_DIR, 'iteration_tracking.md')
const ALPHA_PY_DIR = '/Users/alpha/.openclaw/workspace-quant_engineer/skills/文章转因子'

// In-memory task store
const tasks: Record<string, {
  status: 'running' | 'done' | 'error'
  factors: string[]
  results: any
  error?: string
  startTime: number
}> = {}

function generateTaskId(): string {
  return `it_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { factors, rounds = 1 } = body

    if (!factors || !Array.isArray(factors) || factors.length === 0) {
      return NextResponse.json({ success: false, error: '请选择至少一个因子' })
    }

    const safeFactors = factors.map((f: string) => f.replace(/[^a-zA-Z0-9_]/g, '')).filter(Boolean)
    if (safeFactors.length === 0) {
      return NextResponse.json({ success: false, error: '因子名称无效' })
    }

    const taskId = generateTaskId()
    tasks[taskId] = {
      status: 'running',
      factors: safeFactors,
      results: null,
      startTime: Date.now(),
    }

    // Build command
    const factorArgs = safeFactors.join(' ')
    const cmd = `cd "${ITERATE_DIR}" && PYTHONPATH="${ALPHA_PY_DIR}" python3 iterative_backtest.py --factors ${factorArgs}`

    console.log(`[Iterate] Starting task ${taskId}: ${cmd}`)

    exec(cmd, { timeout: 600000, maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[Iterate] Task ${taskId} error:`, error.message)
        tasks[taskId].status = 'error'
        tasks[taskId].error = stderr || error.message
        return
      }

      console.log(`[Iterate] Task ${taskId} completed`)

      // Parse JSON output from stdout
      let results: any = null
      try {
        results = JSON.parse(stdout.trim())
      } catch {
        results = { raw_output: stdout }
      }

      // Also read tracking table if available
      let trackingContent = ''
      if (fs.existsSync(TRACKING_PATH)) {
        trackingContent = fs.readFileSync(TRACKING_PATH, 'utf-8')
      }

      tasks[taskId].results = {
        metrics: results,
        tracking: trackingContent,
      }
      tasks[taskId].status = 'done'
    })

    return NextResponse.json({
      success: true,
      data: { taskId, factors: safeFactors, rounds, message: '迭代任务已启动' }
    })
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ success: false, error: `服务器错误：${errMsg}` })
  }
}

// GET: Check iteration task status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('taskId')

  // Get tracking table content directly if no taskId
  if (!taskId) {
    let trackingContent = ''
    if (fs.existsSync(TRACKING_PATH)) {
      trackingContent = fs.readFileSync(TRACKING_PATH, 'utf-8')
    }
    return NextResponse.json({
      success: true,
      data: { tracking: trackingContent }
    })
  }

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
      error: task.error,
      elapsed: Math.round((Date.now() - task.startTime) / 1000),
    }
  })
}
