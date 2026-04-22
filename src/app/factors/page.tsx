'use client'

import { Suspense, useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { getFactorsIndex, startBacktest, getBacktestStatus, getBacktestReport, startIteration, getIterationStatus } from '@/lib/api'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Factor = {
  name: string
  category: string
  logic_summary: string
  data_fields: string[]
  backtested: boolean
  backtest_metrics: any
}

function FactorsContent() {
  const searchParams = useSearchParams()

  // Read URL query params for prefill
  const urlTab = searchParams.get('tab') as 'backtest' | 'iterate' | null
  const urlFactor = searchParams.get('factor')
  const urlCustomPrompt = searchParams.get('customPrompt')

  const [activeTab, setActiveTab] = useState<'backtest' | 'iterate'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('factor_lab_tab') as any) || urlTab || 'backtest'
    }
    return urlTab || 'backtest'
  })

  // ---- Backtest Tab State ----
  const [searchTerm, setSearchTerm] = useState('')
  const [candidates, setCandidates] = useState<Factor[]>([])
  const [selectedFactors, setSelectedFactors] = useState<string[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  // Backtest parameters
  const [startDate, setStartDate] = useState('2022-01-01')
  const [endDate, setEndDate] = useState('2024-12-31')
  const [groupNum, setGroupNum] = useState(10)
  const [benchmark, setBenchmark] = useState('中证500')
  const [neutralize, setNeutralize] = useState(true)

  const [backtestTaskId, setBacktestTaskId] = useState('')
  const [backtestStatus, setBacktestStatus] = useState<string>('')
  const [backtestElapsed, setBacktestElapsed] = useState(0)
  const [backtestResults, setBacktestResults] = useState<Record<string, any>>({})
  const [backtestRunning, setBacktestRunning] = useState(false)
  const [backtestLogs, setBacktestLogs] = useState<string[]>([])

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
  const [iterLogs, setIterLogs] = useState<string[]>([])
  const [iterCandidates, setIterCandidates] = useState<Factor[]>([])
  const [iterSearch, setIterSearch] = useState('')
  const [showIterDropdown, setShowIterDropdown] = useState(false)
  const [showBoardModal, setShowBoardModal] = useState(false)
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-lite-preview')

  const MODELS = [
    { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
  ]

  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const iterPollRef = useRef<NodeJS.Timeout | null>(null)
  const prefilled = useRef(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const iterDropdownRef = useRef<HTMLDivElement>(null)

  // Persist active tab
  useEffect(() => {
    localStorage.setItem('factor_lab_tab', activeTab)
  }, [activeTab])

  // Click outside to close factor lists
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
      if (iterDropdownRef.current && !iterDropdownRef.current.contains(event.target as Node)) {
        setShowIterDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Restore task IDs on mount
  useEffect(() => {
    const savedBacktestId = localStorage.getItem('backtest_task_id')
    const savedIterId = localStorage.getItem('iter_task_id')
    if (savedBacktestId && !backtestTaskId) {
      setBacktestTaskId(savedBacktestId)
      setBacktestRunning(true)
    }
    if (savedIterId && !iterTaskId) {
      setIterTaskId(savedIterId)
      setIterRunning(true)
    }
  }, [])

  // Force activeTab to sync with URL parameter if present
  useEffect(() => {
    if (urlTab === 'backtest' || urlTab === 'iterate') {
      setActiveTab(urlTab)
    }
  }, [urlTab])

  // ---- Prefill from URL query params ----
  useEffect(() => {
    if (prefilled.current || !urlFactor) return
    prefilled.current = true

    if (urlTab === 'iterate') {
      setIterFactorName(urlFactor)
      setIterSearch(urlFactor)
    } else {
      // Backtest tab: add the factor to selected list
      setSelectedFactors([urlFactor])
      setSearchTerm(urlFactor)
    }
  }, [urlFactor, urlTab])

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

  // Backtest Polling Effect
  useEffect(() => {
    if (!backtestTaskId) {
      localStorage.removeItem('backtest_task_id')
      return
    }
    localStorage.setItem('backtest_task_id', backtestTaskId)
    
    const poll = async () => {
      try {
        const res = await getBacktestStatus(backtestTaskId)
        if (res.success) {
          if (res.data.logs) setBacktestLogs(res.data.logs)
          setBacktestElapsed(res.data.elapsed)
          
          if (res.data.status === 'done') {
            setBacktestRunning(false)
            setBacktestTaskId('')
            setBacktestStatus('回测完成 ✅')
            if (res.data.results) setBacktestResults(res.data.results)
          } else if (res.data.status === 'error') {
            setBacktestRunning(false)
            setBacktestTaskId('')
            setBacktestStatus(`失败: ${res.data.error}`)
          } else {
            setBacktestStatus(`回测运行中... (${res.data.elapsed}s)`)
          }
        }
      } catch (e) {
        console.error('Polling error:', e)
      }
    }

    const interval = setInterval(poll, 2000)
    poll()
    return () => clearInterval(interval)
  }, [backtestTaskId])

  async function handleStartBacktest() {
    if (selectedFactors.length === 0) return
    setBacktestRunning(true)
    setBacktestResults({})
    setBacktestLogs([])
    setActiveReport('')
    setReportHtml('')

    try {
      const res = await startBacktest(selectedFactors, {
        startDate,
        endDate,
        groupNum,
        benchmark,
        neutralize,
        model: selectedModel
      })
      if (res.success && res.data?.taskId) {
        setBacktestTaskId(res.data.taskId)
      } else {
        setBacktestStatus(`启动错误: ${res.error || 'Unknown'}`)
        setBacktestRunning(false)
      }
    } catch (e) {
      setBacktestStatus('网络请求失败')
      setBacktestRunning(false)
    }
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

  // Iteration Polling Effect
  useEffect(() => {
    if (!iterTaskId) {
      localStorage.removeItem('iter_task_id')
      return
    }
    localStorage.setItem('iter_task_id', iterTaskId)

    const poll = async () => {
      try {
        const res = await getIterationStatus(iterTaskId)
        if (res.success) {
          if (res.data.logs) setIterLogs(res.data.logs)
          setIterElapsed(res.data.elapsed)
          
          if (res.data.status === 'done') {
            setIterRunning(false)
            setIterTaskId('')
            setIterStatus('因子迭代技能执行完成 ✅')
            if (res.data.results) {
              setIterResults(res.data.results)
            }
          } else if (res.data.status === 'error') {
            setIterRunning(false)
            setIterTaskId('')
            setIterStatus(`迭代失败: ${res.data.error}`)
          } else {
            setIterStatus(`因子迭代技能运行中... (${res.data.elapsed}s)`)
          }
        }
      } catch (e) {
        console.error('Iter polling error:', e)
      }
    }

    const interval = setInterval(poll, 2000)
    poll()
    return () => clearInterval(interval)
  }, [iterTaskId])

  async function handleStartIteration(customPrompt?: string) {
    const name = iterFactorName.trim()
    if (!name) return
    setIterRunning(true)
    setIterResults(null)
    setIterLogs([])
    setIterStatus('启动因子迭代技能...')

    try {
      const res = await startIteration([name], iterRounds, {
        startDate,
        endDate,
        groupNum,
        benchmark,
        neutralize
      }, selectedModel, customPrompt)
      if (res.success && res.data?.taskId) {
        setIterTaskId(res.data.taskId)
      } else {
        setIterStatus(`启动错误: ${res.error || 'Unknown'}`)
        setIterRunning(false)
      }
    } catch (e) {
      setIterStatus('网络请求失败')
      setIterRunning(false)
    }
  }

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
            <div className="relative" ref={dropdownRef}>
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
          </div>

          {/* Backtest Parameters */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-bold mb-4">回测参数</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分组数</label>
                <select
                  value={groupNum}
                  onChange={(e) => setGroupNum(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value={5}>5 组</option>
                  <option value={10}>10 组（默认）</option>
                  <option value={20}>20 组</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">基准指数</label>
                <select
                  value={benchmark}
                  onChange={(e) => setBenchmark(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="中证500">中证500</option>
                  <option value="沪深300">沪深300</option>
                  <option value="中证1000">中证1000</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">AI 模型 (报告增强)</label>
                <input
                  list="model-list"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  placeholder="选择或输入模型名称..."
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <datalist id="model-list">
                  {MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </datalist>
              </div>
            </div>
            <div className="flex items-center mt-4 space-x-6">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={neutralize}
                  onChange={(e) => setNeutralize(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-700">行业市值中性化</span>
              </label>
            </div>
          </div>

          {/* Start Button */}
          <button
            onClick={handleStartBacktest}
            disabled={backtestRunning || selectedFactors.length === 0}
            className="w-full py-3.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors text-base"
          >
            {backtestRunning ? `⏳ ${backtestStatus}` : `开始回测 (${selectedFactors.length} 个因子)`}
          </button>

          {/* Progress & Logs */}
          {(backtestRunning || backtestLogs.length > 0) && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
                <div className="flex items-center space-x-3">
                  <div className={`w-4 h-4 rounded-full ${backtestRunning ? 'border-2 border-emerald-500 border-t-transparent animate-spin' : 'bg-emerald-500'}`} />
                  <div>
                    <div className="font-medium text-emerald-400 text-sm">{backtestStatus}</div>
                    <div className="text-xs text-gray-400">已运行 {backtestElapsed} 秒 · 因子回测可能需要数分钟</div>
                  </div>
                </div>
                {!backtestRunning && selectedFactors.length === 1 && (
                  <button
                    onClick={() => loadReport(selectedFactors[0])}
                    className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700 transition-colors"
                  >
                    📊 查看回测报告
                  </button>
                )}
              </div>
              <div className="p-4 overflow-y-auto max-h-96 min-h-[16rem] bg-black">
                <pre className="text-left text-xs text-green-400 font-mono whitespace-pre-wrap break-all">
                  {backtestLogs.length === 0 ? '正在初始化执行引擎...' : backtestLogs.join('')}
                </pre>
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
            <h2 className="text-lg font-bold mb-2">选择因子进行 AI 进化迭代</h2>
            <p className="text-sm text-gray-500 mb-4">基于 Gemini AI 读取回测报告，自动生成多个改进版因子表达式，写入代码库并运行快速回测对比</p>

            {/* Search or manual input */}
            <div className="relative" ref={iterDropdownRef}>
              <input
                type="text"
                value={iterSearch}
                onChange={(e) => {
                  setIterSearch(e.target.value)
                  setIterFactorName(e.target.value)
                  setShowIterDropdown(true)
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

            {/* Model selector for iteration */}
            <div className="mt-4 flex flex-col space-y-2">
              <label className="text-sm font-medium text-gray-700">AI 进化模型：</label>
              <div className="flex flex-col space-y-2">
                <div className="flex flex-wrap gap-2">
                  {MODELS.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedModel(m.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                        selectedModel === m.id
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
                <input
                  list="model-list-iter"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  placeholder="或手动输入模型名称..."
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <datalist id="model-list-iter">
                  {MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </datalist>
              </div>
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
              onClick={() => handleStartIteration(urlCustomPrompt || undefined)}
              disabled={iterRunning || !iterFactorName.trim()}
              className="mt-6 w-full py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {iterRunning ? `⏳ ${iterStatus}` : `🧬 开始 AI 进化迭代 (${iterRounds} 轮)`}
            </button>
          </div>

          {/* Iteration Progress & Logs */}
          {(iterRunning || iterLogs.length > 0) && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
              <div className="flex items-center space-x-3 px-4 py-3 bg-gray-800 border-b border-gray-700">
                <div className={`w-4 h-4 rounded-full ${iterRunning ? 'border-2 border-violet-500 border-t-transparent animate-spin' : 'bg-violet-500'}`} />
                <div>
                  <div className="font-medium text-violet-400 text-sm">{iterStatus}</div>
                  <div className="text-xs text-gray-400">已运行 {iterElapsed} 秒 · 因子迭代与快速回测中</div>
                </div>
              </div>
              <div className="p-4 overflow-y-auto max-h-96 min-h-[16rem] bg-black">
                <pre className="text-left text-xs text-violet-400 font-mono whitespace-pre-wrap break-all">
                  {iterLogs.length === 0 ? '正在初始化执行引擎...' : iterLogs.join('')}
                </pre>
              </div>
            </div>
          )}

          {/* Iteration Results */}
          {iterResults && (
            <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg">迭代结果</h3>
                {iterResults.boardHtml && (
                  <button
                    onClick={() => setShowBoardModal(true)}
                    className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium transition-colors flex items-center space-x-2"
                  >
                    <span>🌳</span> <span>查看进化族谱看板</span>
                  </button>
                )}
              </div>

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

              {/* Tracking table */}
              {iterResults.tracking && (() => {
                // Parse markdown table into structured data
                const lines = iterResults.tracking.split('\n').filter((l: string) => l.trim().startsWith('|') && !l.trim().startsWith('| :---'))
                if (lines.length < 2) return null
                const parseRow = (line: string) => line.split('|').slice(1, -1).map((c: string) => c.trim())
                const headers = parseRow(lines[0])
                const rows = lines.slice(1).map(parseRow)
                
                return (
                  <div className="mt-6">
                    <h4 className="font-medium text-gray-700 mb-2">历史迭代追踪表</h4>
                    <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs" style={{ minWidth: '1400px', tableLayout: 'fixed' }}>
                          <colgroup>
                            <col style={{ width: '100px' }} /> {/* 时间 */}
                            <col style={{ width: '160px' }} /> {/* 原始因子 */}
                            <col style={{ width: '180px' }} /> {/* 迭代因子 */}
                            <col style={{ width: '180px' }} /> {/* 改进原理 */}
                            <col style={{ width: '120px' }} /> {/* IC均值对比 */}
                            <col style={{ width: '100px' }} /> {/* IC_T值对比 */}
                            <col style={{ width: '110px' }} /> {/* 多空年化对比 */}
                            <col style={{ width: '110px' }} /> {/* 多空夏普对比 */}
                            <col style={{ width: '120px' }} /> {/* 最大回撤对比 */}
                            <col style={{ width: '100px' }} /> {/* 胜率对比 */}
                            <col style={{ width: '110px' }} /> {/* 多空换手率对比 */}
                            <col style={{ width: '90px' }} />  {/* 改进效果综合定性 */}
                          </colgroup>
                          <thead>
                            <tr className="bg-gray-50">
                              {headers.map((h: string, i: number) => (
                                <th key={i} className="px-2 py-2.5 text-left font-semibold text-gray-700 border-b text-[11px] overflow-hidden text-ellipsis">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row: string[], ri: number) => (
                              <tr key={ri} className="hover:bg-gray-50/60 border-b last:border-b-0">
                                {row.map((cell: string, ci: number) => {
                                  const isReason = ci === 3
                                  const isFactorName = ci === 1 || ci === 2
                                  const isQualitative = ci === headers.length - 1
                                  return (
                                    <td
                                      key={ci}
                                      className={`px-2 py-2.5 border-b overflow-hidden text-ellipsis ${isReason ? 'bg-amber-50/30' : ''}`}
                                      title={cell}
                                    >
                                      {isReason ? (
                                        <div className="flex items-start gap-1.5 min-w-[200px]">
                                          <span className="mt-0.5 flex-shrink-0 text-amber-500">💡</span>
                                          <span className="text-[11px] text-gray-700 leading-relaxed italic">{cell}</span>
                                        </div>
                                      ) : isFactorName ? (
                                        <div className="flex items-center gap-1.5">
                                          {ci === 2 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
                                          <span className={`block truncate text-[11px] font-mono ${ci === 2 ? 'font-bold text-emerald-700' : 'text-gray-500'}`}>{cell}</span>
                                        </div>
                                      ) : isQualitative ? (
                                        <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                                          cell.includes('显著') || cell.includes('高度成功') ? 'bg-green-100 text-green-700' :
                                          cell.includes('改善') || cell.includes('微小提升') ? 'bg-blue-100 text-blue-700' :
                                          cell.includes('持平') ? 'bg-yellow-100 text-yellow-700' :
                                          cell.includes('下降') || cell.includes('恶化') ? 'bg-red-100 text-red-700' :
                                          'bg-gray-100 text-gray-600'
                                        }`}>{cell}</span>
                                      ) : (
                                        <span className={`block whitespace-nowrap text-[11px] ${ci >= 4 ? 'font-mono text-center' : 'text-gray-600'}`}>{cell}</span>
                                      )}
                                    </td>
                                  )
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )
              })()}

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
          {/* Board Modal */}
          {showBoardModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl">
                <div className="flex justify-between items-center p-4 border-b">
                  <h3 className="font-bold text-lg text-gray-900">🧬 因子进化血统看板</h3>
                  <button
                    onClick={() => setShowBoardModal(false)}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <span className="text-xl">✕</span>
                  </button>
                </div>
                <div className="flex-1 overflow-auto bg-gray-50 p-4">
                  <iframe
                    srcDoc={iterResults.boardHtml}
                    className="w-full h-full border-0 rounded-xl bg-white shadow-inner"
                    style={{ minHeight: '75vh' }}
                    title="Factor Evolution Board"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function FactorsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">加载实验室中...</div>}>
      <FactorsContent />
    </Suspense>
  )
}
