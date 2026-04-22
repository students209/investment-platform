'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { startStrategyIteration, getStrategyIterationStatus, getStrategyLineage } from '@/lib/api'

interface StrategyReport {
  factorName: string
  reportFile: string
  createdAt: string
  fileSize: number
  isIterated?: boolean
  rootFactor?: string
  kpiSummary?: Record<string, any> | null
  description?: string
}

interface LineageEntry {
  name: string
  parent: string
  root: string
  round: number
  variant: string
  createdAt: string
  kpi?: Record<string, any>
  improvementSummary?: string
  logicSummary?: string
}

interface TradeRecord {
  证券名称: string
  证券代码: string
  买入时间: string
  卖出时间: string
  买入成本: string
  卖出价格: string
  交易数量: string
  盈亏金额: string
  收益率: string
  备注?: string
}

const LOCAL_API = process.env.NEXT_PUBLIC_NEXT_API_URL || ''

// Specialized descriptions for previous strategies (requested by user)
const STRATEGY_DESCRIPTIONS: Record<string, string> = {
  'alpha_6002_v2a': '高进攻性 Alpha 策略，侧重于捕捉多维动量特征下的高盈亏比波段机会。',
  'alpha_6002_v2b': '侧重收益增强，通过放宽介入阈值并引入激进进场信号以博取更强爆发力。',
  'alpha_6002_v2c': '侧重稳健性，引入严苛的最大回撤约束与行业风险中性化处理。',
  'alpha_6002_v3a': '防御扩展版：强化风险控制，严格约束回撤。',
  'alpha_6002_v3b': '进攻增强版：放宽阈值，积极捕捉趋势收益。',
  'alpha_6002_v3c': '稳健均衡版：引入中性化过滤，稳定持仓控制。'
}

export default function StrategiesPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-16 text-center text-gray-500">加载中...</div>}>
      <StrategiesContent />
    </Suspense>
  )
}

