/**
 * 资金流看板 Signal API 代理
 * 前端通过此路由调用后端 Python API
 */
import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.FUND_FLOW_BACKEND_URL || 'http://localhost:8000'

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/signals/signals`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store', // 禁用缓存，确保获取最新数据
    })

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Fund flow proxy error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
