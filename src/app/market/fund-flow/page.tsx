'use client'

import { useState, useEffect } from 'react'

interface FundFlowFile {
  filename: string
  date: string
}

interface ThreeSourceSignals {
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

type Tab = 'signals' | 'structure' | 'north' | 'margin' | 'zt' | 'lhb' | 'history'

export default function FundFlowDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('signals')
  const [files, setFiles] = useState<FundFlowFile[]>([])
  const [selectedFile, setSelectedFile] = useState<FundFlowFile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [signals, setSignals] = useState<ThreeSourceSignals | null>(null)
  const [signalsLoading, setSignalsLoading] = useState(true)
  const [rawData, setRawData] = useState<any>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        // 获取历史文件列表
        const res = await fetch('/api/fund-flow/list')
        const data = await res.json()
        if (data.files?.length > 0) {
          setFiles(data.files)
        }

        // 获取三源共振信号（通过后端代理）
        setSignalsLoading(true)
        try {
          const sigRes = await fetch('/api/fund-flow/proxy')
          const sigData = await sigRes.json()
          if (sigData.success && sigData.signals) {
            // 保存原始数据
            setRawData(sigData)
            // 转换 snake_case 到 camelCase
            const raw = sigData.signals
            setSignals({
              threeSource: raw.three_source || { status: '无信号', score: 0, details: [] },
              north: raw.north || { value: 0, direction: '持平', label: '' },
              superLarge: raw.super_large || { value: 0, direction: '持平', label: '' },
              ths: {
                netInflow: raw.ths?.net_inflow || 0,
                direction: raw.ths?.direction || '持平',
                label: raw.ths?.label || ''
              },
              margin: raw.margin || { ratio: 0, status: '正常', label: '' },
              zt: {
                count: raw.zt?.count || 0,
                consecutiveCount: raw.zt?.consecutive_count || 0,
                label: raw.zt?.label || ''
              },
              lhb: {
                institutionBuy: raw.lhb?.institution_buy || 0,
                status: raw.lhb?.status || '持平',
                label: raw.lhb?.label || ''
              }
            })
          }
        } catch (e) {
          console.error('Failed to fetch signals:', e)
        }
      } catch (error) {
        console.error('Failed to fetch data', error)
      } finally {
        setIsLoading(false)
        setSignalsLoading(false)
      }
    }
    fetchData()
  }, [])

  // 信号强度颜色
  const signalColor = (status: string) => {
    switch (status) {
      case '做多': return 'text-green-500'
      case '做空': return 'text-red-500'
      case '二源共振': return 'text-yellow-500'
      case '背离': return 'text-orange-500'
      default: return 'text-gray-500'
    }
  }

  const signalBg = (status: string) => {
    switch (status) {
      case '做多': return 'bg-green-900/30 border-green-500/50'
      case '做空': return 'bg-red-900/30 border-red-500/50'
      case '二源共振': return 'bg-yellow-900/30 border-yellow-500/50'
      case '背离': return 'bg-orange-900/30 border-orange-500/50'
      default: return 'bg-gray-900/30 border-gray-500/50'
    }
  }

  const signalEmoji = (status: string) => {
    switch (status) {
      case '做多': return '📈'
      case '做空': return '📉'
      case '二源共振': return '⚡'
      case '背离': return '⚠️'
      default: return '➖'
    }
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'signals', label: '三源信号', icon: '⚡' },
    { id: 'structure', label: '资金结构', icon: '🧠' },
    { id: 'north', label: '北向资金', icon: '🌊' },
    { id: 'margin', label: '杠杆情绪', icon: '💳' },
    { id: 'zt', label: '涨停精准', icon: '🔥' },
    { id: 'lhb', label: '机构席位', icon: '🏛️' },
    { id: 'history', label: '历史回顾', icon: '📊' },
  ]

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-slate-900 overflow-hidden">
      {/* 左侧标签栏 */}
      <div className="w-56 flex-shrink-0 bg-slate-800 border-r border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700 bg-slate-800/50">
          <h2 className="text-lg font-semibold text-emerald-400">资金流看板</h2>
          <p className="text-xs text-slate-400 mt-1">2.0 Phase 5</p>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full text-left px-4 py-2.5 rounded-lg transition-all duration-200 border flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                  : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-slate-600'
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              <span className="font-medium text-sm">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* 三源共振状态 */}
        <div className="p-3 border-t border-slate-700">
          {signalsLoading ? (
            <div className="animate-pulse h-16 bg-slate-700 rounded-lg"></div>
          ) : signals ? (
            <div className={`p-3 rounded-lg border ${signalBg(signals.threeSource.status)}`}>
              <div className="text-xs text-slate-400 mb-1">三源共振</div>
              <div className={`text-xl font-bold ${signalColor(signals.threeSource.status)}`}>
                {signalEmoji(signals.threeSource.status)} {signals.threeSource.status}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {signals.threeSource.score > 0 ? `强度 ${signals.threeSource.score}%` : '等待信号'}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg border bg-slate-700/30 border-slate-600">
              <div className="text-xs text-slate-500">数据加载失败</div>
            </div>
          )}
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden">
        {/* 三源信号面板 */}
        {activeTab === 'signals' && (
          <div className="flex-1 overflow-auto p-6">
            {signalsLoading ? (
              <div className="animate-pulse space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-24 bg-slate-800 rounded-xl"></div>
                ))}
              </div>
            ) : signals ? (
              <div className="space-y-4">
                {/* 核心信号卡 */}
                <div className={`p-6 rounded-2xl border-2 ${signalBg(signals.threeSource.status)}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm text-slate-400 uppercase tracking-wider mb-1">核心信号</h3>
                      <div className={`text-3xl font-bold ${signalColor(signals.threeSource.status)}`}>
                        {signalEmoji(signals.threeSource.status)} {signals.threeSource.status}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-slate-400">信号强度</div>
                      <div className={`text-4xl font-bold ${signalColor(signals.threeSource.status)}`}>
                        {signals.threeSource.score}
                        <span className="text-lg">%</span>
                      </div>
                    </div>
                  </div>
                  {signals.threeSource.details.length > 0 && (
                    <div className="space-y-1">
                      {signals.threeSource.details.map((d, i) => (
                        <div key={i} className="text-sm text-slate-300 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                          {d}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 三源详情 */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <div className="text-xs text-slate-400 mb-2">🌊 北向资金</div>
                    <div className={`text-xl font-bold ${signals.north.direction === '买入' ? 'text-green-400' : signals.north.direction === '卖出' ? 'text-red-400' : 'text-gray-400'}`}>
                      {signals.north.value > 0 ? '+' : ''}{signals.north.value.toFixed(1)}亿
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{signals.north.direction}</div>
                  </div>

                  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <div className="text-xs text-slate-400 mb-2">🧠 超大单资金</div>
                    <div className={`text-xl font-bold ${signals.superLarge.direction === '流入' ? 'text-green-400' : signals.superLarge.direction === '流出' ? 'text-red-400' : 'text-gray-400'}`}>
                      {signals.superLarge.value > 0 ? '+' : ''}{signals.superLarge.value.toFixed(1)}亿
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{signals.superLarge.direction}</div>
                  </div>

                  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <div className="text-xs text-slate-400 mb-2">📊 主力资金</div>
                    <div className={`text-xl font-bold ${signals.ths.direction === '流入' ? 'text-green-400' : signals.ths.direction === '流出' ? 'text-red-400' : 'text-gray-400'}`}>
                      {(signals.ths.netInflow / 10000).toFixed(1)}亿
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{signals.ths.direction}</div>
                  </div>
                </div>

                {/* 辅助信号 */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <div className="text-xs text-slate-400 mb-2">💳 融资/融券比</div>
                    <div className={`text-xl font-bold ${signals.margin.status === '偏高' ? 'text-orange-400' : signals.margin.status === '偏低' ? 'text-blue-400' : 'text-gray-400'}`}>
                      {signals.margin.ratio.toFixed(1)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{signals.margin.status}</div>
                  </div>

                  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <div className="text-xs text-slate-400 mb-2">🔥 涨停板</div>
                    <div className="text-xl font-bold text-red-400">
                      {signals.zt.count}只
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {signals.zt.consecutiveCount > 0 ? `连板 ${signals.zt.consecutiveCount} 只` : '正常'}
                    </div>
                  </div>

                  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <div className="text-xs text-slate-400 mb-2">🏛️ 机构席位</div>
                    <div className={`text-xl font-bold ${signals.lhb.status === '净买入' ? 'text-green-400' : signals.lhb.status === '净卖出' ? 'text-red-400' : 'text-gray-400'}`}>
                      {signals.lhb.institutionBuy > 0 ? '+' : ''}{signals.lhb.institutionBuy.toFixed(1)}亿
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{signals.lhb.status}</div>
                  </div>
                </div>

                {/* 信号判断规则说明 */}
                <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                  <h4 className="text-sm font-medium text-slate-300 mb-3">三源共振信号规则</h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex items-start gap-2">
                      <span className="text-green-400">⭐⭐⭐</span>
                      <div>
                        <div className="text-slate-300 font-medium">三源共振做多</div>
                        <div className="text-slate-500">北向&gt;30亿 + 超大单&gt;50亿 + 主力&gt;100亿</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-red-400">⭐⭐⭐</span>
                      <div>
                        <div className="text-slate-300 font-medium">三源共振做空</div>
                        <div className="text-slate-500">北向&LT;-20亿 + 超大单&LT;-30亿 + 主力&LT;-50亿</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-yellow-400">⭐⭐</span>
                      <div>
                        <div className="text-slate-300 font-medium">二源共振</div>
                        <div className="text-slate-500">任两源同向</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-orange-400">⚠️</span>
                      <div>
                        <div className="text-slate-300 font-medium">背离信号</div>
                        <div className="text-slate-500">一源买入但另一源卖出</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-slate-400">正在加载信号数据...</div>
              </div>
            )}
          </div>
        )}

        {/* 资金结构 */}
        {activeTab === 'structure' && (
          <div className="flex-1 overflow-auto p-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-200 mb-4">🧠 市场资金结构</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <div className="text-xs text-slate-400 mb-2">超大单净流入</div>
                  <div className={`text-2xl font-bold ${signals?.superLarge.direction === '流入' ? 'text-green-400' : signals?.superLarge.direction === '流出' ? 'text-red-400' : 'text-gray-400'}`}>
                    {signals?.superLarge.label || '--'}
                  </div>
                  <div className="text-xs text-slate-500 mt-2">机构主导资金</div>
                </div>

                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <div className="text-xs text-slate-400 mb-2">主力资金</div>
                  <div className={`text-2xl font-bold ${signals?.ths.direction === '流入' ? 'text-green-400' : signals?.ths.direction === '流出' ? 'text-red-400' : 'text-gray-400'}`}>
                    {signals?.ths.label || '--'}
                  </div>
                  <div className="text-xs text-slate-500 mt-2">行业板块资金</div>
                </div>
              </div>

              <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                <h4 className="text-sm font-medium text-slate-300 mb-3">资金流向解读</h4>
                <div className="text-xs text-slate-400 space-y-2">
                  <p>• <span className="text-green-400">超大单净流入</span>：代表机构资金动向，是市场的主要推动力</p>
                  <p>• <span className="text-blue-400">大单净流入</span>：代表大户资金动向</p>
                  <p>• <span className="text-gray-400">中单净流入</span>：代表中户资金动向</p>
                  <p>• <span className="text-orange-400">小单净流入</span>：代表散户资金动向，通常与机构反向</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 北向资金 */}
        {activeTab === 'north' && (
          <div className="flex-1 overflow-auto p-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-200 mb-4">🌊 北向资金</h3>
              
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <div className="text-xs text-slate-400 mb-2">当日成交净买额</div>
                <div className={`text-3xl font-bold ${signals?.north.direction === '买入' ? 'text-green-400' : signals?.north.direction === '卖出' ? 'text-red-400' : 'text-gray-400'}`}>
                  {(signals?.north.value ?? 0) > 0 ? '+' : ''}{(signals?.north.value ?? 0).toFixed(2)}亿
                </div>
                <div className="text-sm text-slate-400 mt-2">
                  方向：<span className={signals?.north.direction === '买入' ? 'text-green-400' : signals?.north.direction === '卖出' ? 'text-red-400' : ''}>{signals?.north.direction}</span>
                </div>
              </div>

              <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                <h4 className="text-sm font-medium text-slate-300 mb-3">北向资金解读</h4>
                <div className="text-xs text-slate-400 space-y-2">
                  <p>• <span className="text-green-400">北向资金</span>：通过沪股通和深股通进入A股的国际资金</p>
                  <p>• <span className="text-yellow-400">当日净买额&gt;30亿</span>：外资大幅流入，看多A股</p>
                  <p>• <span className="text-red-400">当日净卖额&gt;20亿</span>：外资大幅流出，谨慎对待</p>
                  <p>• 北向资金被誉为"聪明钱"，常被视为市场风向标</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 杠杆情绪 */}
        {activeTab === 'margin' && (
          <div className="flex-1 overflow-auto p-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-200 mb-4">💳 融资融券情绪</h3>
              
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <div className="text-xs text-slate-400 mb-2">融资/融券比</div>
                <div className={`text-3xl font-bold ${signals?.margin.status === '偏高' ? 'text-orange-400' : signals?.margin.status === '偏低' ? 'text-blue-400' : 'text-gray-400'}`}>
                  {signals?.margin.ratio.toFixed(2)}
                </div>
                <div className="text-sm text-slate-400 mt-2">
                  状态：<span className={signals?.margin.status === '偏高' ? 'text-orange-400' : signals?.margin.status === '偏低' ? 'text-blue-400' : ''}>{signals?.margin.status}</span>
                </div>
              </div>

              <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                <h4 className="text-sm font-medium text-slate-300 mb-3">融资融券比解读</h4>
                <div className="text-xs text-slate-400 space-y-2">
                  <p>• <span className="text-orange-400">融资/融券比&gt;3</span>：杠杆偏高，多头情绪旺盛</p>
                  <p>• <span className="text-green-400">融资/融券比1.5~3</span>：情绪正常</p>
                  <p>• <span className="text-blue-400">融资/融券比&lt;1.5</span>：空头占优，谨慎</p>
                  <p>• 融资代表投资者借钱买股票（做多），融券代表借股票卖（做空）</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 涨停精准 */}
        {activeTab === 'zt' && (
          <div className="flex-1 overflow-auto p-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-200 mb-4">🔥 涨停板分析</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                  <div className="text-xs text-slate-400 mb-2">涨停总数</div>
                  <div className="text-3xl font-bold text-red-400">
                    {signals?.zt.count}只
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                  <div className="text-xs text-slate-400 mb-2">连板数量</div>
                  <div className="text-3xl font-bold text-yellow-400">
                    {signals?.zt.consecutiveCount}只
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                <h4 className="text-sm font-medium text-slate-300 mb-3">涨停板解读</h4>
                <div className="text-xs text-slate-400 space-y-2">
                  <p>• <span className="text-red-400">涨停数量</span>：反映市场短期热点和赚钱效应</p>
                  <p>• <span className="text-yellow-400">连板数量</span>：强势股持续涨停，市场情绪高涨</p>
                  <p>• 涨停板是短线交易的重要参考指标</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 机构席位 */}
        {activeTab === 'lhb' && (
          <div className="flex-1 overflow-auto p-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-200 mb-4">🏛️ 龙虎榜机构席位</h3>
              
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <div className="text-xs text-slate-400 mb-2">机构净买入</div>
                <div className={`text-3xl font-bold ${signals?.lhb.status === '净买入' ? 'text-green-400' : signals?.lhb.status === '净卖出' ? 'text-red-400' : 'text-gray-400'}`}>
                  {(signals?.lhb.institutionBuy ?? 0) > 0 ? '+' : ''}{(signals?.lhb.institutionBuy ?? 0).toFixed(2)}亿
                </div>
                <div className="text-sm text-slate-400 mt-2">
                  状态：<span className={signals?.lhb.status === '净买入' ? 'text-green-400' : signals?.lhb.status === '净卖出' ? 'text-red-400' : ''}>{signals?.lhb.status}</span>
                </div>
              </div>

              <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                <h4 className="text-sm font-medium text-slate-300 mb-3">龙虎榜解读</h4>
                <div className="text-xs text-slate-400 space-y-2">
                  <p>• <span className="text-green-400">机构净买入</span>：机构专用席位买入，视为积极信号</p>
                  <p>• <span className="text-red-400">机构净卖出</span>：机构减仓，可能预示风险</p>
                  <p>• 龙虎榜披露每日涨跌幅±7%的股票中营业部买卖情况</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 历史回顾 */}
        {activeTab === 'history' && (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-slate-700 bg-slate-800/30">
              <h3 className="text-lg font-semibold text-slate-200">历史回顾</h3>
              <p className="text-xs text-slate-500 mt-1">资金流复盘记录</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {isLoading ? (
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-10 bg-slate-700 rounded-lg w-full"></div>
                  ))}
                </div>
              ) : files.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-4">暂无历史数据</p>
              ) : (
                files.map((file) => (
                  <button
                    key={file.filename}
                    onClick={() => setSelectedFile(file)}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 border ${
                      selectedFile?.filename === file.filename
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                        : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium tracking-wider">{file.date}</span>
                      {selectedFile?.filename === file.filename && (
                        <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* iframe显示区（历史标签页选中时） */}
        {activeTab === 'history' && selectedFile && (
          <div className="flex-1 border-t border-slate-700">
            <iframe
              src={`/api/fund-flow/report?filename=${encodeURIComponent(selectedFile.filename)}`}
              className="w-full h-full border-none"
              title="Fund Flow Dashboard"
            />
          </div>
        )}
      </div>
    </div>
  )
}
