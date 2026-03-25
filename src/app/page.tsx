import Link from 'next/link'

async function getMarketData() {
  try {
    const res = await fetch('http://localhost:8000/api/market/index', { 
      cache: 'no-store',
      next: { revalidate: 60 }
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

async function getHotStocks() {
  try {
    const res = await fetch('http://localhost:8000/api/market/hot-stocks', { 
      cache: 'no-store',
      next: { revalidate: 60 }
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export default async function HomePage() {
  const [marketData, hotData] = await Promise.all([
    getMarketData(),
    getHotStocks()
  ])

  const formatNumber = (num: number, decimals = 2) => {
    return num?.toFixed(decimals) || '-'
  }

  const formatChange = (change: number, pct: number) => {
    const isPositive = change >= 0
    return {
      class: isPositive ? 'text-red-500' : 'text-green-500',
      sign: isPositive ? '+' : ''
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 大盘指数 */}
      <section className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">大盘指数</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {marketData?.data?.map((index: any) => {
            const { class: colorClass, sign } = formatChange(index['涨跌幅'], index['涨跌幅'])
            return (
              <div key={index['代码']} className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-500">{index['名称']}</div>
                <div className="text-2xl font-bold mt-1">{formatNumber(index['最新价'])}</div>
                <div className={`text-sm mt-1 ${colorClass}`}>
                  {sign}{formatNumber(index['涨跌幅'])}%
                </div>
              </div>
            )
          }) || (
            <>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white rounded-lg shadow p-4 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-24"></div>
                </div>
              ))}
            </>
          )}
        </div>
      </section>

      {/* 快速入口 */}
      <section className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">快捷入口</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/market" className="bg-emerald-600 text-white rounded-lg shadow p-6 hover:bg-emerald-700 transition-colors">
            <div className="text-xl font-bold">行情中心</div>
            <div className="text-sm opacity-80 mt-1">实时行情 K线数据</div>
          </Link>
          <Link href="/research/industries" className="bg-blue-600 text-white rounded-lg shadow p-6 hover:bg-blue-700 transition-colors">
            <div className="text-xl font-bold">行业研究</div>
            <div className="text-sm opacity-80 mt-1">行业深度报告</div>
          </Link>
          <Link href="/research/companies" className="bg-purple-600 text-white rounded-lg shadow p-6 hover:bg-purple-700 transition-colors">
            <div className="text-xl font-bold">企业研究</div>
            <div className="text-sm opacity-80 mt-1">上市公司分析</div>
          </Link>
          <Link href="/factors" className="bg-orange-600 text-white rounded-lg shadow p-6 hover:bg-orange-700 transition-colors">
            <div className="text-xl font-bold">因子实验室</div>
            <div className="text-sm opacity-80 mt-1">量化因子研究</div>
          </Link>
        </div>
      </section>

      {/* 热门股票 */}
      <section className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900">热门股票</h2>
          <Link href="/market" className="text-emerald-600 hover:text-emerald-700 text-sm font-medium">
            查看更多 →
          </Link>
        </div>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">代码</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">名称</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">最新价</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">涨跌幅</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {hotData?.data?.slice(0, 10).map((stock: any, i: number) => {
                const { class: colorClass, sign } = formatChange(stock['涨跌幅'], stock['涨跌幅'])
                return (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stock['代码']}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{stock['名称']}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatNumber(stock['最新价'])}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${colorClass}`}>
                      {sign}{formatNumber(stock['涨跌幅'])}%
                    </td>
                  </tr>
                )
              }) || (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    正在加载热门股票数据...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 平台介绍 */}
      <section className="bg-white rounded-lg shadow p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">关于平台</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-lg font-semibold text-emerald-600 mb-2">核心功能</h3>
            <ul className="text-gray-600 space-y-2 text-sm">
              <li>• 论文转因子 - 学术论文一键转化为量化因子</li>
              <li>• 因子实验室 - 可视化因子研究与回测</li>
              <li>• 智能风控 - 组合VaR/CVaR实时监控</li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-blue-600 mb-2">数据来源</h3>
            <ul className="text-gray-600 space-y-2 text-sm">
              <li>• 实时行情 - AKShare</li>
              <li>• 研究报告 - Hugo 每日生成</li>
              <li>• 财务数据 - 公开披露</li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-purple-600 mb-2">技术架构</h3>
            <ul className="text-gray-600 space-y-2 text-sm">
              <li>• 前端 - Next.js 15 + Tailwind</li>
              <li>• 后端 - FastAPI + Python</li>
              <li>• 部署 - Vercel + Railway</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
