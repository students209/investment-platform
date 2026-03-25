import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getReport, getIndustryReports } from '@/lib/hugo'

export async function generateStaticParams() {
  const reports = await getIndustryReports()
  return reports.map((report) => ({
    slug: report.slug,
  }))
}

export default async function IndustryReportDetail({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const report = await getReport('industry', slug)
  
  if (!report) {
    notFound()
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 返回链接 */}
      <Link 
        href="/research/industries" 
        className="text-emerald-600 hover:text-emerald-700 text-sm mb-4 inline-block"
      >
        ← 返回行业研究
      </Link>

      {/* 报告内容 */}
      <article className="bg-white rounded-lg shadow p-8">
        <header className="mb-8 pb-6 border-b">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded">
              行业研究
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

        <div className="prose prose-lg max-w-none">
          {report.body.split('\n').map((line, i) => {
            if (line.startsWith('# ')) {
              return <h1 key={i} className="text-2xl font-bold mt-8 mb-4">{line.slice(2)}</h1>
            }
            if (line.startsWith('## ')) {
              return <h2 key={i} className="text-xl font-bold mt-6 mb-3">{line.slice(3)}</h2>
            }
            if (line.startsWith('### ')) {
              return <h3 key={i} className="text-lg font-semibold mt-4 mb-2">{line.slice(4)}</h3>
            }
            if (line.startsWith('- ')) {
              return <li key={i} className="ml-4">{line.slice(2)}</li>
            }
            if (line.startsWith('| ')) {
              return <p key={i} className="font-mono text-sm bg-gray-50 px-2 py-1 my-1">{line}</p>
            }
            if (line.trim() === '') {
              return <br key={i} />
            }
            return <p key={i} className="my-2">{line}</p>
          })}
        </div>
      </article>

      {/* 底部导航 */}
      <div className="mt-8 flex justify-between">
        <Link 
          href="/research/industries" 
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
        >
          ← 返回列表
        </Link>
      </div>
    </div>
  )
}
