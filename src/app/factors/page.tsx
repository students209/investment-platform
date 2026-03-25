'use client'

import { useState } from 'react'
import { getFactorList, computeFactor } from '@/lib/api'

export default function FactorsPage() {
  const [factors, setFactors] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [computing, setComputing] = useState(false)

  // 因子编辑状态
  const [formula, setFormula] = useState('')
  const [result, setResult] = useState<any>(null)

  async function loadFactors() {
    setLoading(true)
    try {
      const res = await getFactorList()
      if (res.success) {
        setFactors(res.data)
      }
    } catch (error) {
      console.error('Failed to load factors:', error)
    }
    setLoading(false)
  }

  async function handleCompute() {
    if (!formula) return
    setComputing(true)
    try {
      const res = await computeFactor({
        name: 'Custom Factor',
        formula,
        params: {},
        codes: ['000001', '000002', '600000'],
        start_date: '20250101',
        end_date: '20260325'
      })
      if (res.success) {
        setResult(res.data)
      }
    } catch (error) {
      console.error('Failed to compute:', error)
    }
    setComputing(false)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">因子实验室</h1>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* 因子编辑器 */}
        <div>
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">因子计算</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                因子公式
              </label>
              <textarea
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                placeholder="输入因子计算公式，如：close / ma(close, 20)"
                className="w-full h-32 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                参数设置
              </label>
              <div className="grid grid-cols-3 gap-4">
                <input
                  type="text"
                  placeholder="股票代码 (逗号分隔)"
                  defaultValue="000001,000002,600000"
                  className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
                <input
                  type="date"
                  defaultValue="2025-01-01"
                  className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
                <input
                  type="date"
                  defaultValue="2026-03-25"
                  className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>
            </div>

            <button
              onClick={handleCompute}
              disabled={computing || !formula}
              className="w-full py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {computing ? '计算中...' : '计算因子'}
            </button>

            {/* 计算结果 */}
            {result && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-3">计算结果</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">IC均值</span>
                    <div className="font-medium text-emerald-600">{result.ic?.toFixed(4) || result.ic_mean?.toFixed(4) || '-'}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">IC标准差</span>
                    <div className="font-medium">{result.std?.toFixed(4) || result.ic_std?.toFixed(4) || '-'}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">IR</span>
                    <div className="font-medium">{result.ir?.toFixed(4) || '-'}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 快速模板 */}
          <div className="bg-white rounded-lg shadow p-6 mt-6">
            <h3 className="font-bold mb-4">快速模板</h3>
            <div className="space-y-2">
              {[
                { name: 'MACross', desc: '均线交叉因子', formula: '(ma(close, 5) - ma(close, 20)) / ma(close, 20)' },
                { name: 'VolumeRatio', desc: '成交量放大因子', formula: 'volume / ma(volume, 20)' },
                { name: 'PriceMomentum', desc: '动量因子', formula: '(close - close(20)) / close(20)' },
              ].map((template, i) => (
                <button
                  key={i}
                  onClick={() => setFormula(template.formula)}
                  className="w-full text-left p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="font-medium text-sm">{template.name}</div>
                  <div className="text-xs text-gray-500">{template.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 因子列表 */}
        <div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">已有因子</h2>
              <button
                onClick={loadFactors}
                className="text-emerald-600 hover:text-emerald-700 text-sm"
              >
                {loading ? '加载中...' : '刷新'}
              </button>
            </div>

            {factors.length === 0 && !loading ? (
              <div className="text-center py-8 text-gray-500">
                <p>暂无因子</p>
                <p className="text-sm mt-1">在上方创建第一个因子</p>
              </div>
            ) : (
              <div className="space-y-3">
                {factors.map((factor: any) => (
                  <div key={factor.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{factor.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">{factor.description}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded ${
                        factor.status === 'published' 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {factor.status}
                      </span>
                    </div>
                    <div className="flex space-x-4 mt-3 text-sm">
                      <div>
                        <span className="text-gray-500">IC: </span>
                        <span className="font-medium">{factor.ic_mean?.toFixed(4) || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">夏普: </span>
                        <span className="font-medium">{factor.sharpe?.toFixed(2) || '-'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 功能说明 */}
          <div className="bg-blue-50 rounded-lg p-4 mt-6">
            <h4 className="font-medium text-blue-800 mb-2">功能说明</h4>
            <ul className="text-sm text-blue-600 space-y-1">
              <li>• 支持 Python 风格的因子公式</li>
              <li>• 内置 ma, ema, std, correlation 等函数</li>
              <li>• 支持自定义参数</li>
              <li>• 自动计算 IC、IR 等指标</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
