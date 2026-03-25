'use client'

import { useState, useEffect } from 'react'
import { getIndexQuote, getKline, getHotStocks } from '@/lib/api'

export default function MarketPage() {
  const [selectedCode, setSelectedCode] = useState('000001') // 默认上证指数
  const [klineData, setKlineData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const indexCodes = [
    { code: '000001', name: '上证指数' },
    { code: '399001', name: '深证成指' },
    { code: '399006', name: '创业板' },
    { code: '000688', name: '科创50' },
  ]

  useEffect(() => {
    fetchKline(selectedCode)
  }, [selectedCode])

  async function fetchKline(code: string) {
    setLoading(true)
    try {
      const res = await getKline(code, 'daily')
      if (res.success) {
        setKlineData(res.data)
      }
    } catch (error) {
      console.error('Failed to fetch kline:', error)
    }
    setLoading(false)
  }

  // 简化K线渲染（用价格折线代替）
  const maxPrice = Math.max(...klineData.map(d => d['最高'] || 0))
  const minPrice = Math.min(...klineData.map(d => d['最低'] || 0))
  const priceRange = maxPrice - minPrice || 1

  const latestData = klineData[klineData.length - 1] || {}

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">行情中心</h1>

      {/* 指数选择 */}
      <div className="mb-6">
        <div className="flex space-x-4">
          {indexCodes.map(index => (
            <button
              key={index.code}
              onClick={() => setSelectedCode(index.code)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedCode === index.code
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {index.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* K线图区域 */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{indexCodes.find(i => i.code === selectedCode)?.name}</h2>
              {latestData['日期'] && (
                <span className="text-gray-500 text-sm">{latestData['日期']}</span>
              )}
            </div>

            {/* 简化K线可视化 */}
            <div className="h-80 flex items-end space-x-1 overflow-x-auto">
              {klineData.slice(-60).map((day, i) => {
                const height = ((day['收盘'] - minPrice) / priceRange) * 100
                const color = day['收盘'] >= day['开盘'] ? 'bg-red-500' : 'bg-green-500'
                return (
                  <div
                    key={i}
                    className={`w-2 ${color} rounded-t`}
                    style={{ height: `${Math.max(height, 2)}%` }}
                    title={`${day['日期']}: ${day['收盘']}`}
                  />
                )
              })}
            </div>

            {/* 图例 */}
            <div className="flex space-x-6 mt-4 text-sm">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded mr-2"></div>
                <span>上涨</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
                <span>下跌</span>
              </div>
            </div>

            {/* 行情数据 */}
            <div className="grid grid-cols-4 gap-4 mt-6">
              <div className="text-center">
                <div className="text-gray-500 text-sm">开盘</div>
                <div className="text-lg font-medium">{latestData['开盘'] || '-'}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 text-sm">收盘</div>
                <div className="text-lg font-medium">{latestData['收盘'] || '-'}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 text-sm">最高</div>
                <div className="text-lg font-medium">{latestData['最高'] || '-'}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 text-sm">最低</div>
                <div className="text-lg font-medium">{latestData['最低'] || '-'}</div>
              </div>
            </div>
          </div>

          {/* 个股搜索 */}
          <div className="mt-6 bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold mb-4">个股K线查询</h3>
            <div className="flex space-x-4">
              <input
                type="text"
                placeholder="输入股票代码，如 000001"
                className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setSelectedCode((e.target as HTMLInputElement).value)
                  }
                }}
              />
              <button
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                onClick={() => {
                  const input = document.querySelector('input') as HTMLInputElement
                  if (input?.value) setSelectedCode(input.value)
                }}
              >
                查询
              </button>
            </div>
          </div>
        </div>

        {/* 右侧信息 */}
        <div>
          {/* 指数行情 */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="text-lg font-bold mb-4">主要指数</h3>
            <IndexList />
          </div>

          {/* 操作提示 */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">使用提示</h4>
            <ul className="text-sm text-blue-600 space-y-1">
              <li>• 点击上方按钮切换不同指数</li>
              <li>• 输入股票代码查询个股K线</li>
              <li>• 数据来自 AKShare，免费开源</li>
              <li>• 实时数据可能有分钟级延迟</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

async function IndexList() {
  let data = null
  try {
    const res = await getIndexQuote()
    if (res.success) data = res.data
  } catch {}

  if (!data) {
    return <div className="text-gray-500">加载中...</div>
  }

  return (
    <div className="space-y-3">
      {data.map((index: any) => {
        const change = index['涨跌幅'] || 0
        const colorClass = change >= 0 ? 'text-red-500' : 'text-green-500'
        return (
          <div key={index['代码']} className="flex justify-between items-center">
            <span className="text-gray-700">{index['名称']}</span>
            <div className="text-right">
              <span className="font-medium">{index['最新价']}</span>
              <span className={`ml-2 ${colorClass}`}>{change >= 0 ? '+' : ''}{change.toFixed(2)}%</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
