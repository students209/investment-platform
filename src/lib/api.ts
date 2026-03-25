/**
 * API 客户端 - 调用 FastAPI 后端
 * 
 * 本地开发: http://localhost:8000
 * 生产环境: https://c438b1faeb531385-217-116-174-241.serveousercontent.com
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://99134092f1905aa6-217-116-174-241.serveousercontent.com';

async function fetchAPI(endpoint: string) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`);
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

// ============ 行情 API ============

export async function getIndexQuote() {
  return fetchAPI('/api/market/index');
}

export async function getStockQuote(code: string) {
  return fetchAPI(`/api/market/stock/${code}`);
}

export async function getKline(code: string, period = 'daily', startDate?: string, endDate?: string) {
  let url = `/api/market/kline/${code}?period=${period}`;
  if (startDate) url += `&start_date=${startDate}`;
  if (endDate) url += `&end_date=${endDate}`;
  return fetchAPI(url);
}

export async function getMoneyFlow(code: string) {
  return fetchAPI(`/api/market/money-flow/${code}`);
}

export async function getHotStocks() {
  return fetchAPI('/api/market/hot-stocks');
}

// ============ 因子 API ============

export async function getFactorList(userId?: string) {
  let url = '/api/factors/list';
  if (userId) url += `?user_id=${userId}`;
  return fetchAPI(url);
}

export async function computeFactor(data: {
  name: string;
  formula: string;
  params: Record<string, number>;
  codes: string[];
  start_date: string;
  end_date: string;
}) {
  const res = await fetch(`${API_BASE}/api/factors/compute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function backtestFactor(data: {
  name: string;
  formula: string;
  params: Record<string, number>;
  codes: string[];
  start_date: string;
  end_date: string;
}) {
  const res = await fetch(`${API_BASE}/api/factors/backtest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

// ============ 论文转因子 API ============

export async function convertPaper(data: {
  url?: string;
  text?: string;
  filename?: string;
  fileBase64?: string;
  mimeType?: string;
  model?: string;
}) {
  const res = await fetch('/api/paper/convert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

// ============ 风控 API ============

export async function getRiskDashboard() {
  return fetchAPI('/api/risk/dashboard');
}

export async function calculatePortfolioRisk(holdings: Array<{
  code: string;
  name: string;
  shares: number;
  cost: number;
  current_price: number;
}>) {
  const res = await fetch(`${API_BASE}/api/risk/portfolio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(holdings),
  });
  return res.json();
}
