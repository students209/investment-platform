import Link from 'next/link'
import { getIndustryReports, getCompanyReports, getQuantStrategyReports } from '@/lib/hugo'

export default function ResearchPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">投研报告</h1>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
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

        {/* 量化策略 */}
        <Link href="/research/quant-strategies" className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-lg p-8 text-white hover:from-indigo-600 hover:to-indigo-700 transition-all">
          <div className="text-4xl mb-4">📈</div>
          <h2 className="text-2xl font-bold mb-2">量化策略报告</h2>
          <p className="text-indigo-100 mb-4">
            覆盖多因子归因与量化策略每日更新跟踪
          </p>
          <div className="flex items-center text-indigo-200">
            <span>查看报告</span>
            <span className="ml-2">→</span>
          </div>
        </Link>

        {/* AI报告生成 */}
        <Link href="/research/generate" className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg p-8 text-white hover:from-emerald-600 hover:to-teal-700 transition-all">
          <div className="text-4xl mb-4">🤖</div>
          <h2 className="text-2xl font-bold mb-2">AI 报告生成</h2>
          <p className="text-emerald-100 mb-4">
            输入关键词，AI 自动生成行业或企业专业研究报告
          </p>
          <div className="flex items-center text-emerald-200">
            <span>开始生成</span>
            <span className="ml-2">→</span>
          </div>
        </Link>
      </div>
    </div>
  )
}
