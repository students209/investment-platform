'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { getKline, getStockQuote, getMoneyFlow } from '@/lib/api'

export default function StockDetailPage() {
  const params = useParams()
  const code = params.code as string
  
  const [klineData, setKlineData] = useState<any[]>([])
  const [stockInfo, setStockInfo] = useState<any>(null)
  const [moneyFlow, setMoneyFlow] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (code) {
      loadData()
    }
  }, [code])

  async function loadData() {
    setLoading(true)
    try {
      const [klineRes, stockRes, flowRes] = await Promise.all([
        getKline(code, 'daily'),
        getStockQuote(code),
        getMoneyFlow(code)
      ])
      
      if (klineRes.success) setKlineData(klineRes.data)
      if (stockRes.success) setStockInfo(stockRes.data)
      if (flowRes.success) setMoneyFlow(flowRes.data)
    } catch (error) {
      console.error('Failed to load data:', error)
    }
    setLoading(false)
  }

  const formatNumber = (num: number, decimals = 2) => {
    return num?.toFixed(decimals) || '-'
  }

  const latestData = klineData[klineData.length - 1] || {}
  const maxPrice = Math.max(...klineData.map(d => d['最高'] || 0), 1)
  const minPrice = Math.min(...klineData.map(d => d['最低'] || 0), 0)

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 股票信息头部 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {stockInfo?.['名称'] || code}
            </h1>
            <p className="text-gray-500 mt-1">股票代码: {code}</p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold">
              {formatNumber(stockInfo?.['最新价'] || latestData['收盘'])}
            </div>
            <div className={`text-xl mt-1 ${(stockInfo?.['涨跌幅'] || 0) >= 0 ? 'text-red-500' : 'text-green-500'}`}>
              {(stockInfo?.['涨跌幅'] || 0) >= 0 ? '+' : ''}
              {formatNumber(stockInfo?.['涨跌幅'] || 0)}%
            </div>
          </div>
        </div>

        {/* 关键指标 */}
        <div className="grid grid-cols-4 md:grid-cols-8 gap-4 mt-6">
          {[
            { label: '开盘', value: latestData['开盘'] },
            { label: '最高', value: latestData['最高'] },
            { label: '最低', value: latestData['最低'] },
            { label: '收盘', value: latestData['收盘'] },
            { label: '成交量', value: latestData['成交量'] },
            { label: '成交额', value: latestData['成交额'] },
            { label: '涨跌幅', value: `${formatNumber(stockInfo?.['涨跌幅'] || 0)}%` },
            { label: '换手率', value: `${formatNumber(stockInfo?.['换手率'] || 0)}%` },
          ].map((item, i) => (
            <div key={i} className="text-center">
              <div className="text-xs text-gray-500">{item.label}</div>
              <div className="font-medium text-sm mt-1">
                {typeof item.value === 'number' ? formatNumber(item.value) : item.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* K线图 */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">K线走势</h2>
          <div className="h-80 flex items-end space-x-1 overflow-x-auto">
            {klineData.slice(-60).map((day, i) => {
              const height = ((day['收盘'] - minPrice) / (maxPrice - minPrice || 1)) * 100
              const color = day['收盘'] >= day['开盘'] ? 'bg-red-500' : 'bg-green-500'
              return (
                <div
                  key={i}
                  className={`w-2 ${color} rounded-t flex-shrink-0`}
                  style={{ height: `${Math.max(height, 2)}%` }}
                  title={`${day['日期']}: 收${day['收盘']}`}
                />
              )
            })}
          </div>
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
        </div>

        {/* 资金流向 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">资金流向</h2>
          {moneyFlow.length > 0 ? (
            <div className="space-y-3">
              {moneyFlow.map((item: any, i: number) => (
                <div key={i} className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-gray-500">{item['日期']}</span>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${
                      (item['主力净流入-净额'] || 0) >= 0 ? 'text-red-500' : 'text-green-500'
                    }`}>
                      {((item['主力净流入-净额'] || 0) / 10000).toFixed(2)}万
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">暂无资金流向数据</p>
          )}
        </div>
      </div>

      {/* 返回按钮 */}
      <div className="mt-6">
        <button
          onClick={() => history.back()}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
        >
          ← 返回行情列表
        </button>
      </div>
    </div>
  )
}
