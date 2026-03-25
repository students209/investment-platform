import Link from 'next/link'
import { getDailyReports } from '@/lib/hugo'

export const dynamic = 'force-dynamic'

export default async function NewsPage() {
  const reports = await getDailyReports()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">每日资讯</h1>

      {reports.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">📰</div>
          <h2 className="text-xl font-medium text-gray-700 mb-2">暂无资讯</h2>
          <p className="text-gray-500">
            Hugo 每日会自动生成资讯报告，请稍后再查看
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {reports.map((report) => (
            <article key={report.slug} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="text-sm text-gray-500">{report.date}</span>
                    {report.tags?.map((tag: string, i: number) => (
                      <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-3">
                    {report.title}
                  </h2>
                  {report.summary && (
                    <p className="text-gray-600 mb-4">{report.summary}</p>
                  )}
                  <div className="prose prose-sm max-w-none text-gray-700">
                    {report.body.slice(0, 500)}
                    {report.body.length > 500 && '...'}
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t">
                <Link 
                  href={`/news/${report.slug}`}
                  className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                >
                  阅读全文 →
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* 统计信息 */}
      <div className="mt-8 bg-gray-100 rounded-lg p-4">
        <p className="text-gray-600 text-sm">
          共 {reports.length} 篇资讯 | 数据来源：Hugo 每日自动生成
        </p>
      </div>
    </div>
  )
}
