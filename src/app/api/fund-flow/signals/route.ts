/**
 * 资金流看板 Phase 5 API
 * 三源共振信号集成 + 东财数据实时读取
 */
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const EAST_DATA_ROOT = '/Users/alpha/Documents/learn/quant/资金流看板2.0/data/东财'
const THS_DATA_ROOT = '/Users/alpha/Documents/learn/quant/资金流看板/data'
const OUTPUT_HTML = '/Users/alpha/Documents/learn/quant/资金流看板2.0/output/资金流看板2.0_latest.html'

// 简单 glob 实现
function globFiles(dir: string, ext: string = 'xlsx'): string[] {
  if (!fs.existsSync(dir)) return []
  try {
    return fs.readdirSync(dir)
      .filter(f => f.endsWith(`.${ext}`))
      .map(f => path.join(dir, f))
      .sort()
      .reverse()
  } catch { return [] }
}

// 获取最新文件
function getLatestFile(dir: string, prefix: string, ext: string = 'xlsx'): string | null {
  const files = globFiles(dir, ext).filter(f => path.basename(f).includes(prefix))
  return files.length > 0 ? files[0] : null
}

function readExcel(filePath: string): any[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx')
    const wb = XLSX.readFile(filePath)
    const sheetName = wb.SheetNames[0]
    return XLSX.utils.sheet_to_json(wb.Sheets[sheetName]) || []
  } catch (e: any) {
    console.error('readExcel error:', e.message, filePath)
    return []
  }
}

function cleanNum(v: any): number {
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'number') return v
  try {
    const s = String(v).replace(',', '').trim()
    if (s.includes('亿')) return parseFloat(s.replace('亿', ''))
    return parseFloat(s)
  } catch { return 0 }
}

// ============ 三源共振信号计算 ============

interface Signals {
  threeSource: {
    status: '做多' | '做空' | '二源共振' | '背离' | '无信号'
    score: number
    details: string[]
  }
  north: { value: number; direction: '买入' | '卖出' | '持平'; label: string }
  superLarge: { value: number; direction: '流入' | '流出' | '持平'; label: string }
  ths: { netInflow: number; direction: '流入' | '流出' | '持平'; label: string }
  margin: { ratio: number; status: '偏高' | '正常' | '偏低'; label: string }
  zt: { count: number; consecutiveCount: number; label: string }
  lhb: { institutionBuy: number; status: '净买入' | '净卖出' | '持平'; label: string }
}

