/**
 * Factor Index API Route
 * Reads factors_index.json and alpha_summary_complete.csv to provide unified factor listing
 */
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const FACTORS_INDEX_PATH = '/Users/alpha/.openclaw/workspace-quant_engineer/skills/文章转因子/factors_index.json'
const FACTORS_INDEX_PATH_2 = '/Users/alpha/.openclaw/workspace-quant_engineer/skills/文章转因子/factors/factor_index.json'
const SUMMARY_CSV_PATH = '/Users/alpha/.openclaw/workspace-quant_engineer/skills/因子回测报告/factor_reports/alpha_summary_complete.csv'

function parseSummaryCSV(): Record<string, any> {
  const result: Record<string, any> = {}
  try {
    if (!fs.existsSync(SUMMARY_CSV_PATH)) return result
    const raw = fs.readFileSync(SUMMARY_CSV_PATH, 'utf-8')
    const lines = raw.trim().split('\n')
    if (lines.length < 2) return result
    // Header: Factor,IC_Mean,IC_T_Stat,Annual_Ret,Sharpe,MaxDD,WinRate,Turnover
    const seen = new Set<string>()
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',')
      if (cols.length < 8) continue
      const name = cols[0].trim()
      if (seen.has(name)) continue // deduplicate rows
      seen.add(name)
      result[name] = {
        ic_mean: parseFloat(cols[1]),
        ic_t_stat: parseFloat(cols[2]),
        annual_ret: parseFloat(cols[3]),
        sharpe: parseFloat(cols[4]),
        max_dd: parseFloat(cols[5]),
        win_rate: parseFloat(cols[6]),
        turnover: parseFloat(cols[7]),
      }
    }
  } catch (e) {
    console.error('[FactorIndex] Failed to parse summary CSV:', e)
  }
  return result
}

function readFactorIndex(filePath: string): any[] {
  try {
    if (!fs.existsSync(filePath)) return []
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    return data.factors || []
  } catch (e) {
    console.error(`[FactorIndex] Failed to read ${filePath}:`, e)
    return []
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') // 'backtested' | 'untested' | null (all)
    const search = searchParams.get('search')?.toLowerCase() || ''
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')

    // Read and merge both factor index files
    const factors1 = readFactorIndex(FACTORS_INDEX_PATH)
    const factors2 = readFactorIndex(FACTORS_INDEX_PATH_2)

    // Merge: use name as key, first file takes priority, second adds missing ones
    const nameSet = new Set<string>()
    const allFactors: any[] = []
    for (const f of factors1) {
      if (!nameSet.has(f.name)) {
        nameSet.add(f.name)
        allFactors.push(f)
      }
    }
    for (const f of factors2) {
      if (!nameSet.has(f.name)) {
        nameSet.add(f.name)
        allFactors.push(f)
      }
    }

    // Read backtest summary
    const backtestData = parseSummaryCSV()
    const backtestNames = new Set(Object.keys(backtestData))

    // Also add factors that are only in CSV but not in any index file
    for (const csvName of backtestNames) {
      if (!nameSet.has(csvName)) {
        nameSet.add(csvName)
        allFactors.push({
          name: csvName,
          category: 'backtested',
          logic_summary: `Factor with backtest results`,
          data_fields: [],
        })
      }
    }

    // Enrich factors with backtest data and filter
    let enriched = allFactors.map((f: any) => {
      const bt = backtestData[f.name]
      return {
        name: f.name,
        category: f.category || 'unknown',
        logic_summary: f.logic_summary || '',
        data_fields: f.data_fields || [],
        source: f.source || '',
        backtested: !!bt,
        backtest_metrics: bt || null,
      }
    })

    // Search filter
    if (search) {
      enriched = enriched.filter(f =>
        f.name.toLowerCase().includes(search) ||
        f.logic_summary.toLowerCase().includes(search) ||
        f.category.toLowerCase().includes(search)
      )
    }

    // Backtest status filter
    if (filter === 'backtested') {
      enriched = enriched.filter(f => f.backtested)
    } else if (filter === 'untested') {
      enriched = enriched.filter(f => !f.backtested)
    }

    const total = enriched.length

    // Pagination
    const start = (page - 1) * pageSize
    const paginated = enriched.slice(start, start + pageSize)

    return NextResponse.json({
      success: true,
      data: {
        factors: paginated,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        backtested_count: allFactors.filter((f: any) => backtestNames.has(f.name)).length,
        untested_count: allFactors.filter((f: any) => !backtestNames.has(f.name)).length,
      }
    })
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ success: false, error: `Error: ${errMsg}` })
  }
}
