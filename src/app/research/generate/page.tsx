'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import MarkdownRenderer from '@/components/MarkdownRenderer'

const LOCAL_API = typeof window !== 'undefined' ? window.location.origin : ''

const MODELS = [
  { label: 'Gemini 3.1 Flash Lite', value: 'gemini-3.1-flash-lite-preview' },
  { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
  { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
  { label: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro' },
  { label: 'Gemini 1.5 Flash', value: 'gemini-1.5-flash' },
]

export default function ResearchGeneratePage() {
  const [keyword, setKeyword] = useState('')
  const [type, setType] = useState<'industry' | 'company'>('industry')
  const [model, setModel] = useState('gemini-3.1-flash-lite-preview')
  const [generating, setGenerating] = useState(false)
  const [reportContent, setReportContent] = useState('')
  const [savedPath, setSavedPath] = useState('')
  const [error, setError] = useState('')
  const reportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reportContent && reportRef.current) {
      reportRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [reportContent])

  async function handleGenerate() {
    if (!keyword.trim()) return
    setGenerating(true)
    setReportContent('')
    setSavedPath('')
    setError('')

    try {
      const res = await fetch(`${LOCAL_API}/api/research/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: keyword.trim(), type, model }),
      })
      const json = await res.json()
      if (json.success) {
        setReportContent(json.data.content)
        setSavedPath(json.data.savedTo)
      } else {
        setError(json.error || '生成失败')
      }
    } catch (e: any) {
      setError(e.message || '请求失败')
    }
    setGenerating(false)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/research" className="text-emerald-600 hover:text-emerald-700 text-sm mb-2 inline-block">
          ← 返回投研报告
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">AI 研究报告生成</h1>
        <p className="text-gray-500 text-sm mt-1">
          输入行业或企业关键词，AI 自动生成专业研究报告并保存到报告库
        </p>
      </div>

      {/* Input Panel */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
        {/* Keyword */}
        <div className="mb-5">
          <label className="block text-sm font-bold text-gray-700 mb-2">研究关键词</label>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !generating && handleGenerate()}
            placeholder={type === 'industry' ? '例如：半导体、新能源汽车、人工智能...' : '例如：比亚迪、宁德时代、茅台...'}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base"
            disabled={generating}
          />
        </div>

        {/* Type Selection */}
        <div className="mb-5">
          <label className="block text-sm font-bold text-gray-700 mb-2">报告类型</label>
          <div className="flex gap-3">
            <button
              onClick={() => setType('industry')}
              disabled={generating}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border-2 ${
                type === 'industry'
                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-1">📊</div>
              行业研究报告
              <div className="text-xs font-normal mt-0.5 opacity-70">分析行业趋势、竞争格局、投资机会</div>
            </button>
            <button
              onClick={() => setType('company')}
              disabled={generating}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border-2 ${
                type === 'company'
                  ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-1">🏢</div>
              企业研究报告
              <div className="text-xs font-normal mt-0.5 opacity-70">分析公司基本面、财务状况、估值水平</div>
            </button>
          </div>
        </div>

        {/* Model Selection */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-2">AI 模型</label>
          <div className="flex flex-col space-y-2">
            <div className="flex flex-wrap gap-2">
              {MODELS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setModel(m.value)}
                  disabled={generating}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    model === m.value
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <input
              list="research-model-list"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="或手动输入模型名称..."
              disabled={generating}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <datalist id="research-model-list">
              {MODELS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </datalist>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={generating || !keyword.trim()}
          className="w-full py-3.5 rounded-xl font-bold text-white text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-lg hover:shadow-xl"
        >
          {generating ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              AI 正在生成报告，请稍候...（约30-60秒）
            </span>
          ) : (
            `🚀 生成${type === 'industry' ? '行业' : '企业'}研究报告`
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-red-700 text-sm font-medium">❌ {error}</p>
        </div>
      )}

      {/* Report Output */}
      {reportContent && (
        <div ref={reportRef}>
          {/* Success Banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <p className="text-emerald-800 font-bold text-sm">报告生成成功！</p>
                <p className="text-emerald-600 text-xs mt-1">
                  已自动保存到：<code className="bg-emerald-100 px-1.5 py-0.5 rounded text-xs">{savedPath}</code>
                </p>
                <p className="text-emerald-600 text-xs mt-1">
                  刷新
                  <Link
                    href={type === 'industry' ? '/research/industries' : '/research/companies'}
                    className="text-emerald-700 underline font-medium mx-1"
                  >
                    {type === 'industry' ? '行业研究' : '企业研究'}
                  </Link>
                  页面即可在列表中看到此报告
                </p>
              </div>
            </div>
          </div>

          {/* Rendered Report */}
          <article className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <MarkdownRenderer content={reportContent} />
          </article>
        </div>
      )}
    </div>
  )
}