async function calcThreeSourceSignals(): Promise<Signals> {
  const signals: Signals = {
    threeSource: { status: '无信号', score: 0, details: [] },
    north: { value: 0, direction: '持平', label: '' },
    superLarge: { value: 0, direction: '持平', label: '' },
    ths: { netInflow: 0, direction: '持平', label: '' },
    margin: { ratio: 0, status: '正常', label: '' },
    zt: { count: 0, consecutiveCount: 0, label: '' },
    lhb: { institutionBuy: 0, status: '持平', label: '' },
  }

  try {
    // 1. 北向资金
    const northFile = getLatestFile(`${EAST_DATA_ROOT}/北向资金/历史`, '北向资金历史')
    if (northFile) {
      const northDf = readExcel(northFile)
      if (northDf.length > 0) {
        // 列名: 当日成交净买额
        const nc = Object.keys(northDf[0]).find(k => k.includes('当日') && k.includes('净买'))
          || '当日成交净买额'
        // 找最新有效数据（非空且非0）
        let lastValidRow = null
        for (let i = northDf.length - 1; i >= 0; i--) {
          const v = cleanNum(northDf[i][nc])
          if (v !== 0) { lastValidRow = northDf[i]; break }
        }
        if (lastValidRow) {
          signals.north.value = cleanNum(lastValidRow[nc])
          signals.north.direction = signals.north.value > 30 ? '买入' : signals.north.value < -20 ? '卖出' : '持平'
          signals.north.label = `🌊 北向 ${signals.north.value > 0 ? '+' : ''}${signals.north.value.toFixed(1)}亿`
        }
      }
    }

    // 2. 超大单资金流
    const mflowFile = getLatestFile(`${EAST_DATA_ROOT}/市场资金流总览`, '市场资金流总览')
    if (mflowFile) {
      const mflowDf = readExcel(mflowFile)
      if (mflowDf.length > 0) {
        // 优先找"超大单净流入-净额"，兼容旧版"超额"
        const sc = Object.keys(mflowDf[0]).find(k => k.includes('超额') && k.includes('净额'))
          || Object.keys(mflowDf[0]).find(k => k.includes('超大单净流入-净额'))
        if (sc) {
          const lastRow = mflowDf[mflowDf.length - 1]
          const rawVal = cleanNum(lastRow[sc])
          // 原始数据是字节，转换为亿元
          signals.superLarge.value = rawVal / 100000000
          signals.superLarge.direction = signals.superLarge.value > 50 ? '流入' : signals.superLarge.value < -30 ? '流出' : '持平'
          signals.superLarge.label = `🧠 超大单 ${signals.superLarge.value > 0 ? '+' : ''}${signals.superLarge.value.toFixed(1)}亿`
        }
      }
    }

    // 3. 同花顺主力净流入 (行业汇总)
    const thsDir = THS_DATA_ROOT + '/资金流'
    if (fs.existsSync(thsDir)) {
      const thsFiles = fs.readdirSync(thsDir).filter(f => f.includes('板块') && f.includes('即时'))
      if (thsFiles.length > 0) {
        const latestThs = path.join(thsDir, thsFiles.sort().reverse()[0])
        const thsDf = readExcel(latestThs)
        if (thsDf.length > 0) {
          const nc = Object.keys(thsDf[0]).find(k => k.includes('净额'))
          if (nc) {
            const thsNetInflow = thsDf.reduce((sum: number, row: any) => sum + cleanNum(row[nc]), 0)
            signals.ths.netInflow = thsNetInflow
            signals.ths.direction = signals.ths.netInflow > 100 ? '流入' : signals.ths.netInflow < -50 ? '流出' : '持平'
            signals.ths.label = `📊 主力 ${signals.ths.netInflow > 0 ? '+' : ''}${(signals.ths.netInflow / 10000).toFixed(1)}亿`
          }
        }
      }
    }

    // 4. 三源共振判断
    const n = signals.north.value > 30
    const s = signals.superLarge.value > 50
    const t = signals.ths.netInflow > 100 * 10000

    const nSell = signals.north.value < -20
    const sSell = signals.superLarge.value < -30
    const tSell = signals.ths.netInflow < -50 * 10000

    if (n && s && t) {
      signals.threeSource.status = '做多'
      signals.threeSource.score = 100
      signals.threeSource.details = ['北向资金大幅净买入', '超大单机构资金主导', '主力资金持续净流入']
    } else if (nSell && sSell && tSell) {
      signals.threeSource.status = '做空'
      signals.threeSource.score = 100
      signals.threeSource.details = ['北向资金大幅净卖出', '超大单机构资金减仓', '主力资金持续净流出']
    } else if ((n && s) || (n && t) || (s && t)) {
      signals.threeSource.status = '二源共振'
      signals.threeSource.score = 66
      signals.threeSource.details = ['两源同向，信号较强']
    } else if ((n && sSell) || (s && tSell)) {
      signals.threeSource.status = '背离'
      signals.threeSource.score = 30
      signals.threeSource.details = ['⚠️ 三源信号背离，可能存在拉高出货风险']
    }

    // 5. 融资融券比
    const marginFile = getLatestFile(`${EAST_DATA_ROOT}/融资融券`, '融资融券_上交所_历史')
    if (marginFile) {
      const marginDf = readExcel(marginFile)
      if (marginDf.length > 0) {
        const lastRow = marginDf[marginDf.length - 1]
        const inc = Object.keys(lastRow).find(k => k.includes('融资') && k.includes('余额'))
        const outc = Object.keys(lastRow).find(k => k.includes('融券') && k.includes('余额'))
        if (inc && outc) {
          const inV = cleanNum(lastRow[inc])
          const outV = cleanNum(lastRow[outc])
          signals.margin.ratio = outV > 0 ? inV / outV : 0
          signals.margin.status = signals.margin.ratio > 3 ? '偏高' : signals.margin.ratio < 1.5 ? '偏低' : '正常'
          signals.margin.label = `💳 融资/融券比 ${signals.margin.ratio.toFixed(1)}`
        }
      }
    }

    // 6. 涨跌停池
    const ztFile = getLatestFile(`${EAST_DATA_ROOT}/涨跌停池`, '')
    if (ztFile) {
      const ztDf = readExcel(ztFile)
      signals.zt.count = ztDf.length
      const lc = Object.keys(ztDf[0] || {}).find(k => k.includes('连板'))
      if (lc) {
        signals.zt.consecutiveCount = ztDf.filter((row: any) => cleanNum(row[lc]) > 1).length
      }
      signals.zt.label = `🔥 涨停 ${signals.zt.count}只${signals.zt.consecutiveCount > 0 ? `，连板 ${signals.zt.consecutiveCount} 只` : ''}`
    }

    // 7. 龙虎榜机构席位
    const lhbDir = `${EAST_DATA_ROOT}/龙虎榜/机构席位`
    if (fs.existsSync(lhbDir)) {
      const lhbFiles = fs.readdirSync(lhbDir).filter(f => f.endsWith('.xlsx'))
      if (lhbFiles.length > 0) {
        const lhbFile = path.join(lhbDir, lhbFiles.sort().reverse()[0])
        const lhbDf = readExcel(lhbFile)
        const nc = Object.keys(lhbDf[0] || {}).find(k => k.includes('机构') && k.includes('净买'))
        if (nc) {
          signals.lhb.institutionBuy = lhbDf.reduce((sum: number, row: any) => sum + cleanNum(row[nc]), 0)
          signals.lhb.status = signals.lhb.institutionBuy > 5 ? '净买入' : signals.lhb.institutionBuy < -3 ? '净卖出' : '持平'
          signals.lhb.label = `🏛️ 机构净买入 ${signals.lhb.institutionBuy > 0 ? '+' : ''}${signals.lhb.institutionBuy.toFixed(1)}亿`
        }
      }
    }
  } catch (err) {
    console.error('三源共振信号计算失败:', err)
  }

  return signals
}