function StrategiesContent() {
  const searchParams = useSearchParams()
  const initialFactor = searchParams.get('factor') || ''

  // Core states
  const [reports, setReports] = useState<StrategyReport[]>([])
  const [loading, setLoading] = useState(false)
  const [filterTab, setFilterTab] = useState<'all' | 'original' | 'iterated'>('all')

  // Backtest panel
  const [showBacktest, setShowBacktest] = useState(!!initialFactor)
  const [factorName, setFactorName] = useState(initialFactor)
  const [startDate, setStartDate] = useState('2022-01-01')
  const [endDate, setEndDate] = useState('2024-12-31')
  const [holdCount, setHoldCount] = useState(5)
  const [rebalanceDays, setRebalanceDays] = useState(5)
  const [btModel, setBtModel] = useState('gemini-3.1-flash-lite-preview')
  const [backtesting, setBacktesting] = useState(false)
  const [taskId, setTaskId] = useState('')
  const [logs, setLogs] = useState<string[]>([])
  const [btStatus, setBtStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const logEndRef = useRef<HTMLDivElement>(null)

  // Report modal
  const [reportModal, setReportModal] = useState(false)
  const [reportHtml, setReportHtml] = useState('')

  // Iteration State
  const [iterTaskId, setIterTaskId] = useState('')
  const [iterStatus, setIterStatus] = useState('')
  const [iterRunning, setIterRunning] = useState(false)
  const [iterElapsed, setIterElapsed] = useState(0)
  const [iterLogs, setIterLogs] = useState<string[]>([])
  const [iterRounds, setIterRounds] = useState(1)
  const [iterResults, setIterResults] = useState<any>(null)
  const [showIterBoard, setShowIterBoard] = useState(false)
  const [lineageData, setLineageData] = useState<LineageEntry[]>([])
  const [lineageRoot, setLineageRoot] = useState('')

  const [reportFactor, setReportFactor] = useState('')
  const [loadingReport, setLoadingReport] = useState(false)

  // Trade details modal
  const [tradesModal, setTradesModal] = useState(false)
  const [trades, setTrades] = useState<TradeRecord[]>([])
  const [loadingTrades, setLoadingTrades] = useState(false)
  const [tradeSortBy, setTradeSortBy] = useState<'time' | 'name' | 'pnl'>('time')
  const [tradeSortAsc, setTradeSortAsc] = useState(true)
  const [tradeSearch, setTradeSearch] = useState('')

  // Custom strategy panel
  const [showCustom, setShowCustom] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customDesc, setCustomDesc] = useState('')
  const [customModel, setCustomModel] = useState('gemini-3.1-flash-lite-preview')
  const [customCode, setCustomCode] = useState('')
  const [generatingCode, setGeneratingCode] = useState(false)
  const [customFactorName, setCustomFactorName] = useState('')

  // Interactive iteration modal
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
    const prompt = iterModalMode === 'interactive' ? iterModalPrompt.trim() : undefined
    handleStartIteration(iterModalFactor, true, prompt)
  }

  // Load strategy list
  const loadStrategies = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${LOCAL_API}/api/strategy/backtest?list=true`)
      const json = await res.json()
      if (json.success) {
        // Apply manual descriptions to previous strategies
        const enrichedReports = (json.data.reports || []).map((r: StrategyReport) => ({
          ...r,
          description: STRATEGY_DESCRIPTIONS[r.factorName] || r.description
        }))
        setReports(enrichedReports)
      }
    } catch (e) {
      console.error('Failed to load strategies:', e)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadStrategies() }, [loadStrategies])

  useEffect(() => {
    if (logEndRef.current && logEndRef.current.parentElement) {
      logEndRef.current.parentElement.scrollTop = logEndRef.current.parentElement.scrollHeight
    }
  }, [logs])

  // Poll backtest status
  useEffect(() => {
    if (!taskId || btStatus !== 'running') return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${LOCAL_API}/api/strategy/backtest?taskId=${taskId}`)
        const json = await res.json()
        if (json.success) {
          setLogs(json.data.logs || [])
          if (json.data.status === 'done') {
            setBtStatus('done')
            setBacktesting(false)
            loadStrategies()
          } else if (json.data.status === 'error') {
            setBtStatus('error')
            setBacktesting(false)
          }
        }
      } catch {}
    }, 1500)
    return () => clearInterval(interval)
  }, [taskId, btStatus, loadStrategies])

  // Poll iteration status
  useEffect(() => {
    if (!iterTaskId || iterStatus === 'done' || iterStatus.startsWith('error') || iterStatus.startsWith('失败')) return
    const interval = setInterval(async () => {
      try {
        const res = await getStrategyIterationStatus(iterTaskId)
        if (res.success) {
          if (res.data.logs) setIterLogs(res.data.logs)
          setIterElapsed(res.data.elapsed)
          if (res.data.status === 'done') {
            setIterRunning(false)
            setIterTaskId('')
            setIterStatus('done')
            if (res.data.results) setIterResults(res.data.results)
            loadStrategies()
          } else if (res.data.status === 'error') {
            setIterRunning(false)
            setIterTaskId('')
            setIterStatus('error: ' + res.data.error)
            if (res.data.results) setIterResults(res.data.results)
            loadStrategies()
          } else {
            setIterStatus('running')
          }
        }
      } catch {}
    }, 2000)
    return () => clearInterval(interval)
  }, [iterTaskId, iterStatus, loadStrategies])

  async function loadLineage(rootFactor: string) {
    try {
      const res = await getStrategyLineage(rootFactor)
      if (res.success) {
        setLineageData(res.data.lineage || [])
        setLineageRoot(rootFactor)
        setShowIterBoard(true)
      }
    } catch {
      console.error('Failed to load lineage')
    }
  }

  async function handleStartBacktest() {
    if (!factorName.trim()) return
    setBacktesting(true)
    setBtStatus('running')
    setLogs(['[系统] 正在启动回测任务...'])
    try {
      const res = await fetch(`${LOCAL_API}/api/strategy/backtest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          factorName: factorName.trim(),
          startDate,
          endDate,
          holdCount,
          rebalanceDays,
          model: btModel,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setTaskId(json.data.taskId)
      } else {
        setBtStatus('error')
        setBacktesting(false)
        setLogs(prev => [...prev, `[系统] ❌ ${json.error}`])
      }
    } catch (e: any) {
      setBtStatus('error')
      setBacktesting(false)
      setLogs(prev => [...prev, `[系统] ❌ 请求失败: ${e.message}`])
    }
  }

  async function handleStartIteration(factorName: string, closeOverlays = true, customPrompt?: string) {
    if (!factorName) return
    if (closeOverlays) {
      setReportModal(false)
      setShowIterBoard(false)
    }
    
    setIterRunning(true)
    setIterTaskId('')
    setIterLogs([])
    setIterResults(null)
    setIterStatus('running')
    setIterElapsed(0)

    try {
      const res = await startStrategyIteration(factorName, iterRounds, {
        startDate, endDate, holdCount, rebalanceDays
      }, customModel, customPrompt)
      
      if (res.success && res.data.taskId) {
        setIterTaskId(res.data.taskId)
        window.scrollTo({top: 0, behavior: 'smooth'})
      } else {
        setIterRunning(false)
        setIterStatus('error: ' + (res.error || 'Unknown'))
      }
    } catch(e: any) {
      setIterRunning(false)
      setIterStatus('error: 请求失败 ' + e.message)
    }
  }

  async function viewReport(factor: string) {
    setReportFactor(factor)
    setReportModal(true)
    setLoadingReport(true)
    setTimeout(() => setLoadingReport(false), 300)
  }

  async function viewTrades(factor: string) {
    setTradesModal(true)
    setLoadingTrades(true)
    setTradeSearch('')
    try {
      const res = await fetch(`${LOCAL_API}/api/strategy/backtest?trades=${encodeURIComponent(factor)}`)
      const json = await res.json()
      if (json.success) {
        setTrades(json.data.trades || [])
      } else {
        setTrades([])
      }
    } catch {
      setTrades([])
    }
    setLoadingTrades(false)
  }

  async function handleGenerateCode() {
    if (!customName.trim() || !customDesc.trim()) return
    setGeneratingCode(true)
    setCustomCode('')
    try {
      const res = await fetch(`${LOCAL_API}/api/strategy/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyName: customName.trim(),
          strategyDescription: customDesc.trim(),
          model: customModel,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setCustomCode(json.data.code)
        setCustomFactorName(json.data.factorName)
      } else {
        setCustomCode(`# 生成失败: ${json.error}`)
      }
    } catch (e: any) {
      setCustomCode(`# 请求失败: ${e.message}`)
    }
    setGeneratingCode(false)
  }

  async function handleCustomBacktest() {
    if (!customFactorName) return
    setFactorName(customFactorName)
    // Start backtest directly (inline, no panel switch)
    setBacktesting(true)
    setBtStatus('running')
    setLogs(['[系统] 正在启动回测任务...', `[系统] 因子名称: ${customFactorName}`])
    window.scrollTo({top: 0, behavior: 'smooth'})

    try {
      const res = await fetch(`${LOCAL_API}/api/strategy/backtest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          factorName: customFactorName,
          startDate,
          endDate,
          holdCount,
          rebalanceDays,
          model: btModel,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setTaskId(json.data.taskId)
      } else {
        setBtStatus('error')
        setBacktesting(false)
        setLogs(prev => [...prev, `[系统] ❌ ${json.error}`])
      }
    } catch (e: any) {
      setBtStatus('error')
      setBacktesting(false)
      setLogs(prev => [...prev, `[系统] ❌ 请求失败: ${e.message}`])
    }
  }

  const filteredTrades = trades
    .filter(t => {
      if (!tradeSearch) return true
      const searchLower = tradeSearch.toLowerCase()
      return (
        (t.证券名称 || '').toLowerCase().includes(searchLower) ||
        (t.证券代码 || '').toLowerCase().includes(searchLower)
      )
    })
    .sort((a, b) => {
      let cmp = 0
      if (tradeSortBy === 'time') cmp = (a.卖出时间 || '').localeCompare(b.卖出时间 || '')
      else if (tradeSortBy === 'name') cmp = (a.证券名称 || '').localeCompare(b.证券名称 || '')
      else if (tradeSortBy === 'pnl') cmp = parseFloat(a.盈亏金额 || '0') - parseFloat(b.盈亏金额 || '0')
      return tradeSortAsc ? cmp : -cmp
    })

  function toggleSort(key: 'time' | 'name' | 'pnl') {
    if (tradeSortBy === key) setTradeSortAsc(!tradeSortAsc)
    else { setTradeSortBy(key); setTradeSortAsc(key === 'time') }
  }

  // Count strategies for filter tabs
  const countAll = reports.length
  const countOriginal = reports.filter(r => !r.isIterated).length
  const countIterated = reports.filter(r => r.isIterated).length

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">📊 策略报告</h1>
          <p className="text-gray-500 mt-1">共 {reports.length} 个已完成的策略回测报告</p>
        </div>
        <div className="flex space-x-3">
          <button onClick={() => { setShowBacktest(!showBacktest); setShowCustom(false) }} className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${showBacktest ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>🧪 因子回测</button>
          <button onClick={() => { setShowCustom(!showCustom); setShowBacktest(false) }} className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${showCustom ? 'bg-violet-100 text-violet-800 border border-violet-300' : 'bg-violet-600 text-white hover:bg-violet-700'}`}>🤖 AI 迭代</button>
        </div>
      </div>

      {/* Backtest Panel */}
      {showBacktest && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">🧪 策略回测参数</h2>
          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
            <div className="md:col-span-2 lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">因子名称 *</label>
              <input type="text" value={factorName} onChange={(e) => setFactorName(e.target.value)} placeholder="例如: alpha_6042" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">持仓数量</label>
              <input type="number" value={holdCount} onChange={(e) => setHoldCount(Number(e.target.value))} min={1} max={50} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">调仓频率</label>
              <input type="number" value={rebalanceDays} onChange={(e) => setRebalanceDays(Number(e.target.value))} min={1} max={60} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">AI 迭代模型</label>
              <input type="text" value={btModel} onChange={(e) => setBtModel(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
            </div>
          </div>
          <button onClick={handleStartBacktest} disabled={backtesting || !factorName.trim()} className="px-8 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium shadow-sm active:scale-95 transition-all">{backtesting ? '回测运行中...' : '🚀 开始回测'}</button>
        </div>
      )}

      {/* Custom Strategy Panel */}
      {showCustom && (
        <div className="bg-white rounded-xl shadow-sm border border-violet-200 p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">🤖 AI 自定义策略</h2>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <input type="text" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="策略名称" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
            <input type="text" value={customModel} onChange={(e) => setCustomModel(e.target.value)} placeholder="AI 模型" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
          </div>
          <textarea value={customDesc} onChange={(e) => setCustomDesc(e.target.value)} placeholder="描述策略逻辑，AI 将自动编写代码..." className="w-full h-28 px-3 py-2.5 border border-gray-300 rounded-lg text-sm mb-4 resize-none focus:ring-2 focus:ring-violet-500 outline-none" />
          <button onClick={handleGenerateCode} disabled={generatingCode} className="px-6 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-bold transition-all">{generatingCode ? '正在生成代码...' : '✨ AI 生成策略代码'}</button>
          {customCode && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-bold text-gray-700">📝 生成代码 ({customFactorName})</span>
                <button onClick={handleCustomBacktest} className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-sm shadow-sm">🚀 直接回测</button>
              </div>
              <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs max-h-[300px] overflow-auto leading-relaxed border border-gray-700">{customCode}</pre>
            </div>
          )}
        </div>
      )}

      {/* Log Panels */}
      {(logs.length > 0 && btStatus !== 'idle') || iterRunning || iterStatus === 'done' ? (
        <div className="bg-gray-900 rounded-xl shadow-lg border border-gray-700 mb-8 overflow-hidden">
          <div className="px-4 py-2 bg-gray-800 text-sm text-gray-300 border-b border-gray-700 flex justify-between items-center">
            <span>实时任务日志 ({iterRunning ? '迭代中' : '回测中'})</span>
            {iterElapsed > 0 && <span className="text-[10px] bg-violet-900/50 text-violet-300 px-2 py-0.5 rounded-full border border-violet-800">计时: {iterElapsed}s</span>}
          </div>
          <div className="p-4 max-h-[250px] overflow-y-auto font-mono text-xs text-emerald-400/80">
            {(iterRunning || iterStatus === 'done' ? iterLogs : logs).map((L, i) => <div key={i}>{L}</div>)}
            <div ref={logEndRef} />
          </div>
        </div>
      ) : null}

      {/* Main Reports Grid Header & Tabs */}
      <div className="mb-6 flex space-x-1 bg-gray-100/50 w-fit rounded-xl p-1.5 border border-gray-200 shadow-sm">
          <button onClick={() => setFilterTab('all')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${filterTab === 'all' ? 'bg-white shadow-sm text-gray-900 ring-1 ring-gray-100' : 'text-gray-500 hover:text-gray-700'}`}>全部 <span className="ml-1 opacity-40 font-mono">({countAll})</span></button>
          <button onClick={() => setFilterTab('original')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${filterTab === 'original' ? 'bg-white shadow-sm text-gray-900 ring-1 ring-gray-100' : 'text-gray-500 hover:text-gray-700'}`}>原始策略 <span className="ml-1 opacity-40 font-mono">({countOriginal})</span></button>
          <button onClick={() => setFilterTab('iterated')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${filterTab === 'iterated' ? 'bg-white shadow-sm text-gray-900 ring-1 ring-gray-100' : 'text-gray-500 hover:text-gray-700'}`}>已迭代 <span className="ml-1 opacity-40 font-mono">({countIterated})</span></button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.filter(r => filterTab === 'all' ? true : filterTab === 'original' ? !r.isIterated : r.isIterated).map(r => (
          <div key={r.factorName} className={`bg-white rounded-2xl shadow-sm border p-6 hover:shadow-md transition-shadow group relative overflow-hidden ${r.isIterated ? 'border-l-4 border-l-violet-500' : ''}`}>
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-extrabold text-gray-900 truncate pr-2 text-lg" title={r.factorName}>{r.factorName}</h3>
              <span className={`px-2.5 py-1 text-[10px] rounded-full font-black uppercase tracking-widest ${r.isIterated ? 'bg-violet-50 text-violet-700' : 'bg-emerald-50 text-emerald-700'}`}>{r.isIterated ? '迭代' : '原始'}</span>
            </div>
            <p className="text-gray-400 text-[11px] mb-4 font-mono font-medium">{(r.fileSize / 1024).toFixed(0)} KB · {new Date(r.createdAt).toLocaleDateString()}</p>
            <p className="text-gray-600 text-sm mb-5 leading-relaxed h-[40px] line-clamp-2">{r.description || (r.isIterated ? '基于上一代衍生演进扩展的子策略。' : '基于多因子分析生成的原始核心策略。')}</p>
            
            {r.kpiSummary && (
              <div className="grid grid-cols-3 gap-2 mb-5 py-2.5 px-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="text-center text-[11px]"><div className="text-[9px] text-gray-400 font-bold uppercase">策略收益</div><div className={`font-black ${(parseFloat(r.kpiSummary['01_策略收益'] || '0') >= 0) ? 'text-green-600' : 'text-red-600'}`}>{(parseFloat(r.kpiSummary['01_策略收益']) * 100).toFixed(1)}%</div></div>
                <div className="text-center text-[11px] border-x border-gray-200"><div className="text-[9px] text-gray-400 font-bold uppercase">胜率</div><div className="font-black text-gray-700">{(parseFloat(r.kpiSummary['08_胜率']) * 100).toFixed(1)}%</div></div>
                <div className="text-center text-[11px]"><div className="text-[9px] text-gray-400 font-bold uppercase">最大回撤</div><div className="font-black text-orange-600">{(parseFloat(r.kpiSummary['10_最大回撤']) * 100).toFixed(1)}%</div></div>
              </div>
            )}

            <div className="flex gap-2 pt-4 border-t border-gray-100">
              <button onClick={() => viewReport(r.factorName)} className="flex-1 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-black shadow-sm transition-all hover:bg-emerald-700 active:scale-95 text-center flex items-center justify-center gap-1.5">📊 报告</button>
              <button onClick={() => viewTrades(r.factorName)} className="p-2 border-2 border-gray-100 rounded-lg text-gray-400 hover:bg-gray-50 transition-all font-bold">📋</button>
              <button onClick={() => openIterModal(r.factorName)} className="p-2 border-2 border-violet-100 text-violet-300 hover:bg-violet-50 hover:text-violet-600 rounded-lg font-bold transition-all disabled:opacity-40">🧬</button>
              <button onClick={() => loadLineage(r.rootFactor || r.factorName)} className="p-2 border-2 border-fuchsia-100 text-fuchsia-300 hover:bg-fuchsia-50 hover:text-fuchsia-600 rounded-lg font-bold transition-all">🌳</button>
              <button onClick={() => { setFactorName(r.factorName); setShowBacktest(true); window.scrollTo({top:0, behavior:'smooth'}); }} className="p-2 border-2 border-emerald-100 text-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg font-bold transition-all">🔄</button>
            </div>
          </div>
        ))}
      </div>

      {/* Evolutionary Lineage Board */}
      {showIterBoard && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-7xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden border border-white">
            <div className="flex justify-between items-center p-6 bg-white border-b relative z-20">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center text-white text-xl shadow-lg shadow-violet-100">🌳</div>
                <div>
                  <h2 className="text-xl font-black text-gray-900">策略进化血缘谱系看板</h2>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Evolution Path — {lineageRoot}</p>
                </div>
              </div>
              <button onClick={() => setShowIterBoard(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors text-xl font-bold">✕</button>
            </div>
            
            <div className="flex-1 overflow-auto p-10 bg-gray-50">
              <div className="flex flex-col items-center">
                
                {/* Redesigned Root Node (Screenshot 3 Style) */}
                <div className="bg-gradient-to-b from-white to-violet-50/30 border-[3px] border-violet-200 p-10 rounded-3xl shadow-xl mb-8 relative w-[420px] text-center transition-all hover:shadow-2xl hover:border-violet-400 group">
                  <div className="absolute -top-px left-0 right-0 h-1 bg-gradient-to-r from-violet-400 via-purple-500 to-violet-400 rounded-t-3xl"></div>
                  <div className="text-gray-400 text-xs font-black mb-4 uppercase tracking-[0.25em]">母本策略 (0代)</div>
                  <div className="font-mono font-black text-violet-600 text-3xl mb-8 tracking-tight group-hover:text-violet-700 transition-colors">{lineageRoot}</div>
                  
                  <div className="flex gap-4 px-2">
                    <button onClick={() => viewReport(lineageRoot)} className="flex-1 py-3.5 bg-white text-violet-600 border-2 border-violet-100 rounded-xl text-sm font-black transition-all hover:bg-violet-50 hover:border-violet-200 active:scale-95 shadow-sm">查看报告</button>
                    <button onClick={() => openIterModal(lineageRoot)} className="flex-1 py-3.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl text-sm font-black transition-all hover:from-violet-700 hover:to-purple-700 active:scale-95 shadow-lg shadow-violet-200 flex items-center justify-center gap-2">
                      <span className="text-lg">🧬</span> 迭代
                    </button>
                  </div>
                </div>

                {/* Connector line from root */}
                <div className="flex justify-center mb-8"><div className="w-0.5 h-16 bg-gradient-to-b from-violet-300 to-violet-100"></div></div>

                <div className="space-y-16 w-full">
                  {(() => {
                    if (!lineageData.length) return <div className="text-center py-20 text-gray-400 font-bold">暂无进化分支数据</div>
                    
                    const levelMap = new Map<string, number>()
                    levelMap.set(lineageRoot, 0)
                    
                    let currentLevelNodes = [lineageRoot]
                    let depthCounter = 1
                    let nodesProcessed = new Set([lineageRoot])
                    
                    while (currentLevelNodes.length > 0 && depthCounter < 100) {
                      const nextLevelNodes: string[] = []
                      lineageData.forEach(entry => {
                        if (currentLevelNodes.includes(entry.parent) && !nodesProcessed.has(entry.name)) {
                          levelMap.set(entry.name, depthCounter)
                          nextLevelNodes.push(entry.name)
                          nodesProcessed.add(entry.name)
                        }
                      })
                      if (nextLevelNodes.length === 0) break
                      currentLevelNodes = nextLevelNodes
                      depthCounter++
                    }
                    
                    const entriesWithLevel = lineageData.map(e => ({ ...e, depth: levelMap.get(e.name) || 1 }))
                    const maxDepth = entriesWithLevel.length > 0 ? Math.max(...entriesWithLevel.map(e => e.depth)) : 0
                    
                    return Array.from({ length: maxDepth }).map((_, i) => i + 1).map(depth => {
                      const roundEntries = entriesWithLevel.filter(e => e.depth === depth)
                      if (roundEntries.length === 0) return null
                      
                      return (
                        <div key={depth} className="w-full">
                          <div className="flex justify-center mb-6"><div className="w-0.5 h-16 bg-gradient-to-b from-violet-200 to-gray-200"></div></div>
                          <div className="text-center mb-10"><span className="px-8 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-full text-sm font-black shadow-lg shadow-violet-200 tracking-widest">第 {depth} 代迭代结果</span></div>
                          
                          <div className="flex flex-col gap-14 w-full">
                            {Object.entries(
                              roundEntries.reduce((acc, current) => {
                                if (!acc[current.parent]) acc[current.parent] = [];
                                acc[current.parent].push(current);
                                return acc;
                              }, {} as Record<string, typeof roundEntries>)
                            ).map(([parentName, parentChildEntries]) => (
                              <div key={parentName} className="flex flex-col items-center w-full">
                                <div className="text-[11px] text-violet-600 font-black mb-6 px-4 py-2 bg-white rounded-full border border-violet-100 shadow-sm flex items-center gap-2">
                                  <span className="opacity-40 text-[9px]">DERIVED FROM:</span>
                                  <span className="font-mono text-gray-900 border-b border-violet-200">{parentName}</span>
                                </div>
                                <div className="flex justify-center gap-8 flex-wrap w-full px-4">
                                  {parentChildEntries.map(entry => (
                                    <div key={entry.name} className="w-80 bg-white border border-gray-100 rounded-2xl shadow-md p-6 hover:shadow-xl transition-all duration-300 relative flex flex-col group hover:-translate-y-1.5">
                                      <div className="absolute -top-3 right-5 bg-violet-600 text-white text-[9px] font-black px-4 py-1 rounded-full shadow-md">变体 {entry.variant.toUpperCase()}</div>
                                      
                                      <div className="mb-4">
                                        <div className="font-mono font-black text-violet-900 text-base break-all flex items-center gap-2">
                                          <span className="w-2 h-2 rounded-full bg-violet-400 group-hover:animate-ping"></span>
                                          {entry.name}
                                        </div>
                                        <div className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-tight font-mono">{new Date(entry.createdAt).toLocaleDateString('zh-CN')} · {new Date(entry.createdAt).toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'})}</div>
                                      </div>
                                      
                                      <div className="px-4 py-3 bg-violet-50/40 border border-violet-100 rounded-xl text-[11px] font-medium text-gray-700 mb-5 leading-relaxed relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-violet-500 opacity-20"></div>
                                        {entry.logicSummary ? `✨ ${entry.logicSummary}` : '🤖 多维迭代：策略结构深度演进优化'}
                                      </div>

                                      {entry.kpi && (
                                        <div className="grid grid-cols-3 gap-2 mb-6 p-2 bg-gray-50 rounded-xl border border-gray-100 text-center">
                                          <div className="py-1">
                                            <div className="text-[9px] text-gray-400 font-bold uppercase mb-0.5">收益</div>
                                            <div className={`text-xs font-black ${(parseFloat(entry.kpi['01_策略收益'] || '0') >= 0) ? 'text-green-600' : 'text-red-600'}`}>{(parseFloat(entry.kpi['01_策略收益'] || '0') * 100).toFixed(1)}%</div>
                                          </div>
                                          <div className="py-1 border-x border-gray-200">
                                            <div className="text-[9px] text-gray-400 font-bold uppercase mb-0.5">胜率</div>
                                            <div className="text-xs font-black text-gray-800">{(parseFloat(entry.kpi['08_胜率'] || '0') * 100).toFixed(1)}%</div>
                                          </div>
                                          <div className="py-1">
                                            <div className="text-[9px] text-gray-400 font-bold uppercase mb-0.5">回撤</div>
                                            <div className="text-xs font-black text-orange-500">{(parseFloat(entry.kpi['10_最大回撤'] || '0') * 100).toFixed(1)}%</div>
                                          </div>
                                        </div>
                                      )}

                                      <div className="flex-1 flex flex-col justify-end space-y-4">
                                        {entry.improvementSummary && (
                                          <div className="text-[11px] text-gray-500 bg-gray-50/50 p-3.5 rounded-xl border border-gray-100 italic leading-snug font-medium min-h-[60px]">
                                            {entry.improvementSummary.startsWith('✨') ? entry.improvementSummary : `📝 ${entry.improvementSummary}`}
                                          </div>
                                        )}
                                        <div className="flex gap-2">
                                          <button onClick={() => viewReport(entry.name)} className="flex-1 py-2 bg-emerald-500 text-white text-[11px] font-black rounded-xl hover:bg-emerald-600 shadow-sm transition-all active:scale-95">报告</button>
                                          <button onClick={() => openIterModal(entry.name)} className="flex-1 py-2 bg-violet-500 text-white text-[11px] font-black rounded-xl hover:bg-violet-600 shadow-sm transition-all active:scale-95">迭代</button>
                                          <button onClick={() => { setShowIterBoard(false); setFactorName(entry.name); setShowBacktest(true); window.scrollTo({top:0, behavior:'smooth'}); }} className="flex-1 py-2 bg-gray-200 text-gray-700 text-[11px] font-black rounded-xl hover:bg-gray-300 transition-all active:scale-95">回测</button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========= Report & Trades Modals (Restored) ========= */}
      {reportModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-5 bg-white border-b shadow-sm">
              <h3 className="font-extrabold text-gray-900 text-lg flex items-center gap-2">📊 策略报告 — <span className="font-mono text-emerald-600">{reportFactor}</span></h3>
              <div className="flex items-center gap-3">
                <select value={iterRounds} onChange={(e)=>setIterRounds(Number(e.target.value))} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 bg-white focus:ring-2 focus:ring-emerald-500 outline-none">
                  <option value={1}>1代迭代</option><option value={2}>2代迭代</option><option value={3}>3代迭代</option>
                </select>
                <button onClick={()=>openIterModal(reportFactor)} className="px-5 py-1.5 bg-violet-600 text-white text-xs font-black rounded-lg hover:bg-violet-700 shadow-sm transition-all active:scale-95">🧬 AI 迭代</button>
                <button onClick={()=>{setReportModal(false); setFactorName(reportFactor); setShowBacktest(true); setShowCustom(false); window.scrollTo({top:0, behavior:'smooth'}); }} className="px-5 py-1.5 bg-emerald-500 text-white text-xs font-black rounded-lg hover:bg-emerald-600 shadow-sm transition-all active:scale-95">重新回测</button>
                <button onClick={()=>{setReportModal(false); setReportHtml('');}} className="p-2 text-gray-400 hover:text-gray-600 text-2xl leading-none">✕</button>
              </div>
            </div>
            <div className="flex-1 bg-gray-50 p-2 overflow-hidden">
              {loadingReport ? <div className="h-full flex items-center justify-center text-gray-400 font-bold animate-pulse uppercase tracking-widest">Loading Report...</div> : (
                <iframe src={`/api/strategy/backtest?report=${encodeURIComponent(reportFactor)}`} className="w-full h-full border-0 rounded-xl bg-white shadow-sm" style={{minHeight:'80vh'}} title="Report Content" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Trades Modal */}
      {tradesModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-white">
            <div className="flex justify-between items-center p-6 bg-white border-b shadow-sm">
              <h3 className="font-black text-gray-900 text-xl tracking-tight">📋 交易明细 — <span className="text-emerald-600">{filteredTrades.length}</span> 笔</h3>
              <div className="flex items-center gap-5">
                <input type="text" value={tradeSearch} onChange={(e)=>setTradeSearch(e.target.value)} placeholder="搜索股票名称、代码或备注..." className="px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none w-72 transition-all shadow-sm" />
                <button onClick={()=>setTradesModal(false)} className="text-gray-400 hover:text-gray-900 text-3xl font-light leading-none">✕</button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-gray-50/50">
              {loadingTrades ? <div className="text-center py-20 font-black text-gray-300 animate-pulse tracking-widest">LOADING DATA...</div> : (
                <table className="w-full text-sm border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-gray-400 text-[10px] uppercase tracking-[0.2em] font-black text-left">
                      <th className="px-5 py-3 cursor-pointer hover:text-gray-900 transition-colors" onClick={()=>toggleSort('name')}>股票名称 {tradeSortBy==='name'?(tradeSortAsc?'↑':'↓'):'↕'}</th>
                      <th className="px-5 py-3">证券代码</th>
                      <th className="px-5 py-3 cursor-pointer hover:text-gray-900 transition-colors" onClick={()=>toggleSort('time')}>交易时间 {tradeSortBy==='time'?(tradeSortAsc?'↑':'↓'):'↕'}</th>
                      <th className="px-5 py-3">执行价格</th>
                      <th className="px-5 py-3">交易数量</th>
                      <th className="px-5 py-3 cursor-pointer hover:text-gray-900 transition-colors" onClick={()=>toggleSort('pnl')}>盈亏金额 {tradeSortBy==='pnl'?(tradeSortAsc?'↑':'↓'):'↕'}</th>
                      <th className="px-5 py-3">收益率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrades.map((t, i) => (
                      <tr key={i} className="bg-white shadow-sm rounded-xl overflow-hidden hover:shadow-md transition-all group">
                        <td className="px-5 py-4 font-black text-gray-800 rounded-l-xl group-hover:text-emerald-600 transition-colors">{t.证券名称}</td>
                        <td className="px-5 py-4 text-xs font-mono text-gray-400">{t.证券代码}</td>
                        <td className="px-5 py-4 text-[11px] text-gray-500 font-medium leading-relaxed">
                          <div className="flex items-center gap-1.5 opacity-60"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>{t.买入时间}</div>
                          <div className="flex items-center gap-1.5 opacity-60"><span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>{t.卖出时间}</div>
                        </td>
                        <td className="px-5 py-4 text-sm font-bold text-gray-600">{t.买入成本} <span className="opacity-30 mx-1">→</span> {t.卖出价格}</td>
                        <td className="px-5 py-4 text-sm font-mono font-medium text-gray-500">{t.交易数量}</td>
                        <td className={`px-5 py-4 font-black tracking-tight ${(parseFloat(t.盈亏金额||'0')>0)?'text-rose-500':'text-emerald-600'}`}>
                          {(parseFloat(t.盈亏金额||'0') > 0 ? '+' : '')}{t.盈亏金额}
                        </td>
                        <td className={`px-5 py-4 font-black text-sm rounded-r-xl ${(parseFloat(t.收益率||'0')>0)?'text-rose-500':'text-emerald-600'}`}>{t.收益率}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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
                  <h2 className="text-xl font-black text-gray-900">🧬 策略迭代</h2>
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
                    <p className="text-xs text-violet-600 leading-relaxed">AI 将基于当前策略的回测诊断报告，自动生成 3 个差异化变体：</p>
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-violet-700"><span className="w-5 h-5 bg-violet-200 rounded-full flex items-center justify-center text-[10px] font-black">A</span> 🛡️ 风控防御版 — 强化止损与回撤约束</div>
                      <div className="flex items-center gap-2 text-xs text-violet-700"><span className="w-5 h-5 bg-violet-200 rounded-full flex items-center justify-center text-[10px] font-black">B</span> 🔥 进攻增强版 — 优化信号与趋势捕捉</div>
                      <div className="flex items-center gap-2 text-xs text-violet-700"><span className="w-5 h-5 bg-violet-200 rounded-full flex items-center justify-center text-[10px] font-black">C</span> ⚖️ 稳健均衡版 — 中性化与持仓控制</div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">迭代代数</label>
                    <select value={iterRounds} onChange={(e) => setIterRounds(Number(e.target.value))} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 bg-white focus:ring-2 focus:ring-violet-500 outline-none">
                      <option value={1}>1代迭代</option><option value={2}>2代迭代</option><option value={3}>3代迭代</option>
                    </select>
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
                      { label: '📈 胜率提升', prompt: '优化入场时机和信号过滤条件，提升交易胜率' },
                      { label: '📉 回撤控制', prompt: '严格控制最大回撤在15%以内，增加动态止损机制' },
                    ].map(preset => (
                      <button key={preset.label} onClick={() => setIterModalPrompt(preset.prompt)} className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${iterModalPrompt === preset.prompt ? 'bg-violet-100 border-violet-300 text-violet-700' : 'bg-white border-gray-200 text-gray-600 hover:border-violet-200 hover:text-violet-600'}`}>{preset.label}</button>
                    ))}
                  </div>
                  <textarea value={iterModalPrompt} onChange={(e) => setIterModalPrompt(e.target.value)} placeholder="输入你希望 AI 重点优化的方向和具体要求..." className="w-full h-28 px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-violet-500 outline-none leading-relaxed" />
                </div>
              )}

              <button onClick={confirmIteration} disabled={iterModalMode === 'interactive' && !iterModalPrompt.trim()} className="w-full mt-6 py-3.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl text-sm font-black transition-all hover:from-violet-700 hover:to-purple-700 active:scale-[0.98] shadow-lg shadow-violet-200 disabled:opacity-40 disabled:cursor-not-allowed">
                {iterModalMode === 'auto' ? `🚀 开始自动迭代 (${iterRounds}代)` : '🚀 开始交互式迭代'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
