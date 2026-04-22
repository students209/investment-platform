import Link from 'next/link'
import { getIndustryReports } from '@/lib/hugo'

export const dynamic = 'force-dynamic'

export default async function IndustriesPage() {
  const reports = await getIndustryReports()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/research" className="text-emerald-600 hover:text-emerald-700 text-sm mb-2 inline-block">
            ← 返回投研报告
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">行业研究报告</h1>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">📊</div>
          <h2 className="text-xl font-medium text-gray-700 mb-2">暂无行业报告</h2>
          <p className="text-gray-500">
            Hugo 每日会自动生成行业研究报告，请稍后再查看
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reports.map((report) => (
            <Link
              key={report.slug}
              href={`/research/industries/${report.slug}`}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6"
            >
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-500">
                  {report.date} {report.weekday ? `(${report.weekday})` : ''}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-3 line-clamp-2 leading-snug">
                {report.title}
              </h3>

              {((report.cover_tags?.length ?? 0) > 0 || (report.tags?.length ?? 0) > 0) && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {Array.from(new Set([...(report.cover_tags || []), ...(report.tags || [])])).map((tag: string) => (
                    <span key={tag} className="px-2.5 py-1 bg-gray-50 text-gray-600 text-xs rounded-md border border-gray-200">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex-1 mt-1">
                {report.summary ? (
                  <div className="bg-gray-50/80 p-3 rounded-lg border border-gray-100">
                    <p className="text-gray-600 text-sm line-clamp-4 leading-relaxed">
                      {report.summary}
                    </p>
                  </div>
                ) : report.excerpt && (
                  <p className="text-gray-600 text-sm line-clamp-4 leading-relaxed">
                    {report.excerpt}
                  </p>
                )}
              </div>
              <div className="mt-4 text-emerald-600 text-sm font-medium">
                阅读全文 →
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* 统计信息 */}
      <div className="mt-8 bg-gray-100 rounded-lg p-4">
        <p className="text-gray-600 text-sm">
          共 {reports.length} 篇行业研究报告 | 数据来源：Hugo 每日自动生成
        </p>
      </div>
    </div>
  )
}
