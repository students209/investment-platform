'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { convertPaper } from '@/lib/api'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Factor {
  name: string
  description: string
  params: { name: string; default: number; description: string }[]
}

interface ParsedReport {
  title: string
  part1: string
  part2: string
  factors: Factor[]
  rawContent: string
  savedFilename?: string
  usedModel?: string
}

export default function PaperToFactorPage() {
  const router = useRouter()
  const [inputMode, setInputMode] = useState<'url' | 'text' | 'file'>('url')
  const [paperUrl, setPaperUrl] = useState('')
  const [paperText, setPaperText] = useState('')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<ParsedReport | null>(null)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'part1' | 'part2' | 'factors' | 'raw'>('part1')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadedFileName, setUploadedFileName] = useState('')
  const [fileBase64, setFileBase64] = useState('')
  const [mimeType, setMimeType] = useState('')
  const [selectedModel, setSelectedModel] = useState('')

  async function handleConvert() {
    if (!paperUrl && !paperText && !uploadedFileName) {
      setError('请输入论文链接、粘贴内容或上传文件')
      return
    }

    setLoading(true)
    setError('')
    setReport(null)

    try {
      const data = await convertPaper({
        url: inputMode === 'url' ? paperUrl : undefined,
        text: paperText || undefined,
        filename: uploadedFileName || undefined,
        fileBase64: inputMode === 'file' ? fileBase64 : undefined,
        mimeType: inputMode === 'file' ? mimeType : undefined,
        model: selectedModel || undefined,
      })

      if (data.success) {
        setReport(data.data)
      } else {
        setError(data.error || '解析失败，请稍后重试')
      }
    } catch {
      setError('解析请求失败，请检查网络连接')
    }
    setLoading(false)
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) {
      setUploadedFileName(file.name)
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        if (result && result.includes(',')) {
          const base64 = result.split(',')[1]
          setFileBase64(base64)
          setMimeType(file.type || 'application/pdf')
          setPaperText('') // 清空可能冲突的文本输入
        }
      }
      reader.readAsDataURL(file)
    }
  }

  function downloadReport() {
    if (!report) return
    const blob = new Blob([report.rawContent], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${report.title.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_')}_解析报告.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const tabs = [
    { id: 'part1' as const, label: '📖 文献解读', color: 'blue' },
    { id: 'part2' as const, label: '📊 策略解析', color: 'purple' },
    { id: 'factors' as const, label: '🔢 因子列表', color: 'orange' },
    { id: 'raw' as const, label: '📄 完整报告', color: 'gray' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">📄 论文转因子</h1>
        <p className="text-gray-600">
          输入学术论文链接、粘贴内容或上传文档，AI 将自动提取核心逻辑并转化为量化因子
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-8">
        {/* Left: Input */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-bold mb-4">输入论文</h2>

            <div className="flex space-x-1 mb-4 bg-gray-100 rounded-lg p-1">
              {[
                { id: 'url' as const, icon: '🔗', label: '链接' },
                { id: 'text' as const, icon: '📝', label: '粘贴' },
                { id: 'file' as const, icon: '📁', label: '上传' },
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setInputMode(mode.id)}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    inputMode === mode.id
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {mode.icon} {mode.label}
                </button>
              ))}
            </div>

            {inputMode === 'url' && (
              <div className="mb-4">
                <input
                  type="text"
                  value={paperUrl}
                  onChange={(e) => setPaperUrl(e.target.value)}
                  placeholder="输入 arXiv、SSRN、公众号文章链接..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            )}

            {inputMode === 'text' && (
              <div className="mb-4">
                <textarea
                  value={paperText}
                  onChange={(e) => setPaperText(e.target.value)}
                  placeholder="粘贴论文摘要或核心内容..."
                  className="w-full h-48 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono text-sm resize-none"
                />
              </div>
            )}

            {inputMode === 'file' && (
              <div className="mb-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".txt,.md,.pdf"
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 transition-all"
                >
                  {uploadedFileName ? (
                    <div>
                      <div className="text-3xl mb-2">✅</div>
                      <div className="font-medium text-emerald-600">{uploadedFileName}</div>
                      <div className="text-sm text-gray-400 mt-1">点击重新选择</div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-4xl mb-2">📎</div>
                      <div className="font-medium text-gray-600">点击上传文件</div>
                      <div className="text-sm text-gray-400 mt-1">支持 .txt, .md, .pdf</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Model Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">使用模型名称 (留空使用默认)</label>
              <input
                type="text"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                placeholder="例如: gemini-2.5-pro, gemini-2.5-flash..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={handleConvert}
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm transition-all"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  AI 解析中...
                </span>
              ) : '🚀 开始解析'}
            </button>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50/50 rounded-xl p-5 border border-blue-100">
            <h3 className="font-semibold text-blue-800 mb-3">💡 功能说明</h3>
            <div className="space-y-3 text-sm text-blue-700">
              <div className="flex gap-2">
                <span className="text-lg">🔬</span>
                <div>
                  <div className="font-medium">智能解析</div>
                  <div className="text-blue-500">AI 自动提取论文核心逻辑、策略规则、关键参数</div>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="text-lg">🔢</span>
                <div>
                  <div className="font-medium">因子生成</div>
                  <div className="text-blue-500">自动生成 Python 因子代码，可用于回测和实盘</div>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="text-lg">💾</span>
                <div>
                  <div className="font-medium">报告保存</div>
                  <div className="text-blue-500">解析报告自动保存至因子技能文件夹</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Output */}
        <div className="lg:col-span-3">
          {report ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 p-5 text-white">
                <h2 className="text-lg font-bold mb-1">{report.title}</h2>
                <div className="flex flex-col gap-1 text-sm text-emerald-100 mt-2">
                  {report.usedModel && <span>模型: {report.usedModel}</span>}
                  {report.savedFilename && (
                    <span className="text-emerald-50 text-xs mt-1 bg-black/10 rounded px-2 py-1 leading-[1.4] break-all">
                      💾 已自动保存至: {report.savedFilename}
                    </span>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-200 bg-gray-50">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'text-emerald-700 border-b-2 border-emerald-500 bg-white'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                {activeTab === 'part1' && (
                  <div className="article-report-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {report.part1 || '*暂无文献解读内容*'}
                    </ReactMarkdown>
                  </div>
                )}

                {activeTab === 'part2' && (
                  <div className="article-report-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {report.part2 || '*暂无策略解析内容*'}
                    </ReactMarkdown>
                  </div>
                )}

                {activeTab === 'factors' && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-500">共识别 {report.factors.length} 个量化因子</p>
                    {report.factors.map((factor, i) => (
                      <div key={i} className="border border-gray-200 rounded-lg p-4 hover:border-emerald-300 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-mono font-bold text-emerald-600 text-sm">
                            {factor.name}
                          </h4>
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                            #{i + 1}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{factor.description}</p>
                        {factor.params.length > 0 && (
                          <div className="bg-gray-50 rounded-lg p-3">
                            <span className="text-xs font-medium text-gray-500">参数：</span>
                            {factor.params.map((p, j) => (
                              <span key={j} className="inline-block text-xs text-gray-600 ml-2 bg-white px-2 py-0.5 rounded border">
                                {p.name}={p.default}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'raw' && (
                  <div className="article-report-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {report.rawContent}
                    </ReactMarkdown>
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div className="flex gap-3 p-4 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={downloadReport}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-white font-medium text-sm transition-colors"
                >
                  💾 下载报告
                </button>
                <button
                  onClick={() => router.push('/factor-store')}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium text-sm transition-colors"
                >
                  🏪 查看因子超市
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center">
              <div className="text-7xl mb-4 opacity-50">🔬</div>
              <h2 className="text-xl font-medium text-gray-600 mb-2">等待解析</h2>
              <p className="text-gray-400 max-w-sm mx-auto">
                在左侧输入论文链接、粘贴内容或上传文件，<br />
                点击「开始解析」按钮开始 AI 分析
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
