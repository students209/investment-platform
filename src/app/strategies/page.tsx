'use client'

import { useState } from 'react'

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState([
    {
      id: '1',
      name: '均线交叉策略',
      description: '5日均线上穿20日均线买入，下穿卖出',
      code: `# 均线交叉策略
import pandas as pd

def ma_cross_strategy(df, short=5, long=20):
    df['ma_short'] = df['close'].rolling(short).mean()
    df['ma_long'] = df['close'].rolling(long).mean()
    df['signal'] = (df['ma_short'] > df['ma_long']).astype(int)
    return df`,
      backtestResult: { totalReturn: 18.5, sharpe: 1.2, maxDrawdown: -8.3 },
      createdAt: '2026-03-20',
      status: 'published'
    },
    {
      id: '2',
      name: '成交量突破策略',
      description: '成交量放大2倍且价格上涨时买入',
      code: `# 成交量突破策略
def volume_breakout(df, threshold=2):
    df['vol_ma'] = df['volume'].rolling(20).mean()
    df['vol_ratio'] = df['volume'] / df['vol_ma']
    df['signal'] = ((df['vol_ratio'] > threshold) & (df['close'] > df['close'].shift(1))).astype(int)
    return df`,
      backtestResult: { totalReturn: 12.3, sharpe: 0.9, maxDrawdown: -11.2 },
      createdAt: '2026-03-18',
      status: 'draft'
    }
  ])

  const [showEditor, setShowEditor] = useState(false)
  const [newStrategy, setNewStrategy] = useState({
    name: '',
    description: '',
    code: ''
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">量化策略</h1>
          <p className="text-gray-600 mt-1">创建、管理和回测你的量化投资策略</p>
        </div>
        <button
          onClick={() => setShowEditor(!showEditor)}
          className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
        >
          {showEditor ? '取消' : '+ 新建策略'}
        </button>
      </div>

      {/* 策略编辑器 */}
      {showEditor && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">创建新策略</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                策略名称
              </label>
              <input
                type="text"
                value={newStrategy.name}
                onChange={(e) => setNewStrategy({...newStrategy, name: e.target.value})}
                placeholder="给策略起个名字"
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                策略描述
              </label>
              <textarea
                value={newStrategy.description}
                onChange={(e) => setNewStrategy({...newStrategy, description: e.target.value})}
                placeholder="描述策略的核心逻辑"
                className="w-full h-20 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                策略代码
              </label>
              <textarea
                value={newStrategy.code}
                onChange={(e) => setNewStrategy({...newStrategy, code: e.target.value})}
                placeholder="# 在这里编写你的策略代码..."
                className="w-full h-48 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm"
              />
            </div>
            <div className="flex space-x-4">
              <button className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                保存策略
              </button>
              <button className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                运行回测
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 策略列表 */}
      <div className="grid md:grid-cols-2 gap-6">
        {strategies.map((strategy) => (
          <div key={strategy.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{strategy.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{strategy.description}</p>
              </div>
              <span className={`px-2 py-1 text-xs rounded ${
                strategy.status === 'published' 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {strategy.status === 'published' ? '已发布' : '草稿'}
              </span>
            </div>

            {/* 回测结果 */}
            <div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="text-xs text-gray-500">总收益</div>
                <div className={`text-lg font-bold ${strategy.backtestResult.totalReturn >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {strategy.backtestResult.totalReturn >= 0 ? '+' : ''}{strategy.backtestResult.totalReturn}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500">夏普比率</div>
                <div className="text-lg font-bold text-emerald-600">
                  {strategy.backtestResult.sharpe.toFixed(2)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500">最大回撤</div>
                <div className="text-lg font-bold text-orange-500">
                  {strategy.backtestResult.maxDrawdown}%
                </div>
              </div>
            </div>

            {/* 代码预览 */}
            <details className="mb-4">
              <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                查看代码
              </summary>
              <pre className="mt-2 p-3 bg-gray-900 text-gray-100 rounded text-xs overflow-x-auto">
                {strategy.code}
              </pre>
            </details>

            {/* 操作按钮 */}
            <div className="flex space-x-3 pt-4 border-t">
              <button className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">
                📊 回测
              </button>
              <button className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">
                ✏️ 编辑
              </button>
              <button className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">
                📈 实盘
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 空状态 */}
      {strategies.length === 0 && !showEditor && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">📈</div>
          <h2 className="text-xl font-medium text-gray-700 mb-2">暂无策略</h2>
          <p className="text-gray-500 mb-4">
            创建你的第一个量化策略，开始自动化投资
          </p>
          <button
            onClick={() => setShowEditor(true)}
            className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            + 创建策略
          </button>
        </div>
      )}
    </div>
  )
}
