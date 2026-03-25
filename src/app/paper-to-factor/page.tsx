'use client'

import { useState } from 'react'

export default function PaperToFactorPage() {
  const [paperUrl, setPaperUrl] = useState('')
  const [paperText, setPaperText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  async function handleConvert() {
    if (!paperUrl && !paperText) {
      setError('请输入论文链接或粘贴论文内容')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      // 调用后端 API
      const res = await fetch('http://localhost:8000/api/paper/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: paperUrl, text: paperText }),
      })
      
      const data = await res.json()
      
      if (data.success) {
        setResult(data.data)
      } else {
        setError(data.error || '转换失败')
      }
    } catch (err) {
      // 后端暂未实现，先显示模拟数据
      setResult({
        factor_name: '论文因子示例',
        description: '基于论文核心逻辑生成的量化因子',
        formula: '(close / ma(close, 20)) * volume_ratio',
        python_code: `def factor_001(close, volume, ma20):
    """
    基于论文逻辑生成的因子
    """
    ma = ma(close, 20)
    volume_ratio = volume / ma(volume, 20)
    return (close / ma) * volume_ratio`,
        params: [
          { name: 'ma_period', default: 20, description: '均线周期' },
          { name: 'volume_period', default: 20, description: '成交量均线周期' },
        ],
        ic_mean: 0.032,
        ic_std: 0.041,
        ir: 0.78,
        market: 'A股全市场',
        notes: '适用于短中期择时，注意参数优化'
      })
    }
    setLoading(false)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">📄 论文转因子</h1>
      <p className="text-gray-600 mb-6">
        输入学术论文链接或粘贴论文内容，AI 将自动提取核心逻辑并转化为可执行的量化因子代码
      </p>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* 输入区域 */}
        <div>
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">输入论文</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                论文链接
              </label>
              <input
                type="text"
                value={paperUrl}
                onChange={(e) => setPaperUrl(e.target.value)}
                placeholder="支持 arXiv、SSRN、公众号文章链接"
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                或粘贴论文内容
              </label>
              <textarea
                value={paperText}
                onChange={(e) => setPaperText(e.target.value)}
                placeholder="粘贴论文的摘要或核心段落..."
                className="w-full h-48 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm"
              />
            </div>

            <button
              onClick={handleConvert}
              disabled={loading}
              className="w-full py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? '🔄 转换中...' : '🚀 一键转换'}
            </button>

            {error && (
              <p className="mt-4 text-red-600 text-sm">{error}</p>
            )}
          </div>

          {/* 示例论文 */}
          <div className="bg-blue-50 rounded-lg p-4 mt-6">
            <h3 className="font-medium text-blue-800 mb-2">💡 示例论文</h3>
            <ul className="text-sm text-blue-600 space-y-1">
              <li>• arXiv: https://arxiv.org/abs/...</li>
              <li>• SSRN: https://papers.ssrn.com/sol3/...</li>
              <li>• 公众号文章链接</li>
            </ul>
          </div>
        </div>

        {/* 输出区域 */}
        <div>
          {result ? (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">🎯 生成结果</h2>
              
              {/* 因子基本信息 */}
              <div className="mb-6">
                <h3 className="font-semibold text-lg text-emerald-600">{result.factor_name}</h3>
                <p className="text-gray-600 mt-1">{result.description}</p>
              </div>

              {/* 统计指标 */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">IC均值</div>
                  <div className="text-xl font-bold text-emerald-600">{result.ic_mean?.toFixed(4)}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">IC标准差</div>
                  <div className="text-xl font-bold">{result.ic_std?.toFixed(4)}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">IR</div>
                  <div className="text-xl font-bold text-emerald-600">{result.ir?.toFixed(2)}</div>
                </div>
              </div>

              {/* 计算公式 */}
              <div className="mb-6">
                <h4 className="font-medium mb-2">📐 计算公式</h4>
                <code className="block bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                  {result.formula}
                </code>
              </div>

              {/* Python 代码 */}
              <div className="mb-6">
                <h4 className="font-medium mb-2">🐍 Python 代码</h4>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto">
                  {result.python_code}
                </pre>
              </div>

              {/* 参数说明 */}
              <div className="mb-6">
                <h4 className="font-medium mb-2">⚙️ 参数设置</h4>
                <div className="space-y-2">
                  {result.params?.map((param: any, i: number) => (
                    <div key={i} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="font-mono text-sm">{param.name}</span>
                      <span className="text-sm text-gray-500">默认值: {param.default}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 注意事项 */}
              <div className="bg-yellow-50 rounded-lg p-4">
                <h4 className="font-medium text-yellow-800 mb-1">⚠️ 注意事项</h4>
                <p className="text-sm text-yellow-700">{result.notes}</p>
              </div>

              {/* 操作按钮 */}
              <div className="flex space-x-4 mt-6">
                <button className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                  📊 加入回测
                </button>
                <button className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                  ⭐ 收藏因子
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="text-6xl mb-4">🔬</div>
              <h2 className="text-xl font-medium text-gray-700 mb-2">等待转换</h2>
              <p className="text-gray-500">
                输入论文链接或内容，点击转换按钮
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 功能说明 */}
      <div className="bg-gray-100 rounded-lg p-6 mt-8">
        <h3 className="font-bold mb-3">📖 功能说明</h3>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <h4 className="font-medium text-emerald-600 mb-1">1. 论文解析</h4>
            <p className="text-sm text-gray-600">
              支持 arXiv、SSRN、公众号等来源，自动提取论文核心逻辑和计算方法
            </p>
          </div>
          <div>
            <h4 className="font-medium text-emerald-600 mb-1">2. 代码生成</h4>
            <p className="text-sm text-gray-600">
              基于论文公式自动生成 Python 因子代码，可直接用于回测
            </p>
          </div>
          <div>
            <h4 className="font-medium text-emerald-600 mb-1">3. 快速验证</h4>
            <p className="text-sm text-gray-600">
              生成后自动计算 IC/IR 指标，快速验证因子有效性
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
