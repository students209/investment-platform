import Link from 'next/link'
import { getQuantStrategyReports } from '@/lib/hugo'

export const dynamic = 'force-dynamic'

/* ---------- colour helpers ---------- */
function riskColor(level: string) {
  switch (level) {
    case '低': return 'bg-green-100 text-green-700 border-green-200'
    case '中': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    case '高': return 'bg-red-100 text-red-700 border-red-200'
    default:  return 'bg-gray-100 text-gray-600 border-gray-200'
  }
}

function statusColor(status: string) {
  if (status.startsWith('L1')) return 'bg-slate-100 text-slate-600'
  if (status.startsWith('L2')) return 'bg-sky-100 text-sky-700'
  if (status.startsWith('L3')) return 'bg-violet-100 text-violet-700'
  if (status.startsWith('L4')) return 'bg-emerald-100 text-emerald-700'
  return 'bg-gray-100 text-gray-600'
}

function complexityColor(c: string) {
  switch (c) {
    case '简单': return 'bg-green-50 text-green-600 border-green-200'
    case '中等': return 'bg-amber-50 text-amber-600 border-amber-200'
    case '复杂': return 'bg-rose-50 text-rose-600 border-rose-200'
    default:    return 'bg-gray-50 text-gray-500 border-gray-200'
  }
}

export default async function QuantStrategiesPage() {
  const reports = await getQuantStrategyReports()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/research" className="text-emerald-600 hover:text-emerald-700 text-sm mb-2 inline-block">
            ← 返回投研报告
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">量化策略报告</h1>
          <p className="text-gray-500 text-sm mt-1">共 {reports.length} 篇量化策略研究报告</p>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">📈</div>
          <h2 className="text-xl font-medium text-gray-700 mb-2">暂无量化策略报告</h2>
          <p className="text-gray-500">
            量化策略分析报告正在生成中，请稍后再查看
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reports.map((report) => {
            const hasStrategyMeta = !!(report.strategy_type || report.market || report.core_logic)

            return (
              <Link
                key={report.slug}
                href={`/research/quant-strategies/${report.slug}`}
                className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden border border-gray-100 hover:border-indigo-200 group"
              >
                {/* ---- Header: title + status badge ---- */}
                <div className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-lg font-bold text-gray-900 line-clamp-2 leading-snug group-hover:text-indigo-700 transition-colors">
                      {report.title}
                    </h3>
                    {report.strategy_status && (
                      <span className={`px-2 py-0.5 text-xs font-bold rounded-md whitespace-nowrap ${statusColor(report.strategy_status)}`}>
                        {report.strategy_status}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{report.date}</span>
                </div>

                {hasStrategyMeta ? (
                  <>
                    {/* ---- Row 1: strategy_type / market / data_frequency ---- */}
                    <div className="px-5 pb-2">
                      <div className="flex flex-wrap gap-1.5">
                        {report.strategy_type && (
                          <span className="px-2 py-0.5 text-xs rounded-md bg-indigo-50 text-indigo-600 border border-indigo-200">
                            {report.strategy_type}
                          </span>
                        )}
                        {report.market && (
                          <span className="px-2 py-0.5 text-xs rounded-md bg-blue-50 text-blue-600 border border-blue-200">
                            {report.market}
                          </span>
                        )}
                        {report.data_frequency && (
                          <span className="px-2 py-0.5 text-xs rounded-md bg-cyan-50 text-cyan-600 border border-cyan-200">
                            {report.data_frequency}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ---- Row 2: holding_period / complexity / risk_level ---- */}
                    <div className="px-5 pb-3">
                      <div className="flex flex-wrap gap-1.5">
                        {report.holding_period && (
                          <span className="px-2 py-0.5 text-xs rounded-md bg-purple-50 text-purple-600 border border-purple-200">
                            {report.holding_period}
                          </span>
                        )}
                        {report.complexity && (
                          <span className={`px-2 py-0.5 text-xs rounded-md border ${complexityColor(report.complexity)}`}>
                            {report.complexity}
                          </span>
                        )}
                        {report.risk_level && (
                          <span className={`px-2 py-0.5 text-xs rounded-md border ${riskColor(report.risk_level)}`}>
                            {report.risk_level}风险
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ---- Core logic ---- */}
                    {report.core_logic && (
                      <div className="mx-5 mb-3 bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <p className="text-xs text-gray-500 mb-1 font-medium">核心逻辑</p>
                        <p className="text-sm text-gray-700 leading-relaxed line-clamp-2">
                          {report.core_logic}
                        </p>
                      </div>
                    )}

                    {/* ---- Advantage & Risk ---- */}
                    {(report.key_advantage || report.key_risk) && (
                      <div className="px-5 pb-3 space-y-1">
                        {report.key_advantage && (
                          <p className="text-xs text-gray-600 line-clamp-1">
                            <span className="text-green-500">✅</span> {report.key_advantage}
                          </p>
                        )}
                        {report.key_risk && (
                          <p className="text-xs text-gray-600 line-clamp-1">
                            <span className="text-amber-500">⚠️</span> {report.key_risk}
                          </p>
                        )}
                      </div>
                    )}

                    {/* ---- Bull/Bear ---- */}
                    {report.bull_bear && (
                      <div className="px-5 pb-4">
                        <span className="text-xs text-gray-400">适用行情：</span>
                        <span className="text-xs font-medium text-gray-600">{report.bull_bear}</span>
                      </div>
                    )}
                  </>
                ) : (
                  /* ---- Fallback for reports without structured frontmatter ---- */
                  <div className="px-5 pb-4">
                    {((report.cover_tags?.length ?? 0) > 0 || (report.tags?.length ?? 0) > 0) && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {Array.from(new Set([...(report.cover_tags || []), ...(report.tags || [])])).map((tag: string) => (
                          <span key={tag} className="px-2.5 py-1 bg-gray-50 text-gray-600 text-xs rounded-md border border-gray-200">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {(report.summary || report.excerpt) && (
                      <p className="text-gray-600 text-sm line-clamp-3 leading-relaxed">
                        {report.summary || report.excerpt}
                      </p>
                    )}
                  </div>
                )}

                {/* ---- Footer ---- */}
                <div className="px-5 py-3 border-t border-gray-50 bg-gray-50/50">
                  <span className="text-emerald-600 text-sm font-medium group-hover:text-indigo-600 transition-colors">
                    阅读全文 →
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
