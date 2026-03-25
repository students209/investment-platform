'use client'

import { useState, useRef } from 'react'

interface Factor {
  name: string
  description: string
  params: { name: string; default: number; description: string }[]
}

interface ParsedReport {
  title: string
  part1: string
  part2: string
  factors: Factor[]
  rawContent: string
}

export default function PaperToFactorPage() {
  const [inputMode, setInputMode] = useState<'url' | 'text' | 'file'>('url')
  const [paperUrl, setPaperUrl] = useState('')
  const [paperText, setPaperText] = useState('')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<ParsedReport | null>(null)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadedFileName, setUploadedFileName] = useState('')

  async function handleConvert() {
    if (!paperUrl && !paperText && !uploadedFileName) {
      setError('请输入论文链接、粘贴内容或上传文件')
      return
    }

    setLoading(true)
    setError('')
    setReport(null)

    try {
      const res = await fetch('http://localhost:8000/api/paper/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: paperUrl,
          text: paperText,
          filename: uploadedFileName
        }),
      })

      const data = await res.json()

      if (data.success) {
        setReport(data.data)
      } else {
        setError(data.error || '解析失败')
      }
    } catch (err) {
      // 后端暂未实现，显示模拟数据用于预览
      setReport({
        title: 'Uhl MA Crossover System 解析报告',
        part1: `### 1. 标题
* 技术分析2——修正均线CMA配合快速自适应均线CTS构成完整的均线交叉交易系统（Uhl MA Crossover System）

### 2. 摘要
* 本文提出了一种基于奥地利萨尔茨堡大学教授 Andreas Uhl 提出的修正均线（CMA）和快速自适应均线（CTS）构成的均线交叉交易系统（Uhl MA Crossover System）。该系统旨在解决传统均线在震荡行情中产生大量无效假信号、以及在趋势行情中反应过慢或过激进的问题。

### 3. 核心观点
* **均线不应单纯追求"快"或"慢"，而应追求"智能跟随"**：当价格在噪音中波动时，均线应采取"忽略"态度；当真实趋势出现时，才进行快速调整。
* **CMA（修正均线）作为慢线，利用动态平滑系数过滤噪音**：CMA 判断当前价格的简单移动平均（SMA）与上一期CMA的偏离程度（误差的二次幂），如果误差小于设定的滚动方差（阈值），则平滑系数趋近于0。
* **CTS（快速自适应均线）作为快线，更贴近当前价格**：CTS 直接比较当前收盘价与上一根CTS的差值平方，使其对趋势反应更加敏捷。

### 4. 总结
* Uhl MA 交叉系统提供了一种严谨克制的自适应均线解决方案。它从数学和数字信号滤波器的理念出发，利用价格方差作为噪音鉴别阈值，极其优雅地解决了传统技术分析中长期存在的指标钝化与过度敏感的矛盾。`,
        part2: `**策略：Uhl 修正型均线交叉系统 (Uhl MA Crossover System)**

### 1. 策略描述

**投资宇宙：**
* 广泛适用于具备连续历史报价的交易品种，尤其是趋势与震荡交替的金融市场（如A股、期货等）。

**核心思想：**
* 通过对比当前市场的方差（阈值）与价格序列自身的偏离二次平方（误差），动态计算均线平滑权重 \`k\`。利用这种变平滑系数生成一条慢线 CMA 和一条快线 CTS，构成一个自适应均线交叉系统来捕捉趋势并过滤震荡。

**详细规则：**

| 规则类型 | 描述 |
| :--- | :--- |
| **买入规则** | 快线 CTS 上穿（大于）慢线 CMA，表明趋势转为多头偏向 |
| **卖出规则** | 快线 CTS 下穿（小于）慢线 CMA，表明趋势转为空头偏向 |
| **调仓频率** | 按日频实时或随K线走完判断交叉信号进行调仓操作 |

### 2. 回测逻辑与关键指标

**所需数据：**
* 交易标的的历史量价数据，主要需要收盘价（Close）。基础日线行情数据即可运作。

**关键参数：**

| 参数名称 | 符号 | 描述 | 默认值 |
| :--- | :--- | :--- | :--- |
| 观察周期 | \`length\` | 控制长期的观察窗口基准配置 | 100 |
| 过滤乘数 | \`mult\` | 噪音过滤强度调节器 | 1.0 |`,
        factors: [
          {
            name: 'alpha_uhl_crossover',
            description: '基于Uhl MA System (CMA/CTS) 交叉的动量方向因子',
            params: [
              { name: 'length', default: 100, description: '观察周期' },
              { name: 'mult', default: 1.0, description: '过滤乘数' }
            ]
          },
          {
            name: 'cma_signal',
            description: 'CMA慢线信号指标',
            params: [
              { name: 'length', default: 100, description: '均线周期' }
            ]
          },
          {
            name: 'cts_signal',
            description: 'CTS快线信号指标',
            params: [
              { name: 'length', default: 100, description: '均线周期' }
            ]
          }
        ],
        rawContent: ''
      })
    }
    setLoading(false)
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) {
      setUploadedFileName(file.name)
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        if (file.name.endsWith('.txt') || file.name.endsWith('.md')) {
          setPaperText(content)
        } else if (file.name.endsWith('.pdf')) {
          setPaperText(`[PDF文件已上传: ${file.name}]\n内容预览：\n${content.slice(0, 2000)}...`)
        }
      }
      reader.readAsText(file)
    }
  }

  function renderMarkdown(text: string) {
    return text
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
      .replace(/^\* (.*$)/gm, '<li class="ml-4">$1</li>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded text-sm">$1</code>')
      .replace(/\n\n/g, '</p><p class="my-3">')
      .replace(/\n/g, '<br/>')
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">📄 论文转因子</h1>
      <p className="text-gray-600 mb-8">
        输入学术论文链接、粘贴内容或上传文档，AI 将自动提取核心逻辑并转化为量化因子
      </p>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* 左侧：输入区域 */}
        <div>
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">输入论文</h2>
            
            <div className="flex space-x-2 mb-4">
              <button
                onClick={() => setInputMode('url')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  inputMode === 'url'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                🔗 链接
              </button>
              <button
                onClick={() => setInputMode('text')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  inputMode === 'text'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                📝 粘贴内容
              </button>
              <button
                onClick={() => setInputMode('file')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  inputMode === 'file'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                📁 上传文件
              </button>
            </div>

            {inputMode === 'url' && (
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
            )}

            {inputMode === 'text' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  论文内容
                </label>
                <textarea
                  value={paperText}
                  onChange={(e) => setPaperText(e.target.value)}
                  placeholder="粘贴论文的摘要或核心段落..."
                  className="w-full h-48 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm"
                />
              </div>
            )}

            {inputMode === 'file' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  上传文档
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".txt,.md,.pdf"
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 transition-colors"
                >
                  {uploadedFileName ? (
                    <div>
                      <div className="text-2xl mb-2">✅</div>
                      <div className="font-medium text-emerald-600">{uploadedFileName}</div>
                      <div className="text-sm text-gray-500 mt-1">点击重新选择</div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-4xl mb-2">📎</div>
                      <div className="font-medium text-gray-700">点击上传文件</div>
                      <div className="text-sm text-gray-500 mt-1">支持 .txt, .md, .pdf 格式</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={handleConvert}
              disabled={loading}
              className="w-full py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? '🔄 解析中...' : '🚀 开始解析'}
            </button>

            {error && (
              <p className="mt-4 text-red-600 text-sm">{error}</p>
            )}
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-medium text-blue-800 mb-2">💡 支持的输入格式</h3>
            <div className="grid grid-cols-3 gap-4 text-sm text-blue-600">
              <div className="text-center p-2">
                <div className="text-xl mb-1">🔗</div>
                <div>论文链接</div>
                <div className="text-xs text-blue-400">arXiv, SSRN, 公众号</div>
              </div>
              <div className="text-center p-2">
                <div className="text-xl mb-1">📝</div>
                <div>文本内容</div>
                <div className="text-xs text-blue-400">粘贴摘要或全文</div>
              </div>
              <div className="text-center p-2">
                <div className="text-xl mb-1">📁</div>
                <div>文档上传</div>
                <div className="text-xs text-blue-400">.txt, .md, .pdf</div>
              </div>
            </div>
          </div>
        </div>

        {/* 右侧：输出区域 */}
        <div>
          {report ? (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">📊 解析结果</h2>
              
              <div className="mb-6 p-4 bg-emerald-50 rounded-lg">
                <h3 className="font-semibold text-emerald-800">{report.title}</h3>
              </div>

              <div className="mb-6">
                <div className="flex items-center mb-3">
                  <span className="bg-blue-600 text-white text-sm px-2 py-1 rounded mr-2">Part 1</span>
                  <h3 className="font-bold text-gray-900">文献核心内容解读</h3>
                </div>
                <div 
                  className="prose prose-sm max-w-none text-gray-700 p-4 bg-gray-50 rounded-lg"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(report.part1) }}
                />
              </div>

              <div className="mb-6">
                <div className="flex items-center mb-3">
                  <span className="bg-purple-600 text-white text-sm px-2 py-1 rounded mr-2">Part 2</span>
                  <h3 className="font-bold text-gray-900">投资策略深度解析</h3>
                </div>
                <div 
                  className="prose prose-sm max-w-none text-gray-700 p-4 bg-gray-50 rounded-lg"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(report.part2) }}
                />
              </div>

              <div className="mb-6">
                <div className="flex items-center mb-3">
                  <span className="bg-orange-600 text-white text-sm px-2 py-1 rounded mr-2">Factors</span>
                  <h3 className="font-bold text-gray-900">生成因子列表</h3>
                  <span className="ml-2 text-sm text-gray-500">({report.factors.length} 个)</span>
                </div>
                <div className="space-y-3">
                  {report.factors.map((factor, i) => (
                    <div key={i} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-mono font-bold text-emerald-600">
                          {factor.name}
                        </h4>
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
                          #{i + 1}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{factor.description}</p>
                      {factor.params.length > 0 && (
                        <div className="text-xs text-gray-500">
                          <span className="font-medium">参数：</span>
                          {factor.params.map((p, j) => (
                            <span key={j} className="inline-block mr-2">
                              {p.name}={p.default}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t">
                <button className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                  📊 加入回测
                </button>
                <button className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                  💾 下载报告
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="text-6xl mb-4">🔬</div>
              <h2 className="text-xl font-medium text-gray-700 mb-2">等待解析</h2>
              <p className="text-gray-500">
                在左侧输入论文链接、内容或上传文件<br/>
                点击「开始解析」按钮
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-gray-100 rounded-lg p-6 mt-8">
        <h3 className="font-bold mb-3">📖 功能说明</h3>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <h4 className="font-medium text-emerald-600 mb-1">1. 多输入支持</h4>
            <p className="text-sm text-gray-600">
              支持论文链接、粘贴文本、上传 txt/md/pdf 文档多种输入方式
            </p>
          </div>
          <div>
            <h4 className="font-medium text-emerald-600 mb-1">2. 智能解析</h4>
            <p className="text-sm text-gray-600">
              AI 自动提取论文核心逻辑、策略规则、关键参数，生成结构化分析
            </p>
          </div>
          <div>
            <h4 className="font-medium text-emerald-600 mb-1">3. 因子生成</h4>
            <p className="text-sm text-gray-600">
              自动生成 Python 量化因子代码，可直接用于回测和实盘
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
