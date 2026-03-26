'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { getFactorsIndex, startBacktest, getBacktestStatus, getBacktestReport, startIteration, getIterationStatus } from '@/lib/api'

type Factor = {
  name: string
  category: string
  logic_summary: string
  data_fields: string[]
  backtested: boolean
  backtest_metrics: any
}

export default function FactorsPage() {
  const [activeTab, setActiveTab] = useState<'backtest' | 'iterate'>('backtest')

  // ---- Backtest Tab State ----
  const [searchTerm, setSearchTerm] = useState('')
  const [candidates, setCandidates] = useState<Factor[]>([])
  const [selectedFactors, setSelectedFactors] = useState<string[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  const [backtestTaskId, setBacktestTaskId] = useState('')
  const [backtestStatus, setBacktestStatus] = useState<string>('')
  const [backtestElapsed, setBacktestElapsed] = useState(0)
  const [backtestResults, setBacktestResults] = useState<Record<string, any>>({})
  const [backtestRunning, setBacktestRunning] = useState(false)

  const [activeReport, setActiveReport] = useState('')
  const [reportHtml, setReportHtml] = useState('')
  const [loadingReport, setLoadingReport] = useState(false)

  // ---- Iterate Tab State ----
  const [iterFactorName, setIterFactorName] = useState('')
  const [iterRounds, setIterRounds] = useState(1)
  const [iterTaskId, setIterTaskId] = useState('')
  const [iterStatus, setIterStatus] = useState('')
  const [iterElapsed, setIterElapsed] = useState(0)
  const [iterResults, setIterResults] = useState<any>(null)
  const [iterRunning, setIterRunning] = useState(false)
  const [iterCandidates, setIterCandidates] = useState<Factor[]>([])
  const [iterSearch, setIterSearch] = useState('')
  const [showIterDropdown, setShowIterDropdown] = useState(false)

  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const iterPollRef = useRef<NodeJS.Timeout | null>(null)

  // ---- Search factors ----
  const searchFactors = useCallback(async (query: string) => {
    if (!query || query.length < 1) {
      setCandidates([])
      return
    }
    setSearching(true)
    try {
      const res = await getFactorsIndex({ search: query, pageSize: 20 })
      if (res.success) {
        setCandidates(res.data.factors)
        setShowDropdown(true)
      }
    } catch (e) { console.error(e) }
    setSearching(false)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => searchFactors(searchTerm), 300)
    return () => clearTimeout(timer)
  }, [searchTerm, searchFactors])

  // Search for iterate tab
  const searchIterFactors = useCallback(async (query: string) => {
    if (!query || query.length < 1) {
      setIterCandidates([])
      return
    }
    try {
      const res = await getFactorsIndex({ search: query, pageSize: 20 })
      if (res.success) {
        setIterCandidates(res.data.factors)
        setShowIterDropdown(true)
      }
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => searchIterFactors(iterSearch), 300)
    return () => clearTimeout(timer)
  }, [iterSearch, searchIterFactors])

  function toggleFactor(name: string) {
    setSelectedFactors(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  // ---- Start Backtest ----
  async function handleStartBacktest() {
    if (selectedFactors.length === 0) return
    setBacktestRunning(true)
    setBacktestStatus('正在启动回测...')
    setBacktestResults({})
    setActiveReport('')
    setReportHtml('')

    try {
      const res = await startBacktest(selectedFactors)
      if (!res.success) {
        setBacktestStatus(`错误: ${res.error}`)
        setBacktestRunning(false)
        return
      }
      setBacktestTaskId(res.data.taskId)
      setBacktestStatus('回测运行中...')
      startPolling(res.data.taskId)
    } catch (e) {
      setBacktestStatus('启动回测失败')
      setBacktestRunning(false)
    }
  }

  function startPolling(taskId: string) {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const res = await getBacktestStatus(taskId)
        if (!res.success) return
        setBacktestElapsed(res.data.elapsed)
        if (res.data.status === 'done') {
          clearInterval(pollRef.current!)
          setBacktestStatus('回测完成 ✅')
          setBacktestResults(res.data.results)
          setBacktestRunning(false)
        } else if (res.data.status === 'error') {
          clearInterval(pollRef.current!)
          setBacktestStatus(`回测出错: ${res.data.error?.slice(0, 200)}`)
          setBacktestRunning(false)
        } else {
          setBacktestStatus(`回测运行中... (${res.data.elapsed}s)`)
        }
      } catch (e) { /* keep polling */ }
    }, 3000)
  }

  // ---- Load Report ----
  async function loadReport(factor: string) {
    setActiveReport(factor)
    setLoadingReport(true)
    try {
      const html = await getBacktestReport(factor)
      setReportHtml(html)
    } catch (e) {
      setReportHtml('<p style="color:red">加载报告失败</p>')
    }
    setLoadingReport(false)
  }

  // ---- Start Iteration ----
  async function handleStartIteration() {
    const name = iterFactorName.trim()
    if (!name) return
    setIterRunning(true)
    setIterStatus('正在启动迭代...')
    setIterResults(null)

    try {
      const res = await startIteration([name], iterRounds)
      if (!res.success) {
        setIterStatus(`错误: ${res.error}`)
        setIterRunning(false)
        return
      }
      setIterTaskId(res.data.taskId)
      setIterStatus('迭代运行中...')
      startIterPolling(res.data.taskId)
    } catch (e) {
      setIterStatus('启动迭代失败')
      setIterRunning(false)
    }
  }

  function startIterPolling(taskId: string) {
    if (iterPollRef.current) clearInterval(iterPollRef.current)
    iterPollRef.current = setInterval(async () => {
      try {
        const res = await getIterationStatus(taskId)
        if (!res.success) return
        setIterElapsed(res.data.elapsed)
        if (res.data.status === 'done') {
          clearInterval(iterPollRef.current!)
          setIterStatus('迭代完成 ✅')
          setIterResults(res.data.results)
          setIterRunning(false)
        } else if (res.data.status === 'error') {
          clearInterval(iterPollRef.current!)
          setIterStatus(`迭代出错: ${res.data.error?.slice(0, 200)}`)
          setIterRunning(false)
        } else {
          setIterStatus(`迭代运行中... (${res.data.elapsed}s)`)
        }
      } catch (e) { /* keep polling */ }
    }, 3000)
  }

  // Cleanup intervals
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (iterPollRef.current) clearInterval(iterPollRef.current)
    }
  }, [])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">因子实验室</h1>
      <p className="text-gray-500 mb-6">回测、迭代与进化你的量化因子</p>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 rounded-xl p-1 mb-8 w-fit">
        <button
          onClick={() => setActiveTab('backtest')}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'backtest'
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          🧪 因子回测
        </button>
        <button
          onClick={() => setActiveTab('iterate')}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'iterate'
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          🔄 因子迭代
        </button>
      </div>

      {/* =================== Backtest Tab =================== */}
      {activeTab === 'backtest' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-bold mb-4">选择因子</h2>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => candidates.length > 0 && setShowDropdown(true)}
                placeholder="输入因子名称或描述关键字搜索..."
                className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              />
              {searching && (
                <div className="absolute right-3 top-3.5 text-gray-400 text-sm">搜索中...</div>
              )}

              {/* Dropdown */}
              {showDropdown && candidates.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-xl shadow-lg max-h-64 overflow-y-auto">
                  {candidates.map(f => (
                    <button
                      key={f.name}
                      onClick={() => {
                        toggleFactor(f.name)
                      }}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0 flex items-center justify-between ${
                        selectedFactors.includes(f.name) ? 'bg-emerald-50' : ''
                      }`}
                    >
                      <div>
                        <div className="font-medium text-sm">{f.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {f.category} · {f.logic_summary?.slice(0, 60)}
                        </div>
                      </div>
                      {selectedFactors.includes(f.name) && (
                        <span className="text-emerald-600 text-lg">✓</span>
                      )}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowDropdown(false)}
                    className="w-full py-2 text-center text-xs text-gray-400 hover:text-gray-600"
                  >
                    关闭列表
                  </button>
                </div>
              )}
            </div>

            {/* Selected factors */}
            {selectedFactors.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {selectedFactors.map(name => (
                  <span
                    key={name}
                    className="inline-flex items-center px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-sm"
                  >
                    {name}
                    <button
                      onClick={() => toggleFactor(name)}
                      className="ml-2 text-emerald-400 hover:text-emerald-600"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Start Button */}
            <button
              onClick={handleStartBacktest}
              disabled={backtestRunning || selectedFactors.length === 0}
              className="mt-6 w-full py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {backtestRunning ? `⏳ ${backtestStatus}` : `开始回测 (${selectedFactors.length} 个因子)`}
            </button>
          </div>

          {/* Progress */}
          {backtestRunning && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center space-x-3">
                <div className="animate-spin w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full" />
                <div>
                  <div className="font-medium text-amber-800">{backtestStatus}</div>
                  <div className="text-sm text-amber-600">已运行 {backtestElapsed} 秒 · 因子回测可能需要数分钟</div>
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          {Object.keys(backtestResults).length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border">
              <div className="p-4 border-b">
                <h3 className="font-bold">回测结果</h3>
              </div>

              {/* Factor tabs */}
              <div className="flex border-b overflow-x-auto">
                {Object.keys(backtestResults).map(factor => (
                  <button
                    key={factor}
                    onClick={() => loadReport(factor)}
                    className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                      activeReport === factor
                        ? 'text-emerald-600 border-emerald-600'
                        : 'text-gray-500 border-transparent hover:text-gray-700'
                    }`}
                  >
                    {factor}
                    {backtestResults[factor]?.success ? ' ✅' : ' ❌'}
                  </button>
                ))}
              </div>

              {/* Report content */}
              {activeReport && (
                <div className="p-4">
                  {loadingReport ? (
                    <div className="text-center py-8 text-gray-500">加载报告中...</div>
                  ) : (
                    <iframe
                      srcDoc={reportHtml}
                      className="w-full border-0 rounded-lg"
                      style={{ minHeight: '80vh' }}
                      title={`Report: ${activeReport}`}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =================== Iterate Tab =================== */}
      {activeTab === 'iterate' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-bold mb-4">选择因子进行迭代</h2>

            {/* Search or manual input */}
            <div className="relative">
              <input
                type="text"
                value={iterSearch || iterFactorName}
                onChange={(e) => {
                  setIterSearch(e.target.value)
                  setIterFactorName(e.target.value)
                }}
                onFocus={() => iterCandidates.length > 0 && setShowIterDropdown(true)}
                placeholder="输入因子名称或从列表中选择..."
                className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              />

              {showIterDropdown && iterCandidates.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-xl shadow-lg max-h-64 overflow-y-auto">
                  {iterCandidates.map(f => (
                    <button
                      key={f.name}
                      onClick={() => {
                        setIterFactorName(f.name)
                        setIterSearch(f.name)
                        setShowIterDropdown(false)
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0"
                    >
                      <div className="font-medium text-sm">{f.name}</div>
                      <div className="text-xs text-gray-500">{f.category} · {f.logic_summary?.slice(0, 60)}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Rounds selector */}
            <div className="mt-4 flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">迭代轮数：</label>
              <div className="flex space-x-2">
                {[1, 2, 3].map(r => (
                  <button
                    key={r}
                    onClick={() => setIterRounds(r)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      iterRounds === r
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {r} 轮{r === 3 ? ' (自动进化)' : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Start button */}
            <button
              onClick={handleStartIteration}
              disabled={iterRunning || !iterFactorName.trim()}
              className="mt-6 w-full py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {iterRunning ? `⏳ ${iterStatus}` : '开始迭代'}
            </button>
          </div>

          {/* Progress */}
          {iterRunning && (
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
              <div className="flex items-center space-x-3">
                <div className="animate-spin w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full" />
                <div>
                  <div className="font-medium text-violet-800">{iterStatus}</div>
                  <div className="text-sm text-violet-600">已运行 {iterElapsed} 秒</div>
                </div>
              </div>
            </div>
          )}

          {/* Iteration Results */}
          {iterResults && (
            <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
              <h3 className="font-bold text-lg">迭代结果</h3>

              {/* Metrics Table */}
              {iterResults.metrics && typeof iterResults.metrics === 'object' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-3 text-left font-medium text-gray-700 border">因子</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700 border">IC均值</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700 border">IC_T值</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700 border">多空年化</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700 border">夏普比率</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700 border">最大回撤</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700 border">胜率</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700 border">换手率</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(iterResults.metrics).map(([name, data]: [string, any]) => (
                        <tr key={name} className="hover:bg-gray-50">
                          <td className="px-4 py-3 border font-medium">{name}</td>
                          {data.Error ? (
                            <td colSpan={7} className="px-4 py-3 border text-red-500">{data.Error}</td>
                          ) : (
                            <>
                              <td className="px-4 py-3 border text-center">{data['IC均值']}</td>
                              <td className="px-4 py-3 border text-center">{data['IC_T值']}</td>
                              <td className="px-4 py-3 border text-center">{data['多空年化']}</td>
                              <td className="px-4 py-3 border text-center">{data['夏普比率']}</td>
                              <td className="px-4 py-3 border text-center">{data['最大回撤']}</td>
                              <td className="px-4 py-3 border text-center">{data['胜率']}</td>
                              <td className="px-4 py-3 border text-center">{data['多空换手率']}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tracking markdown */}
              {iterResults.tracking && (
                <div className="mt-4">
                  <h4 className="font-medium text-gray-700 mb-2">历史迭代追踪表</h4>
                  <pre className="bg-gray-50 p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
                    {iterResults.tracking}
                  </pre>
                </div>
              )}

              {/* Continue iteration button */}
              {iterResults.metrics && !iterResults.metrics.raw_output && (
                <div className="flex space-x-3 pt-4">
                  {Object.keys(iterResults.metrics)
                    .filter(k => !iterResults.metrics[k]?.Error)
                    .map(name => (
                      <button
                        key={name}
                        onClick={() => {
                          setIterFactorName(name)
                          setIterSearch(name)
                          setIterResults(null)
                        }}
                        className="px-4 py-2 bg-violet-100 text-violet-700 rounded-lg text-sm hover:bg-violet-200 transition-colors"
                      >
                        继续迭代 {name}
                      </button>
                    ))
                  }
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
