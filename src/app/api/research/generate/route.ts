/**
 * AI Research Report Generation API
 * Uses Gemini to generate industry/company research reports
 * following the structure of existing high-quality reports
 */
import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import fs from 'fs'
import path from 'path'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''

// Output directories
const INSIGHTS_DIR = '/Users/alpha/Documents/learn/openclaw_project/teamwork_html/docs/insights'
const INDUSTRIES_DIR = path.join(INSIGHTS_DIR, 'research/industries')
const COMPANIES_DIR = path.join(INSIGHTS_DIR, 'research/companies')

function getTodayStr() {
  const d = new Date()
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60 * 1000)
  return local.toISOString().split('T')[0]
}

function getWeekday() {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[new Date().getDay()]
}

// -------- SYSTEM PROMPTS (reverse-engineered from existing high-quality reports) --------

const INDUSTRY_SYSTEM_PROMPT = `你是一名顶级卖方研究所行业首席分析师，拥有10年以上A股/港股行业研究经验。你将根据用户指定的行业关键词，输出一份完整、数据密集、结构化的行业研究报告。

## 报告封面（必须是文件第一行）
---
title: "[行业名]行业研究报告 YYYY-MM-DD"
date: YYYY-MM-DD
category: 行业研究
industry: "[行业名]"
tags: [标签1, 标签2, 标签3, 标签4, 标签5]
summary: "一段话摘要（含市场规模数字+同比增速+核心驱动+推荐标的）"
---

## 报告正文结构（严格按以下十四大章撰写）

### 一、行业概述
- 行业定义与分类
- 行业运行特征（周期性、重资产、网络效应、政策敏感性）
- 行业发展阶段判断（导入期/成长期/成熟增长期/衰退期）

### 二、市场规模与格局
- 行业整体市场规模（全球/中国）
- 竞争格局（市场集中度、头部玩家、全球对比）
- 行业增长驱动因素

### 三、产业链分析
- 产业链全景图（上/中/下游）
- 各环节盈利能力对比
- 关键成本结构分析

### 四、政策环境分析
- 国家战略规划
- 2025-2026年最新政策动向
- 政策环境影响评估

### 五、重点企业财务对比
- 核心标的简介与财务表现
- 重点企业财务指标对比表（市值、PE、PB、净利润增速、ROE、资产负债率）

### 六、投资机会与风险
- 核心投资观点（含主语+方向+涨跌幅+目标位）
- 子行业投资评级汇总
- 系统性风险/个股风险/风险监控指标

### 七、结论与展望
- 行业配置建议
- 机遇与挑战
- 关键变量跟踪

### 八、行业估值分析
#### 8.1 当前估值水平
- 行业PE/PB当前值（TTM）、历史分位数
- 与历史均值对比
#### 8.2 估值驱动因素
#### 8.3 跨行业/跨市场对比

### 九、机构观点与催化剂
#### 9.1 券商评级与目标价
#### 9.2 行业重要事件
#### 9.3 资金流向与技术形态

### 十、宏观环境对行业的影响
#### 10.1 宏观数据对行业的影响

### 十一、行业周期与资金动向
#### 11.1 行业周期定位
#### 11.2 资金动向分析

### 十二、产业链深度分析
#### 12.1 产业链咽喉节点
#### 12.2 竞争壁垒深度评估

### 十三、行业重要事件追踪
#### 13.1 重大事件回顾
#### 13.2 事件影响评估

### 十四、企业财务风险与ESG
#### 14.1 企业财务风险预警
#### 14.2 行业ESG评分

报告末尾加分隔线后注明：
*报告生成日期：YYYY-MM-DD*
*数据来源：国家统计局、公司财报、Wind、同花顺等*

## 写作准则
1. **数据密度极高**：每个段落都必须包含具体数字（营收/利润/增速/市占率/PE等），禁止空泛论述
2. **格式美观**：多用Markdown表格展示数据
3. **表格丰富**：几乎每一章都需要配合表格说明
4. **对比分析**：必须有同比、环比、同业对比等框架
5. **全文至少8000字**
`

