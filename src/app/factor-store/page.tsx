'use client'

import { useState } from 'react'

const publicFactors = [
  {
    id: '1',
    name: 'MACross_5_20',
    description: '5日均线与20日均线交叉因子',
    author: '系统',
    icMean: 0.035,
    icStd: 0.042,
    sharpe: 0.83,
    uses: 1234,
    tags: ['动量', '均线'],
    status: 'published'
  },
  {
    id: '2',
    name: 'Volume_ratio',
    description: '成交量放大因子，超过20日均量2倍',
    author: '系统',
    icMean: 0.028,
    icStd: 0.038,
    sharpe: 0.74,
    uses: 856,
    tags: ['成交量', '突破'],
    status: 'published'
  },
  {
    id: '3',
    name: 'RSI_Momentum',
    description: 'RSI动量因子，14日RSI',
    author: 'Alpha',
    icMean: 0.022,
    icStd: 0.035,
    sharpe: 0.63,
    uses: 542,
    tags: ['动量', '超买超卖'],
    status: 'published'
  },
  {
    id: '4',
    name: 'Bollinger_Bands',
    description: '布林带突破因子',
    author: 'Beta',
    icMean: 0.031,
    icStd: 0.048,
    sharpe: 0.65,
    uses: 423,
    tags: ['突破', '波动率'],
    status: 'published'
  },
  {
    id: '5',
    name: 'PE_Ratio',
    description: '市盈率估值因子',
    author: 'Gamma',
    icMean: 0.018,
    icStd: 0.029,
    sharpe: 0.62,
    uses: 312,
    tags: ['估值', '基本面'],
    status: 'published'
  }
]

export default function FactorStorePage() {
  const [factors, setFactors] = useState(publicFactors)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('uses')
  const [selectedTag, setSelectedTag] = useState('')

  const allTags = [...new Set(factors.flatMap(f => f.tags))]

  const filteredFactors = factors
    .filter(f => 
      (selectedTag === '' || f.tags.includes(selectedTag)) &&
      (searchTerm === '' || f.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
       f.description.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      if (sortBy === 'uses') return b.uses - a.uses
      if (sortBy === 'ic') return b.icMean - a.icMean
      if (sortBy === 'sharpe') return b.sharpe - a.sharpe
      return 0
    })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">因子超市</h1>
          <p className="text-gray-600 mt-1">发现、使用和分享优质量化因子</p>
        </div>
        <button className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium">
          + 发布因子
        </button>
      </div>

      {/* 筛选栏 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          {/* 搜索 */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索因子..."
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* 排序 */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">排序:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="uses">使用量</option>
              <option value="ic">IC均值</option>
              <option value="sharpe">夏普比率</option>
            </select>
          </div>
        </div>

        {/* 标签筛选 */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
          <button
            onClick={() => setSelectedTag('')}
            className={`px-3 py-1 rounded-full text-sm ${
              selectedTag === '' 
                ? 'bg-emerald-600 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            全部
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-3 py-1 rounded-full text-sm ${
                selectedTag === tag 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* 因子列表 */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredFactors.map((factor) => (
          <div key={factor.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-lg text-gray-900">{factor.name}</h3>
                <p className="text-sm text-gray-500">by {factor.author}</p>
              </div>
              <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded">
                已发布
              </span>
            </div>

            <p className="text-gray-600 text-sm mb-4">{factor.description}</p>

            {/* 标签 */}
            <div className="flex flex-wrap gap-1 mb-4">
              {factor.tags.map((tag: string) => (
                <span key={tag} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded">
                  {tag}
                </span>
              ))}
            </div>

            {/* 指标 */}
            <div className="grid grid-cols-3 gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="text-xs text-gray-500">IC均值</div>
                <div className="font-bold text-emerald-600">{factor.icMean.toFixed(4)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500">IC标准差</div>
                <div class-name="font-medium">{factor.icStd.toFixed(4)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500">夏普</div>
                <div className="font-bold text-emerald-600">{factor.sharpe.toFixed(2)}</div>
              </div>
            </div>

            {/* 使用量 */}
            <div className="text-sm text-gray-500 mb-4">
              👁️ {factor.uses} 次使用
            </div>

            {/* 操作 */}
            <div className="flex space-x-2">
              <button className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">
                使用
              </button>
              <button className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">
                克隆
              </button>
              <button className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">
                ⭐
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 空状态 */}
      {filteredFactors.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-xl font-medium text-gray-700 mb-2">未找到匹配的因子</h2>
          <p className="text-gray-500">
            尝试调整搜索条件或标签筛选
          </p>
        </div>
      )}

      {/* 统计 */}
      <div className="mt-8 bg-gray-100 rounded-lg p-4">
        <p className="text-gray-600 text-sm">
          共 {filteredFactors.length} 个因子 | 标签: {allTags.length} 种 | 总使用: {factors.reduce((sum, f) => sum + f.uses, 0)} 次
        </p>
      </div>
    </div>
  )
}
