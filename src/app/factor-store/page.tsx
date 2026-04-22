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
    params?: {
      start_date: string
      end_date: string
      benchmark: string
      group_num: string
      neutralize: string
    }
    generated_at?: string
    is_iterated?: boolean
  } | null
  is_iterated?: boolean
}

export default function FactorStorePage() {
  const router = useRouter()
  const [activeModule, setActiveModule] = useState<'untested' | 'backtested'>('untested')
  const [backtestedSubFilter, setBacktestedSubFilter] = useState<'all' | 'backtest_only' | 'iterated'>('all')
  const [factors, setFactors] = useState<Factor[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [untestedCount, setUntestedCount] = useState(0)
  const [backtestedCount, setBacktestedCount] = useState(0)
  const [sortBy, setSortBy] = useState('name')
  const [error, setError] = useState('')

  // Report modal state
  const [reportModal, setReportModal] = useState(false)
  const [reportHtml, setReportHtml] = useState('')
  const [reportFactor, setReportFactor] = useState('')
  const [loadingReport, setLoadingReport] = useState(false)

  // Summary table modal
  const [showSummary, setShowSummary] = useState(false)
  const [allBacktested, setAllBacktested] = useState<Factor[]>([])

  // Pedigree / Evolution board modal
  const [showBoard, setShowBoard] = useState(false)
  const [boardHtml, setBoardHtml] = useState('')
  const [boardFactor, setBoardFactor] = useState('')
  const [loadingBoard, setLoadingBoard] = useState(false)

  // Iteration modal state (matching strategies page)
  const [iterModalOpen, setIterModalOpen] = useState(false)
  const [iterModalFactor, setIterModalFactor] = useState('')
  const [iterModalMode, setIterModalMode] = useState<'auto' | 'interactive'>('auto')
  const [iterModalPrompt, setIterModalPrompt] = useState('')

  function openIterModal(factor: string) {
    setIterModalFactor(factor)
    setIterModalMode('auto')
    setIterModalPrompt('')
    setIterModalOpen(true)
  }

  function confirmIteration() {
    setIterModalOpen(false)
    if (iterModalMode === 'interactive') {
      // Pass the custom prompt via URL query params to the factors iterate tab
      router.push(`/factors?tab=iterate&factor=${encodeURIComponent(iterModalFactor)}&customPrompt=${encodeURIComponent(iterModalPrompt.trim())}`)
    } else {
      router.push(`/factors?tab=iterate&factor=${encodeURIComponent(iterModalFactor)}`)
    }
  }

  const loadFactors = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getFactorsIndex({
        filter: activeModule,
        subFilter: activeModule === 'backtested' ? backtestedSubFilter : undefined,
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
      } else {
        setError(res.error || '加载因子失败')
      }
    } catch (e) {
      console.error('Failed to load factors:', e)
      setError('无法连接本地 API。请确保本地 Next.js 服务和 ngrok 隧道正在运行。')
    }
    setLoading(false)
  }, [activeModule, searchTerm, page, backtestedSubFilter])

  useEffect(() => {
    loadFactors()
  }, [loadFactors])

  // Listen to postMessage from iframe for report viewing
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'view_report' && e.data?.factor) {
        viewReport(e.data.factor)
      }
    }
    window.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  // Reset page when switching modules or searching or sub-filtering
  useEffect(() => { setPage(1) }, [activeModule, searchTerm, backtestedSubFilter])

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

  // Note: Backend handles activeModule and backtestedSubFilter now.
  // We use `factors` directly from loadFactors state.

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

  async function goToStrategy(name: string) {
    router.push(`/strategies?factor=${encodeURIComponent(name)}`)
  }

  async function viewBoard(name: string) {
    setBoardFactor(name)
    setShowBoard(true)
    setLoadingBoard(true)
    try {
      const LOCAL_API = process.env.NEXT_PUBLIC_NEXT_API_URL || ''
      const res = await fetch(`${LOCAL_API}/api/factors/iterate?factorName=${encodeURIComponent(name)}`)
      const json = await res.json()
      if (json.success && json.data.boardHtml) {
        setBoardHtml(json.data.boardHtml)
      } else {
        setBoardHtml('<div class="p-8 text-center text-gray-400">暂无迭代血统数据</div>')
      }
    } catch (e) {
      setBoardHtml('<div class="p-8 text-center text-red-400">加载失败</div>')
    }
    setLoadingBoard(false)
  }

  function goToBacktest(factorName: string) {
    router.push(`/factors?tab=backtest&factor=${encodeURIComponent(factorName)}`)
  }

  function goToIterate(factorName: string) {
    openIterModal(factorName)
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

      {/* Sub-filter for backtested module */}
      {activeModule === 'backtested' && (
        <div className="flex space-x-2 mb-4">
          {[
            { key: 'all' as const, label: '全部已测', icon: '📋' },
            { key: 'backtest_only' as const, label: '仅回测', icon: '📊' },
            { key: 'iterated' as const, label: '已迭代', icon: '🧬' },
          ].map(sub => (
            <button
              key={sub.key}
              onClick={() => setBacktestedSubFilter(sub.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                backtestedSubFilter === sub.key
                  ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300'
                  : 'bg-white text-gray-500 hover:bg-gray-50 border'
              }`}
            >
              {sub.icon} {sub.label}
            </button>
          ))}
        </div>
      )}

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

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-700 font-medium">⚠️ 加载失败</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
            <button
              onClick={loadFactors}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
            >
              重试
            </button>
          </div>
        </div>
      )}

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
                  <div className="flex items-center space-x-2 truncate">
                    <h3 className="font-bold text-gray-900 truncate" title={factor.name}>{factor.name}</h3>
                    {factor.is_iterated && (
                      <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 text-[10px] font-bold rounded flex-shrink-0">
                        迭代
                      </span>
                    )}
                  </div>
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
                <>
                  <div className="grid grid-cols-3 gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-xs text-gray-500">IC均值</div>
                      <div className={`font-bold text-sm ${(factor.backtest_metrics?.ic_mean ?? 0) > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {formatMetric(factor.backtest_metrics?.ic_mean ?? 0)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500">夏普</div>
                      <div className={`font-bold text-sm ${(factor.backtest_metrics?.sharpe ?? 0) > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {factor.backtest_metrics?.sharpe?.toFixed(2)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500">最大回撤</div>
                      <div className="font-bold text-sm text-red-500">
                        {formatMetric(factor.backtest_metrics?.max_dd ?? 0, true)}
                      </div>
                    </div>
                  </div>
                  {factor.backtest_metrics?.params && (
                    <div className="bg-gray-50 rounded-lg p-2 mb-3 text-[10px] text-gray-500 grid grid-cols-2 gap-x-2">
                      <div>基准: {factor.backtest_metrics.params.benchmark}</div>
                      <div>分组: {factor.backtest_metrics.params.group_num}</div>
                      <div className="col-span-2 mt-1">期间: {factor.backtest_metrics.params.start_date} ~ {factor.backtest_metrics.params.end_date}</div>
                    </div>
                  )}
                </>
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
                    {factor.is_iterated && (
                      <button
                        onClick={() => viewBoard(factor.name)}
                        className="py-2 px-3 border border-violet-300 text-violet-700 rounded-lg hover:bg-violet-50 text-sm transition-colors"
                        title="查看迭代血统"
                      >
                        🌳
                      </button>
                    )}
                    <button
                      onClick={() => openIterModal(factor.name)}
                      className="py-2 px-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm transition-colors"
                      title="迭代进化"
                    >
                      🧬
                    </button>
                    <button
                      onClick={() => goToStrategy(factor.name)}
                      className="py-2 px-3 border border-emerald-300 text-emerald-700 rounded-lg hover:bg-emerald-50 text-sm transition-colors"
                      title="构建策略"
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
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center w-full">
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="text-xl font-medium text-gray-700 mb-2">
            {searchTerm ? '未找到匹配的因子' : '暂无因子'}
          </h2>
          <p className="text-gray-500">
            {searchTerm ? '尝试调整搜索关键字' : (activeModule === 'backtested' && backtestedSubFilter === 'iterated' ? '暂无已迭代因子' : '使用论文转因子功能生成新的因子')}
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-4 mt-8">
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-sm"
          >
            首页
          </button>
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
          <button
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-sm"
          >
            尾页
          </button>
        </div>
      )}

      {/* ========= Report Modal ========= */}
      {reportModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
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
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <span className="absolute left-2.5 top-1.5 text-gray-400">🕵️</span>
                  <input 
                    type="text" 
                    placeholder="搜索因子名/类别..." 
                    className="pl-8 pr-3 py-1.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-64"
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase()
                      const tbody = document.getElementById('summary-tbody')
                      if (tbody) {
                        Array.from(tbody.children).forEach((tr: any) => {
                          const text = tr.textContent?.toLowerCase() || ''
                          tr.style.display = text.includes(val) ? '' : 'none'
                        })
                      }
                    }}
                  />
                </div>
                <button
                  onClick={() => setShowSummary(false)}
                  className="px-3 py-1.5 text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <table className="w-full text-sm border-collapse" style={{ minWidth: '1000px' }}>
                <thead className="sticky top-0 bg-white shadow-sm">
                  <tr className="bg-gray-50">
                    <th className="px-3 py-3 text-left font-medium text-gray-700 border min-w-[250px] cursor-pointer hover:bg-gray-100" onClick={(e) => {
                      const tbody = document.getElementById('summary-tbody')
                      if (tbody) {
                        const rows = Array.from(tbody.children) as HTMLElement[]
                        const isAsc = e.currentTarget.dataset.sort === 'asc'
                        rows.sort((a, b) => {
                          const valA = a.dataset.name || ''
                          const valB = b.dataset.name || ''
                          return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA)
                        })
                        rows.forEach(r => tbody.appendChild(r))
                        e.currentTarget.dataset.sort = isAsc ? 'desc' : 'asc'
                      }
                    }}>
                      因子名称 ↕
                    </th>
                    <th className="px-3 py-3 text-center font-medium text-gray-700 border">类型</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-700 border cursor-pointer hover:bg-gray-100" onClick={(e) => {
                      const tbody = document.getElementById('summary-tbody')
                      if (tbody) {
                        const rows = Array.from(tbody.children) as HTMLElement[]
                        const isAsc = e.currentTarget.dataset.sort === 'asc'
                        rows.sort((a, b) => {
                          const valA = parseFloat(a.dataset.ic || '0')
                          const valB = parseFloat(b.dataset.ic || '0')
                          return isAsc ? valA - valB : valB - valA
                        })
                        rows.forEach(r => tbody.appendChild(r))
                        e.currentTarget.dataset.sort = isAsc ? 'desc' : 'asc'
                      }
                    }}>IC均值 ↕</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-700 border cursor-pointer hover:bg-gray-100" onClick={(e) => {
                      const tbody = document.getElementById('summary-tbody')
                      if (tbody) {
                        const rows = Array.from(tbody.children) as HTMLElement[]
                        const isAsc = e.currentTarget.dataset.sort === 'asc'
                        rows.sort((a, b) => {
                          const valA = parseFloat(a.dataset.ann || '0')
                          const valB = parseFloat(b.dataset.ann || '0')
                          return isAsc ? valA - valB : valB - valA
                        })
                        rows.forEach(r => tbody.appendChild(r))
                        e.currentTarget.dataset.sort = isAsc ? 'desc' : 'asc'
                      }
                    }}>年化 ↕</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-700 border sortable cursor-pointer hover:bg-gray-100" onClick={(e) => {
                      const tbody = document.getElementById('summary-tbody')
                      if (tbody) {
                        const rows = Array.from(tbody.children) as HTMLElement[]
                        const isAsc = e.currentTarget.dataset.sort === 'asc'
                        rows.sort((a, b) => {
                          const valA = parseFloat(a.dataset.sharpe || '0')
                          const valB = parseFloat(b.dataset.sharpe || '0')
                          return isAsc ? valA - valB : valB - valA
                        })
                        rows.forEach(r => tbody.appendChild(r))
                        e.currentTarget.dataset.sort = isAsc ? 'desc' : 'asc'
                      }
                    }}>夏普 ↕</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-700 border cursor-pointer hover:bg-gray-100" onClick={(e) => {
                      const tbody = document.getElementById('summary-tbody')
                      if (tbody) {
                        const rows = Array.from(tbody.children) as HTMLElement[]
                        const isAsc = e.currentTarget.dataset.sort === 'asc'
                        rows.sort((a, b) => {
                          const valA = parseFloat(a.dataset.maxdd || '0')
                          const valB = parseFloat(b.dataset.maxdd || '0')
                          return isAsc ? valA - valB : valB - valA
                        })
                        rows.forEach(r => tbody.appendChild(r))
                        e.currentTarget.dataset.sort = isAsc ? 'desc' : 'asc'
                      }
                    }}>最大回撤 ↕</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-700 border">基准/参数</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-700 border">操作</th>
                  </tr>
                </thead>
                <tbody id="summary-tbody">
                  {allBacktested.map(f => (
                    <tr 
                      key={f.name} 
                      className="hover:bg-gray-50"
                      data-name={f.name}
                      data-ic={f.backtest_metrics?.ic_mean ?? 0}
                      data-ann={f.backtest_metrics?.annual_ret ?? 0}
                      data-sharpe={f.backtest_metrics?.sharpe ?? 0}
                      data-maxdd={f.backtest_metrics?.max_dd ?? 0}
                    >
                      <td className="px-3 py-2.5 border font-medium text-sm">
                        <div className="flex items-center space-x-2">
                          <span className="select-all" title={f.name}>{f.name}</span>
                          {f.is_iterated && (
                            <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 text-[9px] font-bold rounded-full flex-shrink-0">迭代</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 border text-center text-xs text-gray-500 whitespace-nowrap">{f.category}</td>
                      <td className={`px-3 py-2.5 border text-center text-sm ${(f.backtest_metrics?.ic_mean ?? 0) > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {formatMetric(f.backtest_metrics?.ic_mean ?? 0)}
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
                      <td className="px-3 py-2.5 border text-center text-[10px] text-gray-600 whitespace-nowrap">
                        {f.backtest_metrics?.params?.benchmark} / {f.backtest_metrics?.params?.group_num}组
                        <div className="text-gray-400 mt-0.5">{f.backtest_metrics?.params?.start_date} ~ {f.backtest_metrics?.params?.end_date}</div>
                      </td>
                      <td className="px-3 py-2.5 border text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-3">
                          <button
                            onClick={() => { setShowSummary(false); viewReport(f.name) }}
                            className="text-emerald-600 hover:text-emerald-700 text-xs font-medium"
                          >
                            查看报告
                          </button>
                          {f.is_iterated && (
                            <button
                              onClick={() => { setShowSummary(false); viewBoard(f.name) }}
                              className="text-violet-600 hover:text-violet-700 text-xs font-medium"
                            >
                              血统看板
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* Evolution Board Modal */}
      {showBoard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
              <div>
                <h3 className="font-bold text-xl text-gray-900">🌳 因子迭代血统看板</h3>
                <p className="text-sm text-gray-500 mt-1">追溯因子 {boardFactor} 的迭代历程与提升路径</p>
              </div>
              <button
                onClick={() => setShowBoard(false)}
                className="p-2 hover:bg-white rounded-full text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-white p-2">
              {loadingBoard ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent animate-spin rounded-full mb-4"></div>
                  <p>加载迭代数据中...</p>
                </div>
              ) : (
                <iframe
                  srcDoc={boardHtml}
                  className="w-full h-full min-h-[70vh] border-0"
                  title="Evolution Board"
                />
              )}
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowBoard(false)}
                className="px-6 py-2 bg-gray-900 text-white rounded-xl hover:bg-black transition-colors font-medium shadow-lg"
              >
                关闭界面
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========= Iteration Mode Selector Modal ========= */}
      {iterModalOpen && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-gray-100">
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-black text-gray-900">🧬 因子迭代</h2>
                  <p className="text-sm text-gray-400 mt-1 font-mono">{iterModalFactor}</p>
                </div>
                <button onClick={() => setIterModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-lg">✕</button>
              </div>

              {/* Mode Tabs */}
              <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-xl">
                <button onClick={() => setIterModalMode('auto')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${iterModalMode === 'auto' ? 'bg-white shadow-sm text-violet-700' : 'text-gray-500 hover:text-gray-700'}`}>⚡ 自动迭代</button>
                <button onClick={() => setIterModalMode('interactive')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${iterModalMode === 'interactive' ? 'bg-white shadow-sm text-violet-700' : 'text-gray-500 hover:text-gray-700'}`}>✏️ 交互式迭代</button>
              </div>

              {iterModalMode === 'auto' ? (
                <div className="space-y-4">
                  <div className="bg-violet-50 border border-violet-100 rounded-2xl p-5">
                    <div className="text-sm font-bold text-violet-800 mb-2">自动迭代模式</div>
                    <p className="text-xs text-violet-600 leading-relaxed">AI 将基于当前因子的回测诊断报告，自动生成 3 个差异化变体：</p>
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-violet-700"><span className="w-5 h-5 bg-violet-200 rounded-full flex items-center justify-center text-[10px] font-black">A</span> 🛡️ 风控防御版 — 强化止损与回撤约束</div>
                      <div className="flex items-center gap-2 text-xs text-violet-700"><span className="w-5 h-5 bg-violet-200 rounded-full flex items-center justify-center text-[10px] font-black">B</span> 🔥 进攻增强版 — 优化信号与趋势捕捉</div>
                      <div className="flex items-center gap-2 text-xs text-violet-700"><span className="w-5 h-5 bg-violet-200 rounded-full flex items-center justify-center text-[10px] font-black">C</span> ⚖️ 稳健均衡版 — 中性化与持仓控制</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
                    <div className="text-sm font-bold text-amber-800 mb-2">交互式迭代模式</div>
                    <p className="text-xs text-amber-700 leading-relaxed">指定你希望 AI 重点优化的方向，系统将生成 1 个精准匹配你需求的迭代变体。</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: '🛡️ 风控增强', prompt: '强化风险控制，增加硬止损和最大回撤约束，降低波动率' },
                      { label: '🔥 收益优化', prompt: '优化选股信号强度，引入多因子加权和趋势跟踪，提升收益' },
                      { label: '⚖️ 稳健均衡', prompt: '引入行业中性化、截面标准化，降低换手率，稳定持仓' },
                      { label: '📈 IC提升', prompt: '优化因子计算逻辑，提升IC均值和IC_IR，增强因子预测能力' },
                      { label: '📉 回撤控制', prompt: '严格控制最大回撤在15%以内，增加动态止损机制' },
                    ].map(preset => (
                      <button key={preset.label} onClick={() => setIterModalPrompt(preset.prompt)} className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${iterModalPrompt === preset.prompt ? 'bg-violet-100 border-violet-300 text-violet-700' : 'bg-white border-gray-200 text-gray-600 hover:border-violet-200 hover:text-violet-600'}`}>{preset.label}</button>
                    ))}
                  </div>
                  <textarea value={iterModalPrompt} onChange={(e) => setIterModalPrompt(e.target.value)} placeholder="输入你希望 AI 重点优化的方向和具体要求..." className="w-full h-28 px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-violet-500 outline-none leading-relaxed" />
                </div>
              )}

              <button onClick={confirmIteration} disabled={iterModalMode === 'interactive' && !iterModalPrompt.trim()} className="w-full mt-6 py-3.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl text-sm font-black transition-all hover:from-violet-700 hover:to-purple-700 active:scale-[0.98] shadow-lg shadow-violet-200 disabled:opacity-40 disabled:cursor-not-allowed">
                {iterModalMode === 'auto' ? '🚀 开始自动迭代' : '🚀 开始交互式迭代'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