const COMPANY_SYSTEM_PROMPT = `你是一名顶级卖方研究所个股首席分析师，擅长Buffett价值投资框架。你将根据用户指定的企业关键词，输出一份完整、数据密集、结构化的企业研究报告。

## 报告封面（必须是文件第一行）
---
title: "[公司名]企业研究报告"
date: YYYY-MM-DD
category: 企业研究
company: "[公司名]"
stock_code: "[股票代码]"
tags: [标签1, 标签2, 标签3, 标签4, 标签5]
summary: "一段话摘要（含最新营收/净利润+同比增速+核心催化剂+评级+目标价）"
---

封面后紧接一级标题和基本信息行：
# [公司名]（[股票代码]）企业研究报告
**报告日期：** YYYY年M月D日 | **股票代码：** [代码]

## 报告正文结构（严格按以下十八大章撰写）

### 一、公司基本情况
- 主营业务构成、行业地位

### 二、护城河分析（Buffett框架）
- 护城河类型与证据、稳定性评估

### 三、管理层与资本配置
- 管理层能力评估与资本配置历史

### 四、财务韧性分析
- 利润表健康度、资产负债表与现金流

### 五、所有者收益估算
- 5年所有者收益趋势推算

### 六、估值分析
#### 6.1 相对估值法
#### 6.2 绝对估值法（必须包含DCF简版模型表）
#### 6.3 估值总结与安全边际

### 七、机构观点与一致预期
#### 7.1 券商评级与目标价
#### 7.2 重大公告追踪
#### 7.3 股东结构变化

### 八、同业可比公司估值对比
#### 8.1 估值指标对比（PE/PB等）

### 九、事件驱动投资机会
#### 9.1 并购重组与回购增持动向

### 十、公司财务体检
#### 10.1 杜邦分析与盈利质量评估
#### 10.2 财务风险预警模型

### 十一、股东结构与资金流向
#### 11.1 机构及北向资金持仓追踪

### 十二、董监高增减持追踪
#### 12.1 股权质押与高管增持

### 十三、业绩预告与超预期分析
#### 13.1 业绩快报追踪与超预期逻辑

### 十四、机构持仓追踪
#### 14.1 公募/外资持股比例变化

### 十五、上下游客户分析
#### 15.1 客户集中度与议价能力

### 十六、市场情绪偏离分析
#### 16.1 估值与基本面背离分析

### 十七、投资逻辑跟踪框架
#### 17.1 核心投资逻辑、里程碑事件预警

### 十八、投资组合建议
#### 18.1 建仓策略、止损与止盈点位

> 声明：本报告仅供信息参考，不构成任何投资建议。投资有风险，决策需审慎。
---
*报告生成日期：YYYY年M月D日*
*数据来源：公司公告、财报、Wind、同花顺等*

## 写作准则
1. **数据密度极高**：每段必须含有具体数字。
2. **表格丰富**：关键数字必须转化为Markdown表格。
3. **Buffett框架核心**：全面体现对护城河及安全边际的洞见。
4. **精确估值建议**：必须输出相对和绝对估值的详细推算过程。
5. **全文至少10000字**。
`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      keyword,
      type = 'industry', // 'industry' | 'company'
      model = 'gemini-3.1-flash-lite-preview',
    } = body

    if (!keyword || !keyword.trim()) {
      return NextResponse.json(
        { success: false, error: '请输入行业或企业关键词' },
        { status: 400 }
      )
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'GEMINI_API_KEY 未配置' },
        { status: 500 }
      )
    }

    const today = getTodayStr()
    const weekday = getWeekday()
    const trimmedKeyword = keyword.trim()

    const systemPrompt = type === 'company' ? COMPANY_SYSTEM_PROMPT : INDUSTRY_SYSTEM_PROMPT
    const userPrompt = type === 'company'
      ? `请为 **${trimmedKeyword}** 生成一份企业研究报告。
日期: ${today}
星期: ${weekday}

要求：严格按照十八大章结构输出完整报告，每章都必须包含表格和具体数字。全文不少于10000字。`
      : `请为 **${trimmedKeyword}** 行业生成一份行业研究报告。
日期: ${today}
星期: ${weekday}

要求：严格按照十四大章结构输出完整报告，每章都必须包含具体数据和分析。全文不少于8000字。`

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

    let response
    const modelsToTry = [
      model,
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-pro',
      'gemini-1.5-flash'
    ]
    // Deduplicate the array but keep order
    const uniqueModels = [...new Set(modelsToTry)]

    let lastError: any = null

    for (const currentModel of uniqueModels) {
      try {
        console.log(`[Research Generate] Trying model: ${currentModel}...`)
        response = await ai.models.generateContent({
          model: currentModel,
          contents: userPrompt,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.5,
            maxOutputTokens: 65536,
          },
        })
        // If successful, break out of loop
        break
      } catch (err: any) {
        lastError = err
        const errMsg = err.message || err.toString()
        if (errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('high demand') || errMsg.includes('not found')) {
          console.warn(`[Research Generate] Model ${currentModel} failed (${errMsg.substring(0, 50)}...). Falling back to next...`)
          continue
        } else {
          // If it's a different error (e.g., API key invalid), throw immediately
          throw err
        }
      }
    }

    if (!response) {
      throw lastError || new Error('All models failed to generate response.')
    }

    let reportContent = response.text || ''

    if (!reportContent || reportContent.length < 200) {
      return NextResponse.json(
        { success: false, error: 'AI 生成内容过短或失败，请重试' },
        { status: 500 }
      )
    }

    // Clean up: remove wrapping code fences if Gemini wrapped in ```markdown
    reportContent = reportContent.replace(/^```(?:markdown|md)?\s*\n/i, '').replace(/\n```\s*$/, '')

    // Determine save path
    const outputDir = type === 'company' ? COMPANIES_DIR : INDUSTRIES_DIR
    const filename = `${today}-${trimmedKeyword}.md`
    const filePath = path.join(outputDir, filename)

    // Ensure directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Save report
    fs.writeFileSync(filePath, reportContent, 'utf-8')

    return NextResponse.json({
      success: true,
      data: {
        content: reportContent,
        savedTo: filePath,
        filename,
        type,
        keyword: trimmedKeyword,
      },
    })
  } catch (e: any) {
    console.error('[Research Generate]', e)
    return NextResponse.json(
      { success: false, error: e.message || '报告生成失败' },
      { status: 500 }
    )
  }
}