// ============ HTTP Handler ============

export async function GET() {
  try {
    const signals = await calcThreeSourceSignals()

    const dashboardExists = fs.existsSync(OUTPUT_HTML)
    const dashboardStat = dashboardExists ? fs.statSync(OUTPUT_HTML) : null

    return NextResponse.json({
      success: true,
      data: {
        signals,
        dashboard: {
          exists: dashboardExists,
          lastModified: dashboardStat?.mtime?.toISOString() || null,
          size: dashboardStat?.size || 0,
          url: '/api/fund-flow/report?filename=资金流看板2.0_latest.html',
        },
        dataSource: {
          eastmoney: {
            root: EAST_DATA_ROOT,
            marketFlow: fs.existsSync(`${EAST_DATA_ROOT}/市场资金流总览`),
            northFund: fs.existsSync(`${EAST_DATA_ROOT}/北向资金`),
            margin: fs.existsSync(`${EAST_DATA_ROOT}/融资融券`),
            ztPool: fs.existsSync(`${EAST_DATA_ROOT}/涨跌停池`),
            lhb: fs.existsSync(`${EAST_DATA_ROOT}/龙虎榜`),
          },
          tonghuashun: {
            root: THS_DATA_ROOT,
            sectorFlow: fs.existsSync(`${THS_DATA_ROOT}/资金流`),
          },
        },
      },
    })
  } catch (error: any) {
    console.error('三源共振API失败:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
