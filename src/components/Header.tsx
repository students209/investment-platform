import Link from 'next/link'

const navigation = [
  { name: '首页', href: '/' },
  { name: '行情', href: '/market' },
  { name: '资讯', href: '/news' },
  { name: '行业研究', href: '/research/industries' },
  { name: '企业研究', href: '/research/companies' },
  { name: '因子超市', href: '/factor-store' },
  { name: '因子实验室', href: '/factors' },
  { name: '论文转因子', href: '/paper-to-factor' },
  { name: '策略', href: '/strategies' },
  { name: '风控', href: '/risk' },
]

export default function Header() {
  return (
    <header className="bg-slate-900 text-white sticky top-0 z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-emerald-400">
              投研平台
            </Link>
            <div className="hidden lg:flex ml-10 space-x-6">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="text-gray-300 hover:text-white px-2 py-1 rounded text-sm font-medium transition-colors"
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-xs text-gray-400">
              v0.2.0
            </span>
          </div>
        </div>
      </nav>
    </header>
  )
}
