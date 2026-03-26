'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getFactorsIndex, getBacktestReport } from '@/lib/api'

type Factor = {
  name: string
  category: string
  logic_summary: string
  data_fields: string[]
  source: string
  backtested: boolean
  backtest_metrics: {
    ic_mean: number
    ic_t_stat: number
    annual_ret: number
    sharpe: number
    max_dd: number
    win_rate: number
    turnover: number
  } | null
}

export default function FactorStorePage() {
  const router = useRouter()
  const [activeModule, setActiveModule] = useState<'untested' | 'backtested'>('untested')
  const [factors, setFactors] = useState<Factor[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [untestedCount, setUntestedCount] = useState(0)
  const [backtestedCount, setBacktestedCount] = useState(0)
  const [sortBy, setSortBy] = useState('name')

  // Report modal state
  const [reportModal, setReportModal] = useState(false)
  const [reportHtml, setReportHtml] = useState('')
  const [reportFactor, setReportFactor] = useState('')
  const [loadingReport, setLoadingReport] = useState(false)

  // Summary table modal
  const [showSummary, setShowSummary] = useState(false)
  const [allBacktested, setAllBacktested] = useState<Factor[]>([])

  const loadFactors = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getFactorsIndex({
        filter: activeModule,
        search: searchTerm || undefined,
        page,
        pageSize: 24,
      })
      if (res.success) {
        setFactors(res.data.factors)
        setTotalPages(res.data.totalPages)
        setTotal(res.data.total)
        setUntestedCount(res.data.untested_count)
        setBacktestedCount(res.data.backtested_count)
      }
    } catch (e) {
      console.error('Failed to load factors:', e)
    }
    setLoading(false)
  }, [activeModule, searchTerm, page])

  useEffect(() => {
    loadFactors()
  }, [loadFactors])

  // Reset page when switching modules or searching
  useEffect(() => { setPage(1) }, [activeModule, searchTerm])

  // Sort factors
  const sortedFactors = [...factors].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    if (sortBy === 'sharpe' && a.backtest_metrics && b.backtest_metrics) {
      return b.backtest_metrics.sharpe - a.backtest_metrics.sharpe
    }
    if (sortBy === 'ic' && a.backtest_metrics && b.backtest_metrics) {
      return b.backtest_metrics.ic_mean - a.backtest_metrics.ic_mean
    }
    return 0
  })

  async function viewReport(factor: string) {
    setReportFactor(factor)
    setReportModal(true)
    setLoadingReport(true)
    try {
      const html = await getBacktestReport(factor)
      setReportHtml(html)
    } catch (e) {
      setReportHtml('<p style="color:red">加载报告失败</p>')
    }
    setLoadingReport(false)
  }

  async function loadAllBacktested() {
    setShowSummary(true)
    try {
      const res = await getFactorsIndex({ filter: 'backtested', pageSize: 200 })
      if (res.success) {
        setAllBacktested(res.data.factors)
      }
    } catch (e) {
      console.error(e)
    }
  }

  function goToBacktest(factorName: string) {
    router.push(`/factors?tab=backtest&factor=${encodeURIComponent(factorName)}`)
  }

  function goToIterate(factorName: string) {
    router.push(`/factors?tab=iterate&factor=${encodeURIComponent(factorName)}`)
  }

  function goToStrategy(factorName: string) {
    router.push(`/strategies?factor=${encodeURIComponent(factorName)}`)
  }

  function getCategoryColor(category: string): string {
    const colors: Record<string, string> = {
      momentum: 'bg-blue-50 text-blue-700',
      trend: 'bg-green-50 text-green-700',
      reversal: 'bg-orange-50 text-orange-700',
      volatility: 'bg-red-50 text-red-700',
      volume: 'bg-purple-50 text-purple-700',
      value: 'bg-yellow-50 text-yellow-700',
    }
    for (const [key, val] of Object.entries(colors)) {
      if (category.toLowerCase().includes(key)) return val
    }
    return 'bg-gray-50 text-gray-600'
  }

  function formatMetric(val: number, isPercent = false): string {
    if (val === null || val === undefined || isNaN(val)) return '-'
    if (isPercent) return `${(val * 100).toFixed(2)}%`
    return val.toFixed(4)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">因子超市</h1>
          <p className="text-gray-500 mt-1">
            共 {untestedCount + backtestedCount} 个因子 · {backtestedCount} 个已回测
          </p>
        </div>
        {backtestedCount > 0 && (
          <button
            onClick={loadAllBacktested}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
          >
            📊 查看指标汇总
          </button>
        )}
      </div>

      {/* Module Tabs */}
      <div className="flex space-x-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        <button
          onClick={() => setActiveModule('untested')}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeModule === 'untested'
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          📋 待测因子 ({untestedCount})
        </button>
        <button
          onClick={() => setActiveModule('backtested')}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeModule === 'backtested'
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          ✅ 已测因子 ({backtestedCount})
        </button>
      </div>

      {/* Search & Sort Bar */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索因子名称、描述、类别..."
            className="w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
          />
        </div>
        {activeModule === 'backtested' && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">排序:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            >
              <option value="name">名称</option>
              <option value="sharpe">夏普比率</option>
              <option value="ic">IC均值</option>
            </select>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-12 text-gray-500">
          <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-3" />
          加载中...
        </div>
      )}

      {/* Factor Cards Grid */}
      {!loading && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sortedFactors.map((factor) => (
            <div key={factor.name} className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-shadow p-5">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 truncate" title={factor.name}>{factor.name}</h3>
                  {factor.source && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate" title={factor.source}>来源: {factor.source}</p>
                  )}
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ml-2 whitespace-nowrap ${getCategoryColor(factor.category)}`}>
                  {factor.category === 'unknown (auto-extracted)' ? '自动提取' : factor.category}
                </span>
              </div>

              <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                {factor.logic_summary || '暂无描述'}
              </p>

              {/* Data fields */}
              {factor.data_fields && factor.data_fields.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {factor.data_fields.slice(0, 4).map(field => (
                    <span key={field} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">
                      {field}
                    </span>
                  ))}
                  {factor.data_fields.length > 4 && (
                    <span className="text-xs text-gray-400">+{factor.data_fields.length - 4}</span>
                  )}
                </div>
              )}

              {/* Backtest metrics (for backtested module) */}
              {factor.backtested && factor.backtest_metrics && (
                <div className="grid grid-cols-3 gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <div className="text-xs text-gray-500">IC均值</div>
                    <div className={`font-bold text-sm ${factor.backtest_metrics.ic_mean > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {formatMetric(factor.backtest_metrics.ic_mean)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500">夏普</div>
                    <div className={`font-bold text-sm ${factor.backtest_metrics.sharpe > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {factor.backtest_metrics.sharpe?.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500">最大回撤</div>
                    <div className="font-bold text-sm text-red-500">
                      {formatMetric(factor.backtest_metrics.max_dd, true)}
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex space-x-2">
                {!factor.backtested ? (
                  <button
                    onClick={() => goToBacktest(factor.name)}
                    className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors"
                  >
                    🧪 去回测
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => viewReport(factor.name)}
                      className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors"
                    >
                      📊 查看报告
                    </button>
                    <button
                      onClick={() => goToIterate(factor.name)}
                      className="py-2 px-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm transition-colors"
                    >
                      🔄
                    </button>
                    <button
                      onClick={() => goToStrategy(factor.name)}
                      className="py-2 px-3 border border-emerald-300 text-emerald-700 rounded-lg hover:bg-emerald-50 text-sm transition-colors"
                    >
                      🚀
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && sortedFactors.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="text-xl font-medium text-gray-700 mb-2">
            {searchTerm ? '未找到匹配的因子' : '暂无因子'}
          </h2>
          <p className="text-gray-500">
            {searchTerm ? '尝试调整搜索关键字' : '使用论文转因子功能生成新的因子'}
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-4 mt-8">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-sm"
          >
            上一页
          </button>
          <span className="text-sm text-gray-500">
            第 {page} / {totalPages} 页 · 共 {total} 个因子
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-sm"
          >
            下一页
          </button>
        </div>
      )}

      {/* ========= Report Modal ========= */}
      {reportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-bold text-lg">{reportFactor} 回测报告</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => goToBacktest(reportFactor)}
                  className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm hover:bg-emerald-200"
                >
                  重新回测
                </button>
                <button
                  onClick={() => goToIterate(reportFactor)}
                  className="px-3 py-1.5 bg-violet-100 text-violet-700 rounded-lg text-sm hover:bg-violet-200"
                >
                  迭代进化
                </button>
                <button
                  onClick={() => { setReportModal(false); setReportHtml('') }}
                  className="px-3 py-1.5 text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {loadingReport ? (
                <div className="text-center py-12 text-gray-500">加载报告中...</div>
              ) : (
                <iframe
                  srcDoc={reportHtml}
                  className="w-full border-0 rounded-lg"
                  style={{ minHeight: '75vh' }}
                  title={`Report: ${reportFactor}`}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========= Summary Table Modal ========= */}
      {showSummary && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-bold text-lg">📊 已测因子指标汇总</h3>
              <button
                onClick={() => setShowSummary(false)}
                className="px-3 py-1.5 text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-white">
                  <tr className="bg-gray-50">
                    <th className="px-3 py-3 text-left font-medium text-gray-700 border">因子名称</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-700 border">IC均值</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-700 border">IC_T值</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-700 border">年化收益</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-700 border">夏普</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-700 border">最大回撤</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-700 border">胜率</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-700 border">换手率</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-700 border">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {allBacktested.map(f => (
                    <tr key={f.name} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 border font-medium text-sm">{f.name}</td>
                      <td className={`px-3 py-2.5 border text-center text-sm ${(f.backtest_metrics?.ic_mean ?? 0) > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {formatMetric(f.backtest_metrics?.ic_mean ?? 0)}
                      </td>
                      <td className="px-3 py-2.5 border text-center text-sm">
                        {f.backtest_metrics?.ic_t_stat?.toFixed(2)}
                      </td>
                      <td className={`px-3 py-2.5 border text-center text-sm ${(f.backtest_metrics?.annual_ret ?? 0) > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {formatMetric(f.backtest_metrics?.annual_ret ?? 0, true)}
                      </td>
                      <td className={`px-3 py-2.5 border text-center text-sm font-medium ${(f.backtest_metrics?.sharpe ?? 0) > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {f.backtest_metrics?.sharpe?.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 border text-center text-sm text-red-500">
                        {formatMetric(f.backtest_metrics?.max_dd ?? 0, true)}
                      </td>
                      <td className="px-3 py-2.5 border text-center text-sm">
                        {formatMetric(f.backtest_metrics?.win_rate ?? 0, true)}
                      </td>
                      <td className="px-3 py-2.5 border text-center text-sm">
                        {formatMetric(f.backtest_metrics?.turnover ?? 0, true)}
                      </td>
                      <td className="px-3 py-2.5 border text-center">
                        <button
                          onClick={() => { setShowSummary(false); viewReport(f.name) }}
                          className="text-emerald-600 hover:text-emerald-700 text-xs"
                        >
                          查看报告
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
