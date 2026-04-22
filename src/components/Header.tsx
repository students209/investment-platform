'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'

interface NavItem {
  name: string
  href?: string
  children?: { name: string; href: string }[]
}

const navigation: NavItem[] = [
  { name: '首页', href: '/' },
  {
    name: '行情资讯',
    children: [
      { name: '早盘资讯', href: '/market' },
      { name: '收盘资讯', href: '/news' },
      { name: '资金流看板', href: '/market/fund-flow' },
    ],
  },
  {
    name: '研究报告',
    children: [
      { name: 'AI报告生成', href: '/research/generate' },
      { name: '行业研究', href: '/research/industries' },
      { name: '企业研究', href: '/research/companies' },
    ],
  },
  {
    name: '量化策略',
    children: [
      { name: '技术分析', href: '/research/technical-analysis' },
      { name: '策略超市', href: '/research/quant-strategies' },
      { name: '策略实验室', href: '/strategies' },
    ],
  },
  {
    name: '因子挖掘',
    children: [
      { name: '论文转因子', href: '/paper-to-factor' },
      { name: '因子超市', href: '/factor-store' },
      { name: '因子实验室', href: '/factors' },
    ],
  },
  { name: '风控', href: '/risk' },
]

function NavDropdown({ item }: { item: NavItem }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setOpen(true)
  }
  const handleLeave = () => {
    timerRef.current = setTimeout(() => setOpen(false), 150)
  }

  return (
    <div ref={ref} className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <button
        onClick={() => setOpen(o => !o)}
        className="text-gray-300 hover:text-white px-2 py-1 rounded text-sm font-medium transition-colors inline-flex items-center gap-1"
      >
        {item.name}
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 py-1 bg-slate-800 rounded-lg shadow-xl border border-slate-700 min-w-[140px] z-[60]">
          {item.children!.map((child) => (
            <Link
              key={child.name}
              href={child.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700 transition-colors whitespace-nowrap"
            >
              {child.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Header() {
  return (
    <header className="bg-slate-900 text-white sticky top-0 z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-emerald-400">
              投研平台
            </Link>
            <div className="hidden lg:flex ml-10 space-x-4">
              {navigation.map((item) =>
                item.children ? (
                  <NavDropdown key={item.name} item={item} />
                ) : (
                  <Link
                    key={item.name}
                    href={item.href!}
                    className="text-gray-300 hover:text-white px-2 py-1 rounded text-sm font-medium transition-colors"
                  >
                    {item.name}
                  </Link>
                )
              )}
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
