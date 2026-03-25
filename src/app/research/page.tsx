import Link from 'next/link'
import { getIndustryReports, getCompanyReports } from '@/lib/hugo'

export default function ResearchPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">投研报告</h1>
      
      <div className="grid md:grid-cols-2 gap-8">
        {/* 行业研究 */}
        <Link href="/research/industries" className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-8 text-white hover:from-blue-600 hover:to-blue-700 transition-all">
          <div className="text-4xl mb-4">📊</div>
          <h2 className="text-2xl font-bold mb-2">行业研究报告</h2>
          <p className="text-blue-100 mb-4">
            覆盖新能源汽车、人工智能、半导体、光伏、医药生物等核心行业
          </p>
          <div className="flex items-center text-blue-200">
            <span>查看报告</span>
            <span className="ml-2">→</span>
          </div>
        </Link>

        {/* 企业研究 */}
        <Link href="/research/companies" className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-8 text-white hover:from-purple-600 hover:to-purple-700 transition-all">
          <div className="text-4xl mb-4">🏢</div>
          <h2 className="text-2xl font-bold mb-2">企业研究报告</h2>
          <p className="text-purple-100 mb-4">
            深度分析A股龙头上市公司基本面与投资价值
          </p>
          <div className="flex items-center text-purple-200">
            <span>查看报告</span>
            <span className="ml-2">→</span>
          </div>
        </Link>
      </div>
    </div>
  )
}
