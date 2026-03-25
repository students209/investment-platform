'use client'

import { useState, useEffect } from 'react'
import { getRiskDashboard, calculatePortfolioRisk } from '@/lib/api'

export default function RiskPage() {
  const [dashboard, setDashboard] = useState<any>(null)
  const [holdings, setHoldings] = useState([
    { code: '000001', name: '平安银行', shares: 10000, cost: 12.5, current_price: 13.2 },
    { code: '600519', name: '贵州茅台', shares: 100, cost: 1600, current_price: 1750 },
    { code: '000858', name: '五粮液', shares: 500, cost: 180, current_price: 165 },
  ])
  const [riskResult, setRiskResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    try {
      const res = await getRiskDashboard()
      if (res.success) {
        setDashboard(res.data)
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error)
    }
  }

  async function calculateRisk() {
    setLoading(true)
    try {
      const res = await calculatePortfolioRisk(holdings)
      if (res.total_value) {
        setRiskResult(res)
      }
    } catch (error) {
      console.error('Failed to calculate risk:', error)
    }
    setLoading(false)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">风控仪表盘</h1>

      {/* 风控概览 */}
      {dashboard && (
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-gray-500 text-sm">组合价值</div>
            <div className="text-2xl font-bold mt-1">
              ¥{dashboard.portfolio?.value?.toLocaleString() || '-'}
            </div>
            <div className="text-sm text-emerald-600 mt-1">
              +{(dashboard.portfolio?.pnl_pct || 0).toFixed(2)}%
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-gray-500 text-sm">VaR (95%)</div>
            <div className="text-2xl font-bold mt-1 text-red-600">
              -¥{(Math.abs(dashboard.risk_metrics?.var_95 || 0) / 10000).toFixed(2)}万
            </div>
            <div className="text-xs text-gray-400 mt-1">日度最大损失</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-gray-500 text-sm">最大回撤</div>
            <div className="text-2xl font-bold mt-1 text-orange-600">
              -{(Math.abs(dashboard.risk_metrics?.max_drawdown || 0)).toFixed(1)}%
            </div>
            <div className="text-xs text-gray-400 mt-1">历史最大回撤</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-gray-500 text-sm">波动率</div>
            <div className="text-2xl font-bold mt-1">
              {(dashboard.risk_metrics?.volatility || 0).toFixed(1)}%
            </div>
            <div className="text-xs text-gray-400 mt-1">年化波动率</div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        {/* 持仓管理 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">持仓管理</h2>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">代码</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">名称</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">股数</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">成本</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">现价</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">盈亏</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {holdings.map((h, i) => {
                  const pnl = (h.current_price - h.cost) * h.shares
                  const pnlPct = ((h.current_price - h.cost) / h.cost * 100)
                  return (
                    <tr key={i}>
                      <td className="px-3 py-2 text-sm text-gray-500">{h.code}</td>
                      <td className="px-3 py-2 text-sm font-medium">{h.name}</td>
                      <td className="px-3 py-2 text-sm text-right">{h.shares.toLocaleString()}</td>
                      <td className="px-3 py-2 text-sm text-right">¥{h.cost.toFixed(2)}</td>
                      <td className="px-3 py-2 text-sm text-right">¥{h.current_price.toFixed(2)}</td>
                      <td className={`px-3 py-2 text-sm text-right font-medium ${pnl >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {pnl >= 0 ? '+' : ''}¥{pnl.toFixed(0)} ({pnlPct.toFixed(1)}%)
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <button
            onClick={calculateRisk}
            disabled={loading}
            className="w-full mt-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? '计算中...' : '计算风控指标'}
          </button>
        </div>

        {/* 风控结果 */}
        <div>
          {riskResult ? (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">风控分析结果</h2>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500">组合价值</div>
                  <div className="text-xl font-bold">¥{riskResult.total_value?.toLocaleString()}</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500">总盈亏</div>
                  <div className={`text-xl font-bold ${riskResult.total_pnl >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {riskResult.total_pnl >= 0 ? '+' : ''}¥{riskResult.total_pnl?.toLocaleString()} ({riskResult.total_pnl_pct?.toFixed(2)}%)
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">VaR (95%)</div>
                    <div className="text-sm text-gray-500">置信度95%的最大日损失</div>
                  </div>
                  <div className="text-xl font-bold text-red-600">
                    ¥{riskResult.var_95?.toLocaleString()}
                  </div>
                </div>

                <div className="flex justify-between items-center p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">CVaR (95%)</div>
                    <div className="text-sm text-gray-500">超过VaR的平均损失</div>
                  </div>
                  <div className="text-xl font-bold text-red-600">
                    ¥{riskResult.cvar_95?.toLocaleString()}
                  </div>
                </div>

                <div className="flex justify-between items-center p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">最大回撤</div>
                    <div className="text-sm text-gray-500">历史最大回撤</div>
                  </div>
                  <div className="text-xl font-bold text-orange-600">
                    {riskResult.max_drawdown?.toFixed(2)}%
                  </div>
                </div>

                <div className="flex justify-between items-center p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">波动率</div>
                    <div className="text-sm text-gray-500">年化波动率</div>
                  </div>
                  <div className="text-xl font-bold">
                    {riskResult.volatility?.toFixed(2)}%
                  </div>
                </div>
              </div>

              {/* 告警 */}
              {riskResult.alerts && (
                <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
                  <h3 className="font-medium text-yellow-800 mb-2">⚠️ 风控告警</h3>
                  <ul className="space-y-1">
                    {riskResult.alerts.map((alert: string, i: number) => (
                      <li key={i} className="text-sm text-yellow-700">{alert}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="text-6xl mb-4">🛡️</div>
              <h2 className="text-xl font-medium text-gray-700 mb-2">暂无风控数据</h2>
              <p className="text-gray-500 mb-4">
                添加持仓后点击「计算风控指标」
              </p>
            </div>
          )}

          {/* 风控说明 */}
          <div className="bg-blue-50 rounded-lg p-4 mt-6">
            <h4 className="font-medium text-blue-800 mb-2">风控指标说明</h4>
            <ul className="text-sm text-blue-600 space-y-1">
              <li>• <strong>VaR</strong>：在给定置信水平下，组合在特定时间内可能遭受的最大损失</li>
              <li>• <strong>CVaR</strong>：超过VaR损失的平均值，更反映尾部风险</li>
              <li>• <strong>最大回撤</strong>：从历史最高点到最低点的最大跌幅</li>
              <li>• <strong>波动率</strong>：收益的标准差，年化后反映风险水平</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
