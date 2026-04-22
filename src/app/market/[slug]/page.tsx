import Link from 'next/link'
import { notFound } from 'next/navigation'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getReport, getMorningReports } from '@/lib/hugo'

export async function generateStaticParams() {
  const reports = await getMorningReports()
  return reports.map((report) => ({
    slug: report.slug,
  }))
}

export default async function MorningReportDetail({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const report = await getReport('morning', slug)
  
  if (!report) {
    notFound()
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 返回链接 */}
      <Link 
        href="/market" 
        className="text-emerald-600 hover:text-emerald-700 text-sm mb-4 inline-block"
      >
        ← 返回早盘资讯
      </Link>

      {/* 报告内容 */}
      <article className="bg-white rounded-lg shadow p-8">
        <header className="mb-8 pb-6 border-b">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-amber-100 text-amber-700 text-sm rounded">
              早盘资讯
            </span>
            <span className="text-gray-500 text-sm">{report.date}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {report.title}
          </h1>
          {report.tags && report.tags.length > 0 && (
            <div className="flex gap-2">
              {report.tags.map((tag, i) => (
                <span key={i} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        <div className="max-w-none">
          <MarkdownRenderer content={report.body} />
        </div>
      </article>

      {/* 底部导航 */}
      <div className="mt-8 flex justify-between">
        <Link 
          href="/market" 
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
        >
          ← 返回列表
        </Link>
      </div>
    </div>
  )
}
