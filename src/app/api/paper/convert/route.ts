/**
 * Paper-to-Factor API Route
 * Uses Gemini API to parse papers/articles into structured factor analysis reports
 */
import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import fs from 'fs'
import path from 'path'

// API Key: MUST be set via environment variable (not hardcoded to avoid GitHub leak detection)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''

// Prompt template based on 研报论文解读模板-v1.md
const SYSTEM_PROMPT = `#### **角色与目标**
你是一名顶级的量化策略分析师与量化开发工程师。你的核心任务是接收一份投资研究报告、金融论文或策略分析文章，进行深入、全面的剖析，并输出一份结构化、深度的分析报告。这份报告必须严格分为两个部分：第一部分是对文章核心思想的摘要，第二部分是对其中所有投资策略的详细拆解。

#### **输出要求**
1. **精确提取**：所有信息，如回测周期、参数（如10个月移动平均线）、具体数值等，都必须精确地从原文中提取，不得进行任何形式的推断或创造。
2. **全面覆盖**：必须识别并解析原文中提到的**所有**独立投资策略，包括但不限于基础策略、以及在其上进行改进的任何衍生策略。
3. **语言处理**：如果输入文本为英文或其他非中文语言，请将**第一部分（文章核心摘要）**的所有内容翻译成**中文**。第二部分应尽量保持原文的关键术语，但需用中文进行结构化描述。
4. **格式严格**：最终输出必须是一个完整的Markdown文档，严格遵循下文定义的结构。

---

## **输出结构模板**

### **第一部分：文献核心内容解读**

#### 1. 标题
* [完整标题]

#### 2. 摘要
* [精准概括的报告摘要]

#### 3. 核心观点
* [分点列举关键发现、创新之处或核心论证]

#### 4. 总结
* [综合总结研究价值和实践意义]

---

### **第二部分：投资策略深度解析**

为每一个识别出的策略，生成一个独立的分析模块。

#### **策略：[策略的描述性名称]**

**1. 策略描述 (Strategy Description)**
* **投资宇宙 (Investment Universe):** 所有可投资的资产类别或具体证券范围。
* **核心思想 (Core Idea):** 基本投资逻辑和市场理念。
* **详细规则 (Detailed Rules):**
    * **排名规则:** 描述如何对资产进行排序。
    * **买入规则:** 描述具体的建仓条件。
    * **卖出规则:** 描述具体的平仓条件。
    * **调仓频率 (Rebalancing):** 再平衡频率。
* **回测周期 (Backtest Period):** 原文中提及的回测开始和结束日期。

**2. 回测逻辑与关键指标 (Backtesting Logic & Key Metrics)**
* **所需数据 (Required Data):** 执行该策略回测所必需的数据集。
* **关键参数 (Key Parameters):**

| 参数名称 | 符号 | 描述 | 默认值 |
| :--- | :--- | :--- | :--- |
| 示例 | N | 回看期 | 20 |

* **执行步骤 (Execution Steps):** 分步描述调仓周期内的具体操作流程。

---

### **第三部分：因子表达式脚本**

基于上述分析报告，生成 Python 因子表达式代码。命名规则：alpha_{类型}_{序号}

\`\`\`python
def alpha_trend_001(df, params=None):
    '''
    因子描述
    Args:
        df: 包含历史行情数据的DataFrame (含 instrument, date, open, high, low, close, volume, amount, turn, pct_chg)
        params: 参数字典
    Returns:
        DataFrame: 包含 instrument, date, factor_name 字段
    '''
    df = df.sort_values(['instrument', 'date']).copy()
    if params is None:
        params = {}
    # 计算因子逻辑
    return df[['instrument', 'date', 'alpha_trend_001']]
\`\`\`

请为每个发现的策略都生成对应的Python因子代码。`

// Models to try in order (most capable first)
const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
]

// Reports directory
const REPORTS_DIR = '/Users/alpha/.openclaw/workspace-quant_engineer/skills/文章转因子/reports'

function ensureReportsDir() {
  try {
    if (!fs.existsSync(REPORTS_DIR)) {
      fs.mkdirSync(REPORTS_DIR, { recursive: true })
    }
    return true
  } catch {
    return false
  }
}

function saveReport(title: string, content: string): string | null {
  try {
    if (!ensureReportsDir()) return null
    const timestamp = new Date().toISOString().slice(0, 10)
    const safeName = title.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_').slice(0, 50)
    const filename = `${timestamp}_${safeName}_解析报告.md`
    const filePath = path.join(REPORTS_DIR, filename)
    fs.writeFileSync(filePath, content, 'utf-8')
    return filename
  } catch {
    return null
  }
}

