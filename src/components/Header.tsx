import Link from 'next/link'

const navigation = [
  { name: '首页', href: '/' },
  { name: '行情', href: '/market' },
  { name: '行业研究', href: '/research/industries' },
  { name: '企业研究', href: '/research/companies' },
  { name: '因子实验室', href: '/factors' },
  { name: '风控', href: '/risk' },
]

export default function Header() {
  return (
    <header className="bg-slate-900 text-white">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-emerald-400">
              投研平台
            </Link>
            <div className="hidden md:flex ml-10 space-x-8">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-xs text-gray-400">
              v0.1.0 (开发中)
            </span>
          </div>
        </div>
      </nav>
    </header>
  )
}
