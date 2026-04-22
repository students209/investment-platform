/**
 * Strategy Iterate API Route V2
 * - Multi-variant generation (3 per round)
 * - AST pre-validation
 * - Fault-tolerant (skip failed variants)
 * - Auto-increment version numbers
 * - lineage.json persistence
 */
import { NextRequest, NextResponse } from 'next/server'
import { spawn, execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { GoogleGenAI } from '@google/genai'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const SKILL_DIR = '/Users/alpha/.openclaw/workspace-quant_engineer/skills/策略回测报告'
const FACTOR_SKILL_DIR = '/Users/alpha/.openclaw/workspace-quant_engineer/skills/文章转因子'
const CUSTOM_STRAT_DIR = path.join(SKILL_DIR, 'custom_strategies')
const ALPHA101_PATH = "/Users/alpha/Documents/learn/quant/量化交易框架/alpha101.py"
const LINEAGE_PATH = path.join(SKILL_DIR, 'strategy', 'lineage.json')

// Variant styles for diversity
const VARIANT_STYLES = [
  { suffix: 'a', focus: '侧重风险控制：增加硬止损、波动率过滤、最大回撤约束等防御性逻辑' },
  { suffix: 'b', focus: '侧重收益增强：优化选股信号、引入多因子加权、增加趋势跟踪等进攻性逻辑' },
  { suffix: 'c', focus: '侧重稳健性：使用截面标准化、降低换手率、引入行业中性化等稳健性逻辑' },
]

type TaskStatus = 'running' | 'done' | 'error'
interface Task {
  id: string
  rootFactorName: string
  status: TaskStatus
  logs: string[]
  results: Record<string, any>
  startedAt: number
  finishedAt?: number
  error?: string
  rounds: number
}

const g = globalThis as any
if (!g.__strategyIterTasks) g.__strategyIterTasks = new Map<string, Task>()
const iterTasks: Map<string, Task> = g.__strategyIterTasks

function generateId() {
  return `stratiter_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

// --- Lineage helpers ---
interface LineageEntry {
  name: string
  parent: string
  root: string
  round: number
  variant: string
  createdAt: string
  kpi?: Record<string, any>
  improvementSummary?: string
  logicSummary?: string
}

function readLineage(): LineageEntry[] {
  try {
    if (fs.existsSync(LINEAGE_PATH)) {
      return JSON.parse(fs.readFileSync(LINEAGE_PATH, 'utf-8'))
    }
  } catch {}
  return []
}

function writeLineage(entries: LineageEntry[]) {
  const dir = path.dirname(LINEAGE_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(LINEAGE_PATH, JSON.stringify(entries, null, 2), 'utf-8')
}

function addLineageEntry(entry: LineageEntry) {
  const entries = readLineage()
  // Remove existing entry with same name (overwrite)
  const filtered = entries.filter(e => e.name !== entry.name)
  filtered.push(entry)
  writeLineage(filtered)
}

// --- Determine next version number ---
function getNextVersionBase(rootFactor: string): number {
  if (!fs.existsSync(CUSTOM_STRAT_DIR)) return 1
  const files = fs.readdirSync(CUSTOM_STRAT_DIR).filter(f => f.endsWith('.py'))
  let maxVer = 0
  for (const f of files) {
    const name = f.replace('.py', '')
    // Match patterns like rootFactor_v1a, rootFactor_v2b, etc.
    const m = name.match(new RegExp(`^${rootFactor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_v(\\d+)[a-z]?$`))
    if (m) {
      maxVer = Math.max(maxVer, parseInt(m[1]))
    }
  }
  return maxVer + 1
}

// --- Run python subprocess ---
function runPython(scriptPath: string, args: string[], cwd: string, env: Record<string, string>, logger: (log: string) => void): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn('python3', [scriptPath, ...args], { cwd, env: env as NodeJS.ProcessEnv, stdio: ['ignore', 'pipe', 'pipe'] })
    if (proc.stdout) {
      proc.stdout.on('data', (d: Buffer) => {
        d.toString().split('\n').filter(l => l.trim()).forEach(line => logger(line))
      })
    }
    if (proc.stderr) {
      proc.stderr.on('data', (d: Buffer) => {
        d.toString().split('\n').filter(l => l.trim()).forEach(line => {
          // Filter noisy warnings
          if (line.includes('urllib3') || line.includes('NotOpenSSL') || line.includes('DeprecationWarning')) return
          logger(`[stderr] ${line}`)
        })
      })
    }
    proc.on('close', (code: any) => resolve(code || 0))
    proc.on('error', () => resolve(1))
  })
}

// --- AST syntax check ---
function checkPythonSyntax(filePath: string): { ok: boolean; error?: string } {
  try {
    execSync(`python3 -c "import ast; ast.parse(open('${filePath}').read())"`, {
      timeout: 10000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.stderr?.toString() || e.message }
  }
}

// --- Get parent source code ---
function getParentCode(factorName: string): string {
  // Try custom_strategies first
  const sourcePath = path.join(CUSTOM_STRAT_DIR, `${factorName}.py`)
  if (fs.existsSync(sourcePath)) {
    return fs.readFileSync(sourcePath, 'utf-8')
  }
  // Fallback to alpha101.py
  if (fs.existsSync(ALPHA101_PATH)) {
    const fullLib = fs.readFileSync(ALPHA101_PATH, 'utf-8')
    const regex = new RegExp(`(def\\s+${factorName}\\s*\\([\\s\\S]*?\\):[\\s\\S]*?)(?=\\ndef\\s|\\n#\\s*=|$)`, 'm')
    const match = fullLib.match(regex)
    if (match) return match[1]
  }
  return ''
}

// --- Build the evolution prompt ---
function buildPrompt(newFactorName: string, parentCode: string, diagnosis: string, variantFocus: string): string {
  return `你是一名量化金工大神架构师。现在需要对量化选股策略进行迭代升级。

【原始母本代码】
\`\`\`python
${parentCode}
\`\`\`

【回测诊断反馈与改进建议】
${diagnosis || '无诊断反馈，请发散你的想象力对策略进行多因子改进或风控升级。'}

【本变体侧重方向】
${variantFocus}

请输出一份升级版的独立可执行 Python 代码。

严格要求（违反任何一条都不合格）：
1. 必须定义函数 \`def ${newFactorName}(df):\`
2. 输入 df 包含列: date, instrument, open, high, low, close, volume, amount, turn, pct_chg
3. 返回值必须是 DataFrame，包含且仅包含三列: \`date\`, \`instrument\`, \`${newFactorName}\`
4. 所有中间计算变量必须先赋值给 df 列（如 \`df['tmp'] = ...\`）再引用，严禁使用未定义的列名
5. 使用 fillna(0) 处理缺失值
6. 只使用 pandas 和 numpy，不要导入其他库

参考代码骨架（请严格遵循此结构）:
\`\`\`python
import pandas as pd
import numpy as np

def ${newFactorName}(df):
    """策略描述"""
    df = df.sort_values(['date', 'instrument']).copy()
    
    # 计算中间变量 - 注意必须赋值给 df 的列
    df['tmp_signal'] = ...  # 你的计算逻辑
    
    # 计算最终因子值
    df['${newFactorName}'] = df['tmp_signal'].fillna(0)
    
    # 只返回必要的三列
    result = df[['date', 'instrument', '${newFactorName}']].copy()
    return result
\`\`\`

直接输出纯 Python 代码，禁止使用 Markdown 代码块包裹。`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      baseFactorName,
      rounds = 1,
      model = 'gemini-3.1-flash-lite-preview',
      startDate = '2022-01-01',
      endDate = '2024-12-31',
      holdCount = 5,
      rebalanceDays = 5,
      customPrompt = '',
    } = body
    const isInteractive = !!customPrompt

    if (!baseFactorName) {
      return NextResponse.json({ success: false, error: '缺少基础策略名称' }, { status: 400 })
    }
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ success: false, error: '未配置 GEMINI_API_KEY' }, { status: 400 })
    }

    const taskId = generateId()
    const maxRounds = Math.min(rounds, 3)

    // Determine root factor (strip _vXx suffix)
    let rootFactor = baseFactorName
    const m = baseFactorName.match(/^(.*?)_v\d+[a-z]?$/)
    if (m) rootFactor = m[1]

    const task: Task = {
      id: taskId,
      rootFactorName: rootFactor,
      status: 'running',
      logs: [],
      results: {},
      startedAt: Date.now(),
      rounds: maxRounds,
    }
    iterTasks.set(taskId, task)

    // Background async execution
    ;(async () => {
      const log = (msg: string) => task.logs.push(msg)
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

      let currentParentFactor = baseFactorName
      const allGeneratedFactors: string[] = []
      let bestVariantPerRound: string = baseFactorName

      try {
        for (let r = 1; r <= maxRounds; r++) {
          // Determine version number base
          const versionNum = getNextVersionBase(rootFactor)

          log(`\n${'═'.repeat(50)}`)
          log(`🧬 策略进化 — 第 ${r}/${maxRounds} 轮 (版本 v${versionNum})`)
          log(`   母本策略: ${currentParentFactor}`)
          log(`${'═'.repeat(50)}`)

          // 1. Get parent code
          const parentCode = getParentCode(currentParentFactor)
          if (!parentCode) {
            log(`⚠️ 找不到 ${currentParentFactor} 的源码，跳过此轮`)
            continue
          }

          // 2. Get diagnosis report
          const diagPath = path.join(SKILL_DIR, 'strategy', currentParentFactor, `strategy_analysis_${currentParentFactor}.md`)
          let diagnosis = ''
          if (fs.existsSync(diagPath)) {
            diagnosis = fs.readFileSync(diagPath, 'utf-8')
            log(`📊 已载入母本诊断报告`)
          }

          // 3. Generate variants (3 for auto, 1 for interactive)
          const roundVariants: string[] = []
          const variantsToGenerate = isInteractive 
            ? [{ suffix: 'a', focus: `用户自定义迭代方向：${customPrompt}` }]
            : VARIANT_STYLES

          for (const variant of variantsToGenerate) {
            const newFactorName = `${rootFactor}_v${versionNum}${variant.suffix}`
            log(`\n--- 生成变体 ${newFactorName} (${variant.focus.slice(0, 30)}...) ---`)

            const prompt = buildPrompt(newFactorName, parentCode, diagnosis, variant.focus)

            let code = ''
            let retries = 0
            const maxRetries = 2

            while (retries <= maxRetries) {
              try {
                log(`[系统] 调用 AI (${model})${retries > 0 ? ` 重试 #${retries}` : ''}...`)
                const resp = await ai.models.generateContent({
                  model,
                  contents: prompt + (retries > 0 ? '\n\n注意：上次生产的代码有语法错误，请务必检查括号匹配和缩进。' : ''),
                  config: { temperature: 0.4 + retries * 0.1 }
                })

                code = resp.text || ''
                // Strip markdown fences if present
                code = code.replace(/^```python\s*/gm, '').replace(/^```\s*/gm, '').trim()

                if (!code || !code.includes(`def ${newFactorName}`)) {
                  log(`⚠️ AI 未生成有效的函数 ${newFactorName}，重试...`)
                  retries++
                  continue
                }

                // Write to file
                if (!fs.existsSync(CUSTOM_STRAT_DIR)) fs.mkdirSync(CUSTOM_STRAT_DIR, { recursive: true })
                const destPath = path.join(CUSTOM_STRAT_DIR, `${newFactorName}.py`)
                fs.writeFileSync(destPath, code, 'utf-8')

                // AST syntax check
                const syntaxCheck = checkPythonSyntax(destPath)
                if (!syntaxCheck.ok) {
                  log(`⚠️ 语法检查不通过: ${syntaxCheck.error?.slice(0, 100)}`)
                  retries++
                  continue
                }

                log(`✅ ${newFactorName}.py 语法检查通过`)
                break // success
              } catch (e: any) {
                log(`⚠️ AI 调用异常: ${e.message}`)
                retries++
              }
            }

            if (retries > maxRetries || !code) {
              log(`❌ ${newFactorName} 经过 ${maxRetries + 1} 次尝试仍失败，跳过此变体`)
              continue
            }

            // 4. Run backtest
            log(`[系统] 回测 ${newFactorName}...`)
            const TARGET_DIR = path.join(SKILL_DIR, 'strategy', newFactorName)
            if (!fs.existsSync(TARGET_DIR)) fs.mkdirSync(TARGET_DIR, { recursive: true })

            const wrapperCode = `
import sys, os
os.chdir(${JSON.stringify(TARGET_DIR)})
sys.path.insert(0, ${JSON.stringify(SKILL_DIR)})

import run_integrated_backtest as rib
rib.CONFIG['factor_name'] = ${JSON.stringify(newFactorName)}
rib.CONFIG['start_date'] = ${JSON.stringify(startDate)}
rib.CONFIG['end_date'] = ${JSON.stringify(endDate)}
rib.CONFIG['hold_count'] = ${holdCount}
rib.CONFIG['rebalance_days'] = ${rebalanceDays}

rib.StrategyAnalysis.LOCAL_DATA_CACHE = {}
rib.StrategyAnalysis.PRICE_CACHE = {}
import glob
for f in ["price_cache.json", "sector_cache.csv"]:
    fp = os.path.join(${JSON.stringify(SKILL_DIR)}, f)
    if os.path.exists(fp):
        os.remove(fp)

rib.run_backtest_logic()
rib.run_analysis_main()
print("===BACKTEST_COMPLETE===")
`
            const wrapperPath = path.join(TARGET_DIR, `_wrapper_iter.py`)
            fs.writeFileSync(wrapperPath, wrapperCode, 'utf-8')

            const env = { ...process.env, PYTHONPATH: FACTOR_SKILL_DIR } as Record<string, string>
            const exitCode = await runPython(wrapperPath, [], TARGET_DIR, env, log)
            try { fs.unlinkSync(wrapperPath) } catch {}

            if (exitCode === 0) {
              log(`✅ ${newFactorName} 回测成功！`)

              // Generate AI diagnostic for this variant
              try {
                const kpiPath = path.join(TARGET_DIR, 'kpi.json')
                const tradePath = path.join(TARGET_DIR, 'trade_loss_rank.csv')
                let reqData = `回测区间: ${startDate} 至 ${endDate}\n`
                if (fs.existsSync(kpiPath)) {
                  reqData += `\n【核心汇总指标 (KPI)】:\n${fs.readFileSync(kpiPath, 'utf-8')}\n`
                }
                if (fs.existsSync(tradePath)) {
                  const tradeRows = fs.readFileSync(tradePath, 'utf-8').split('\n').filter(l => l.trim())
                  reqData += `\n交易明细(首尾采样):\n`
                  reqData += tradeRows.slice(0, 20).join('\n')
                  if (tradeRows.length > 40) {
                    reqData += '\n...\n' + tradeRows.slice(-20).join('\n')
                  }
                }
                const diagPrompt = `你是一名顶级量化基金经理。以下是策略 ${newFactorName} （主攻方向：${variant.focus}）的评估数据，【KPI】是准确全局统计结果：\n${reqData}\n任务：\n1. 请在报告的最开头，使用 \`> 策略概要：\` 作为前缀，用一两句话（字数<80）概括该策略在代码逻辑上的选股或交易特征（不谈KPI，只讲策略业务逻辑，如：利用动量突破并结合ATR止损）。\n2. 在其下方另起一行，使用 \`> 进化结论：\` 作为前缀，用一句话（50字以内）概括表现差异和原因，例如：“> 进化结论：收益大幅提升但最大回撤达到40%，原因是激进的换手率放大了趋势追踪的成本损耗。”\n3. 随后以该数据为准写一份完整的 Markdown 策略深度诊断分析报告。`
                const diagResp = await ai.models.generateContent({ model, contents: diagPrompt, config: { temperature: 0.3 } })
                fs.writeFileSync(path.join(TARGET_DIR, `strategy_analysis_${newFactorName}.md`), diagResp.text || '', 'utf-8')
              } catch (e: any) {
                log(`⚠️ 诊断报告生成失败: ${e.message}`)
              }

              // Call merge_report.py to create Final_Strategy_Report_{factor}.html
              log(`[系统] 正在合并生成完整交互式报告...`)
              await runPython(
                path.join(SKILL_DIR, 'merge_report.py'),
                ['--dir', TARGET_DIR, '--factor', newFactorName],
                TARGET_DIR,
                env,
                () => {}
              )
              log(`✅ ${newFactorName} 完整报告已生成`)

              // Read KPI for lineage
              let kpiData: Record<string, any> = {}
              try {
                const kpiPath2 = path.join(TARGET_DIR, 'kpi.json')
                if (fs.existsSync(kpiPath2)) {
                  kpiData = JSON.parse(fs.readFileSync(kpiPath2, 'utf-8'))
                }
              } catch {}

              // Generate improvement summary from variant focus + KPI
              const returnPct = kpiData['01_策略收益'] != null ? (parseFloat(kpiData['01_策略收益']) * 100).toFixed(1) + '%' : '未知'
              const winRate = kpiData['08_胜率'] != null ? (parseFloat(kpiData['08_胜率']) * 100).toFixed(1) + '%' : '未知'
              const maxDd = kpiData['10_最大回撤'] != null ? (parseFloat(kpiData['10_最大回撤']) * 100).toFixed(1) + '%' : '未知'
              let finalSummary = `${variant.focus.split('：')[0]}：收益${returnPct}，胜率${winRate}，回撤${maxDd}` // fallback
              
              const diagText = fs.existsSync(path.join(TARGET_DIR, `strategy_analysis_${newFactorName}.md`)) 
                  ? fs.readFileSync(path.join(TARGET_DIR, `strategy_analysis_${newFactorName}.md`), 'utf-8') 
                  : ''
              
              const matchConcl = diagText.match(/>\s*进化结论：(.*?)(?=\n|$)/)
              if (matchConcl && matchConcl[1]) {
                finalSummary = `✨ ${matchConcl[1].trim()}`
              }
              let actualLogicSummary = ''
              const matchDesc = diagText.match(/>\s*策略概要：(.*?)(?=\n|$)/)
              if (matchDesc && matchDesc[1]) {
                actualLogicSummary = matchDesc[1].trim()
                fs.writeFileSync(path.join(TARGET_DIR, 'description.txt'), actualLogicSummary, 'utf-8')
              }

              roundVariants.push(newFactorName)
              allGeneratedFactors.push(newFactorName)

              // Record lineage with KPI and improvement summary
              addLineageEntry({
                name: newFactorName,
                parent: currentParentFactor,
                root: rootFactor,
                round: versionNum,
                variant: variant.suffix,
                createdAt: new Date().toISOString(),
                kpi: kpiData,
                improvementSummary: finalSummary,
                logicSummary: actualLogicSummary,
              })
            } else {
              log(`❌ ${newFactorName} 回测失败 (exit ${exitCode})，跳过`)
            }
          }

          // Pick best variant for next round (use the first successful one for now)
          if (roundVariants.length > 0) {
            // Try to pick by KPI (highest total return)
            let bestFactor = roundVariants[0]
            let bestReturn = -Infinity
            for (const v of roundVariants) {
              try {
                const kpiPath = path.join(SKILL_DIR, 'strategy', v, 'kpi.json')
                if (fs.existsSync(kpiPath)) {
                  const kpi = JSON.parse(fs.readFileSync(kpiPath, 'utf-8'))
                  const totalReturn = parseFloat(kpi['01_策略收益'] || kpi['总收益率'] || '0')
                  if (totalReturn > bestReturn) {
                    bestReturn = totalReturn
                    bestFactor = v
                  }
                }
              } catch {}
            }
            currentParentFactor = bestFactor
            log(`\n🏆 本轮最优变体: ${bestFactor}${bestReturn > -Infinity ? ` (收益率: ${(bestReturn * 100).toFixed(1)}%)` : ''}`)
          } else {
            log(`\n⚠️ 本轮所有变体均失败，使用原母本继续`)
          }
        }

        task.status = 'done'
        task.results = { rootFactor, generatedFactors: allGeneratedFactors }
      } catch (e: any) {
        log(`\n❌ 迭代过程异常: ${e.message}`)
        task.status = 'error'
        task.error = e.message
        task.results = { rootFactor, generatedFactors: allGeneratedFactors }
      }
      task.finishedAt = Date.now()
    })()

    return NextResponse.json({ success: true, data: { taskId } })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  // Lineage query
  const lineageQuery = searchParams.get('lineage')
  if (lineageQuery === 'true') {
    const entries = readLineage()
    return NextResponse.json({ success: true, data: { lineage: entries } })
  }

  // Specific root lineage
  const rootQuery = searchParams.get('root')
  if (rootQuery) {
    const entries = readLineage().filter(e => e.root === rootQuery)
    // Backfill KPI for entries missing it
    for (const entry of entries) {
      if (!entry.kpi || Object.keys(entry.kpi).length === 0) {
        try {
          const kpiPath = path.join(SKILL_DIR, 'strategy', entry.name, 'kpi.json')
          if (fs.existsSync(kpiPath)) {
            const kpi = JSON.parse(fs.readFileSync(kpiPath, 'utf-8'))
            entry.kpi = kpi
            // Generate improvement summary if missing
            if (!entry.improvementSummary || entry.improvementSummary.startsWith('#')) {
              const returnPct = kpi['01_策略收益'] != null ? (parseFloat(kpi['01_策略收益']) * 100).toFixed(1) + '%' : '未知'
              const winRate = kpi['08_胜率'] != null ? (parseFloat(kpi['08_胜率']) * 100).toFixed(1) + '%' : '未知'
              const maxDd = kpi['10_最大回撤'] != null ? (parseFloat(kpi['10_最大回撤']) * 100).toFixed(1) + '%' : '未知'
              const variantLabel = entry.variant === 'a' ? '侧重风险控制' : entry.variant === 'b' ? '侧重收益增强' : '侧重稳健性'
              entry.improvementSummary = `${variantLabel}：收益${returnPct}，胜率${winRate}，最大回撤${maxDd}`
            }
          }
        } catch {}
      }
    }
    return NextResponse.json({ success: true, data: { lineage: entries } })
  }

  // Task status
  const taskId = searchParams.get('taskId')
  if (!taskId || !iterTasks.has(taskId)) {
    return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 })
  }
  const task = iterTasks.get(taskId)!
  return NextResponse.json({
    success: true,
    data: {
      status: task.status,
      logs: task.logs,
      results: task.results,
      error: task.error,
      elapsed: Math.floor((Date.now() - task.startedAt) / 1000),
    }
  })
}