// Retry helper with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (e: unknown) {
      lastError = e
      const errMsg = e instanceof Error ? e.message : String(e)
      // Don't retry on auth errors (leaked key, invalid key)
      if (errMsg.includes('403') || errMsg.includes('401') || errMsg.includes('API_KEY_INVALID') || errMsg.includes('leaked')) {
        throw e
      }
      // Exponential backoff for retryable errors (429, 500, 503)
      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500
        console.log(`[Gemini] Attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError
}

function parseReport(fullReport: string) {
  let part1 = ''
  let part2 = ''

  const part1Match = fullReport.match(/###?\s*\*?\*?第一部分[：:]?\s*文献核心内容解读\*?\*?\s*\n([\s\S]*?)(?=###?\s*\*?\*?第二部分)/i)
  if (part1Match) {
    part1 = part1Match[1].trim()
  }

  const part2Match = fullReport.match(/###?\s*\*?\*?第二部分[：:]?\s*投资策略深度解析\*?\*?\s*\n([\s\S]*?)(?=###?\s*\*?\*?第三部分|$)/i)
  if (part2Match) {
    part2 = part2Match[1].trim()
  }

  // Fallback: split on section markers
  if (!part1 && !part2) {
    const sections = fullReport.split(/^#{2,3}\s+第/m)
    if (sections.length >= 2) {
      part1 = sections[1] ? '## 第' + sections[1] : ''
      part2 = sections[2] ? '## 第' + sections[2] : ''
    } else {
      part1 = fullReport.slice(0, Math.floor(fullReport.length / 2))
      part2 = fullReport.slice(Math.floor(fullReport.length / 2))
    }
  }

  // Extract factor names from code blocks
  const factorNames = [...fullReport.matchAll(/def\s+(alpha_\w+)/g)]
  const factors = factorNames.slice(0, 10).map((match, i) => ({
    name: match[1],
    description: `基于输入内容生成的量化因子 #${i + 1}`,
    params: [{ name: 'window', default: 20, description: '回看周期' }]
  }))

  if (factors.length === 0) {
    factors.push({
      name: 'alpha_custom_001',
      description: '基于输入内容生成的量化因子',
      params: [{ name: 'window', default: 20, description: '回看周期' }]
    })
  }

  let title = '论文分析报告'
  const titleMatch = part1.match(/####?\s*1\.\s*标题\s*\n+\*?\s*(.+)/m)
  if (titleMatch) {
    title = titleMatch[1].replace(/^\*\s*/, '').replace(/\*$/, '').trim()
  }

  return { title, part1, part2, factors }
}

export async function POST(request: NextRequest) {
  try {
    // Check API key first
    if (!GEMINI_API_KEY) {
      return NextResponse.json({
        success: false,
        error: '未配置 GEMINI_API_KEY。请在项目根目录创建 .env.local 文件并添加：GEMINI_API_KEY=你的密钥\n\n获取密钥：https://aistudio.google.com/apikey'
      })
    }

    const body = await request.json()
    const { url, text, filename } = body

    let content = ''
    let sourceTitle = '未命名'

    if (text) {
      content = text
      sourceTitle = filename || '粘贴内容'
    } else if (url) {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
        })
        content = await res.text()
        content = content.replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        sourceTitle = url
      } catch {
        return NextResponse.json({ success: false, error: '无法获取URL内容，请检查链接是否正确' })
      }
    }

    if (!content) {
      return NextResponse.json({ success: false, error: '请提供论文内容' })
    }

    // Truncate if too long
    const maxChars = 100000
    if (content.length > maxChars) {
      content = content.slice(0, maxChars) + '\n\n[内容已截断...]'
    }

    // Try models in order with retry
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })
    let fullReport = ''
    let usedModel = ''
    const errors: string[] = []

    for (const model of MODELS) {
      try {
        console.log(`[Gemini] Trying model: ${model}`)
        const response = await retryWithBackoff(async () => {
          return await ai.models.generateContent({
            model,
            contents: `${SYSTEM_PROMPT}\n\n---\n\n请分析以下内容并生成报告：\n\n${content}`,
            config: {
              maxOutputTokens: 8192,
              temperature: 0.3,
            },
          })
        }, 2, 2000) // 2 retries, 2s base delay

        fullReport = response.text || ''
        if (fullReport) {
          usedModel = model
          console.log(`[Gemini] Success with model: ${model}`)
          break
        }
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e)
        console.log(`[Gemini] Model ${model} failed: ${errMsg.slice(0, 150)}`)
        
        // Parse specific error types for user-friendly messages
        if (errMsg.includes('leaked') || errMsg.includes('API_KEY_INVALID')) {
          return NextResponse.json({
            success: false,
            error: 'API Key 已失效（被 Google 检测为泄露）。请前往 https://aistudio.google.com/apikey 生成新的 API Key，然后在 .env.local 文件中更新 GEMINI_API_KEY 的值。'
          })
        }
        if (errMsg.includes('403')) {
          errors.push(`${model}: 权限不足`)
        } else if (errMsg.includes('429')) {
          errors.push(`${model}: 请求频率超限`)
        } else if (errMsg.includes('404')) {
          errors.push(`${model}: 模型不可用`)
        } else {
          errors.push(`${model}: ${errMsg.slice(0, 80)}`)
        }
        continue
      }
    }

    if (!fullReport) {
      return NextResponse.json({
        success: false,
        error: `所有模型调用失败：\n${errors.join('\n')}\n\n请检查 API Key 是否有效或稍后重试。`
      })
    }

    // Parse the report
    const { title, part1, part2, factors } = parseReport(fullReport)

    // Save report locally
    const savedFilename = saveReport(sourceTitle, fullReport)

    return NextResponse.json({
      success: true,
      data: {
        title: title || `论文分析报告 - ${sourceTitle}`,
        part1,
        part2,
        factors,
        rawContent: fullReport,
        savedFilename,
        usedModel,
      }
    })
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ success: false, error: `服务器错误：${errMsg}` })
  }
}
