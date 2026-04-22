import Link from 'next/link'

export const metadata = {
  title: '技术分析 - 量化策略',
}

export default function TechnicalAnalysisPage() {
  return (
    <div className="w-full flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      {/* 顶部标题栏/面包屑 */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 shrink-0 bg-white border-b border-gray-200 flex justify-between items-center">
        <div>
          <Link href="/research" className="text-emerald-600 hover:text-emerald-700 text-sm inline-block">
            ← 返回投研报告
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-xl font-bold text-gray-900">技术分析预测</h1>
            <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              AI 模型诊断
            </span>
          </div>
        </div>
      </div>
      
      {/* iframe 嵌入主体 */}
      <div className="w-full flex-grow bg-slate-50 overflow-hidden relative">
        <iframe
          src="/technical-analysis.html"
          className="w-full h-full border-0 absolute top-0 left-0"
          title="技术分析走势预测"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      </div>
    </div>
  )
}
