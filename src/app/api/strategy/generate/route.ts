/**
 * AI Strategy Generation API
 * Uses Gemini to generate Python factor code from user description
 */
import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import fs from 'fs'
import path from 'path'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const SKILL_DIR = '/Users/alpha/.openclaw/workspace-quant_engineer/skills/策略回测报告'
const CUSTOM_DIR = path.join(SKILL_DIR, 'custom_strategies')
const ALPHA101_PATH = '/Users/alpha/.openclaw/workspace-quant_engineer/skills/文章转因子/alpha101.py'

const SYSTEM_PROMPT = `你是一名顶级量化策略开发工程师。用户会给你一个策略名称和策略描述，你需要生成一个标准的 Python 因子函数。

## 输出要求

1. 函数名必须以 alpha_ 开头，使用用户指定的策略名称（转换为合法的 Python 标识符）
2. 函数签名必须为: def alpha_xxx(df, params=None)
3. 函数输入:
   - df: pandas DataFrame，包含字段: instrument, date, open, high, low, close, volume, amount, turn, pct_chg
   - params: 可选参数字典
4. 函数输出: 返回 DataFrame，必须包含 instrument, date, {因子名} 三列
5. 代码必须可以直接运行，不允许导入除 pandas/numpy 以外的第三方库
6. 必须处理好 NaN 值
7. 在函数开头添加清晰的文档字符串

## 输出格式

只输出 Python 代码块，不要有任何其他解释文字。

\`\`\`python
def alpha_xxx(df, params=None):
    '''
    策略描述
    '''
    ...
\`\`\`
`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      strategyName,
      strategyDescription,
      model = 'gemini-3.1-flash-lite-preview',
    } = body

    if (!strategyName || !strategyDescription) {
      return NextResponse.json(
        { success: false, error: '请提供策略名称和策略描述' },
        { status: 400 }
      )
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'GEMINI_API_KEY 未配置' },
        { status: 500 }
      )
    }

    // Sanitize strategy name for Python
    const safeName = strategyName
      .replace(/[^a-zA-Z0-9\u4e00-\u9fff_]/g, '_')
      .replace(/^(\d)/, '_$1')
      .toLowerCase()
    const factorName = `alpha_${safeName}`

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

    const userPrompt = `策略名称: ${strategyName}
因子函数名: ${factorName}
策略描述: ${strategyDescription}`

    const response = await ai.models.generateContent({
      model,
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.3,
      },
    })

    const text = response.text || ''

    // Extract code from markdown code block
    const codeMatch = text.match(/```(?:python)?\n([\s\S]*?)```/)
    const code = codeMatch ? codeMatch[1].trim() : text.trim()

    if (!code.includes('def alpha_')) {
      return NextResponse.json(
        { success: false, error: 'AI 未能生成有效的因子代码' },
        { status: 500 }
      )
    }

    // Extract actual function name from generated code
    const fnMatch = code.match(/def\s+(alpha_\w+)/)
    const actualFactorName = fnMatch ? fnMatch[1] : factorName

    // Save to custom_strategies directory
    if (!fs.existsSync(CUSTOM_DIR)) {
      fs.mkdirSync(CUSTOM_DIR, { recursive: true })
    }
    const pyPath = path.join(CUSTOM_DIR, `${actualFactorName}.py`)
    const pyContent = `# -*- coding: utf-8 -*-
"""
自定义策略: ${strategyName}
因子函数: ${actualFactorName}
策略描述: ${strategyDescription}
生成时间: ${new Date().toISOString()}
"""
import pandas as pd
import numpy as np

${code}
`
    fs.writeFileSync(pyPath, pyContent, 'utf-8')

    // Code is now saved in custom_strategies/ and dynamically imported by the engine.

    return NextResponse.json({
      success: true,
      data: {
        factorName: actualFactorName,
        strategyName,
        code,
        savedTo: pyPath,
        model,
      },
    })
  } catch (e: any) {
    console.error('[Strategy Generate]', e)
    return NextResponse.json(
      { success: false, error: e.message || '策略生成失败' },
      { status: 500 }
    )
  }
}
