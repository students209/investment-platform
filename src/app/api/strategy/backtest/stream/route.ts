/**
 * Strategy Backtest SSE Log Stream
 * Streams real-time logs from a running backtest task via Server-Sent Events
 */
import { NextRequest } from 'next/server'

// Import shared task store - we re-reference the same in-memory map
// Since Next.js API routes run in the same process, we use a global store
const getTasksMap = () => {
  const g = globalThis as any
  if (!g.__strategyTasks) g.__strategyTasks = new Map()
  return g.__strategyTasks as Map<string, any>
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const taskId = searchParams.get('taskId')

  if (!taskId) {
    return new Response('Missing taskId', { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      let lastIndex = 0
      let closed = false

      const interval = setInterval(() => {
        if (closed) return

        // Try to find task in both local and global stores
        const tasks = getTasksMap()
        // Also check the route.ts tasks map via dynamic import workaround
        // Since they share the same Node.js process, we use globalThis
        const g = globalThis as any
        const allTasks = g.__backtestTasks || tasks

        const task = allTasks.get(taskId)
        if (!task) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: '任务不存在' })}\n\n`))
          clearInterval(interval)
          closed = true
          controller.close()
          return
        }

        // Send new log lines
        if (task.logs && task.logs.length > lastIndex) {
          const newLines = task.logs.slice(lastIndex)
          lastIndex = task.logs.length
          newLines.forEach((line: string) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'log', message: line })}\n\n`))
          })
        }

        // Check if task is done
        if (task.status === 'done' || task.status === 'error') {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'complete',
            status: task.status,
            error: task.error || null,
          })}\n\n`))
          clearInterval(interval)
          closed = true
          controller.close()
        }
      }, 500)

      // Cleanup on abort
      req.signal.addEventListener('abort', () => {
        clearInterval(interval)
        closed = true
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
