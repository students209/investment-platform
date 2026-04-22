/**
 * Hugo 报告读取工具
 * Vercel: 从 public/hugo-data 读取
 * 本地: 从 data/insights 软链接读取
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import crypto from 'crypto';

// 判断运行环境
const IS_VERCEL = process.env.VERCEL === '1';

// 本地开发: 软链接路径
const LOCAL_HUGO_PATH = '/Users/alpha/Documents/learn/openclaw_project/investment-platform/data/insights';
// Vercel: public 目录下的 hugo-data
const VERCEL_HUGO_PATH = path.join(process.cwd(), 'public', 'hugo-data');

function getHugoPath() {
  if (IS_VERCEL) {
    return VERCEL_HUGO_PATH;
  }
  if (fs.existsSync(LOCAL_HUGO_PATH)) {
    return LOCAL_HUGO_PATH;
  }
  return '/Users/alpha/Documents/learn/openclaw_project/teamwork_html/docs/insights';
}

// 生成 URL 安全的 slug
function toUrlSlug(filename: string): string {
  // 去掉 .md 扩展名
  const name = filename.replace('.md', '');
  // 如果全是 ASCII，直接返回
  if (/^[\x00-\x7F]+$/.test(name)) {
    return name;
  }
  // 中文或混合内容：用日期作为前缀 + 标题的拼音首字母简化
  const dateMatch = name.match(/^(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : '';
  // 提取中文部分作为唯一标识
  const chinese = name.replace(/^\d{4}-\d{2}-\d{2}-/, '');
  // 用 MD5 哈希生成短标识
  const hash = crypto.createHash('md5').update(chinese).digest('hex').slice(0, 6);
  // 格式: 日期-哈希，如 2026-03-24-a1b2c3
  return date ? `${date}-${hash}` : hash;
}

// 从 URL slug 还原文件名
function fromUrlSlug(urlSlug: string, category: string): string | null {
  const HUGO_PATH = getHugoPath();
  let dir: string;
  
  switch (category) {
    case 'industry':
      dir = IS_VERCEL 
        ? path.join(HUGO_PATH, 'industries')
        : path.join(HUGO_PATH, 'research/industries');
      break;
    case 'company':
      dir = IS_VERCEL 
        ? path.join(HUGO_PATH, 'companies')
        : path.join(HUGO_PATH, 'research/companies');
      break;
    case 'daily':
      dir = path.join(HUGO_PATH, 'daily-report');
      break;
    case 'morning':
      dir = path.join(HUGO_PATH, 'morning-report');
      break;
    case 'quant-strategy':
      dir = IS_VERCEL 
        ? path.join(HUGO_PATH, 'quant-strategies')
        : path.join(HUGO_PATH, 'research/量化策略/daily');
      break;
    default:
      return null;
  }
  
  // 遍历目录找匹配的文件
  if (!fs.existsSync(dir)) return null;
  
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  
  for (const file of files) {
    if (toUrlSlug(file) === urlSlug) {
      return file;
    }
  }
  
  // 如果完全匹配（ASCII 名称），直接返回
  if (files.includes(urlSlug + '.md')) {
    return urlSlug + '.md';
  }
  
  return null;
}

export interface ReportMeta {
  title: string;
  date: string;
  tags?: string[];
  summary?: string;
  excerpt?: string;
  author?: string;
  slug: string;
  filename: string;
  cover_tags?: string[];
  data_freshness?: string;
  weekday?: string;
  company?: string;
  // quant strategy fields
  strategy_type?: string;
  market?: string;
  data_frequency?: string;
  holding_period?: string;
  complexity?: string;
  risk_level?: string;
  strategy_status?: string;
  core_logic?: string;
  key_advantage?: string;
  key_risk?: string;
  bull_bear?: string;
}

export interface Report extends ReportMeta {
  body: string;
  category?: string;
}

// 从 markdown body 中提取关键段落作为卡片摘要
function extractExcerpt(body: string, category: string): string {
  let sectionPattern: RegExp;
  
  switch (category) {
    case 'daily':
      // 提取 【核心观点】 段落
      sectionPattern = /##\s*【核心观点】\s*\n([\s\S]*?)(?=\n---)/;
      break;
    case 'industry':
      // 提取 一、行业定义与概况 段落
      sectionPattern = /##\s*一、行业定义与概况\s*\n([\s\S]*?)(?=\n---)/;
      break;
    case 'company':
      // 提取 一、公司概况 段落
      sectionPattern = /##\s*一、公司概况\s*\n([\s\S]*?)(?=\n---)/;
      break;
    default:
      return '';
  }
  
  const match = body.match(sectionPattern);
  if (!match) return '';
  
  // 清理提取的内容：去掉 markdown 标记，保留纯文本
  let text = match[1]
    .replace(/^#{1,6}\s+/gm, '')        // 去掉标题标记
    .replace(/\*\*(.*?)\*\*/g, '$1')     // 去掉粗体标记
    .replace(/\*(.*?)\*/g, '$1')         // 去掉斜体标记
    .replace(/^>\s*/gm, '')             // 去掉引用标记
    .replace(/^-\s+/gm, '• ')           // 把列表标记改为 bullet
    .replace(/\|[^\n]*\|/g, '')         // 去掉表格行
    .replace(/^[\s-]*$/gm, '')          // 去掉空行和分隔行
    .replace(/\n{2,}/g, '\n')           // 合并多个换行
    .trim();
  
  // 限制长度
  if (text.length > 200) {
    text = text.slice(0, 200) + '...';
  }
  
  return text;
}

// 从文件名提取标题
function extractTitleFromFilename(filename: string): string {
  return filename.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace('.md', '');
}

// 从文件名提取日期
function extractDateFromFilename(filename: string): string {
  const match = filename.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

// 统一格式化日期，防止 yaml 解析为 Date 对象
function normalizeDate(rawDate: any, fallback: string): string {
  if (!rawDate) return fallback;
  if (rawDate instanceof Date) {
    // 确保使用本地时间，而不是UTC时间导致的偏差
    const offset = rawDate.getTimezoneOffset();
    const correctDate = new Date(rawDate.getTime() - (offset * 60 * 1000));
    return correctDate.toISOString().split('T')[0];
  }
  return String(rawDate);
}

// 获取行业研究报告
export async function getIndustryReports(): Promise<Report[]> {
  const HUGO_PATH = getHugoPath();
  try {
    const dir = IS_VERCEL 
      ? path.join(HUGO_PATH, 'industries')
      : path.join(HUGO_PATH, 'research/industries');
    
    if (!fs.existsSync(dir)) {
      console.log('[Hugo] 目录不存在:', dir);
      return [];
    }
    
    const files = fs.readdirSync(dir).filter(f => 
      f.endsWith('.md') && f !== 'index.md' && f !== '_index.md'
    );
    
    const reports = files.map(file => {
      const filePath = path.join(dir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const { data, content: body } = matter(content);
      
      const title = data.title || extractTitleFromFilename(file);
      const date = normalizeDate(data.date, extractDateFromFilename(file));
      
      const excerpt = extractExcerpt(body, 'industry');
      return {
        title,
        date,
        tags: data.tags || [],
        summary: data.summary || '',
        excerpt,
        author: data.author || '',
        cover_tags: data.cover_tags || [],
        data_freshness: data.data_freshness || '',
        weekday: data.weekday || '',
        slug: toUrlSlug(file),
        filename: file,
        body,
        category: 'industry'
      };
    });
    
    return reports.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  } catch (error) {
    console.error('[Hugo] 读取行业报告失败:', error);
    return [];
  }
}

// 获取企业研究报告
export async function getCompanyReports(): Promise<Report[]> {
  const HUGO_PATH = getHugoPath();
  try {
    const dir = IS_VERCEL 
      ? path.join(HUGO_PATH, 'companies')
      : path.join(HUGO_PATH, 'research/companies');
    
    if (!fs.existsSync(dir)) {
      console.log('[Hugo] 目录不存在:', dir);
      return [];
    }
    
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'index.md' && f !== '_index.md');
    
    const reports = files.map(file => {
      const filePath = path.join(dir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const { data, content: body } = matter(content);
      
      const title = data.title || extractTitleFromFilename(file);
      const date = normalizeDate(data.date, extractDateFromFilename(file));
      
      const excerpt = extractExcerpt(body, 'company');
      return {
        title,
        date,
        tags: data.tags || [],
        summary: data.summary || '',
        excerpt,
        author: data.author || '',
        cover_tags: data.cover_tags || [],
        data_freshness: data.data_freshness || '',
        weekday: data.weekday || '',
        company: data.company || '',
        slug: toUrlSlug(file),
        filename: file,
        body,
        category: 'company'
      };
    });
    
    return reports.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  } catch (error) {
    console.error('[Hugo] 读取企业报告失败:', error);
    return [];
  }
}

// 获取每日报告
export async function getDailyReports(): Promise<Report[]> {
  const HUGO_PATH = getHugoPath();
  try {
    const dir = path.join(HUGO_PATH, 'daily-report');
    
    if (!fs.existsSync(dir)) {
      console.log('[Hugo] 目录不存在:', dir);
      return [];
    }
    
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'index.md' && f !== '_index.md');
    
    const reports = files.map(file => {
      const filePath = path.join(dir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const { data, content: body } = matter(content);
      
      const titleMatch = body.match(/^#\s+(.+)/);
      const title = data.title || (titleMatch ? titleMatch[1] : file.replace('.md', ''));
      const date = normalizeDate(data.date, extractDateFromFilename(file));
      
      const excerpt = extractExcerpt(body, 'daily');
      return {
        title,
        date,
        tags: data.tags || [],
        summary: data.summary || '',
        excerpt,
        author: data.author || '',
        cover_tags: data.cover_tags || [],
        data_freshness: data.data_freshness || '',
        weekday: data.weekday || '',
        slug: toUrlSlug(file),
        filename: file,
        body,
        category: 'daily'
      };
    });
    
    return reports.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  } catch (error) {
    console.error('[Hugo] 读取每日报告失败:', error);
    return [];
  }
}

// 获取早盘资讯报告
export async function getMorningReports(): Promise<Report[]> {
  const HUGO_PATH = getHugoPath();
  try {
    const dir = path.join(HUGO_PATH, 'morning-report');
    
    if (!fs.existsSync(dir)) {
      console.log('[Hugo] 早盘资讯目录不存在:', dir);
      return [];
    }
    
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'index.md' && f !== '_index.md');
    
    const reports = files.map(file => {
      const filePath = path.join(dir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const { data, content: body } = matter(content);
      
      const titleMatch = body.match(/^#\s+(.+)/);
      const title = data.title || (titleMatch ? titleMatch[1] : file.replace('.md', ''));
      const date = normalizeDate(data.date, extractDateFromFilename(file));
      
      const excerpt = extractExcerpt(body, 'morning');
      return {
        title,
        date,
        tags: data.tags || [],
        summary: data.summary || '',
        excerpt,
        author: data.author || '',
        cover_tags: data.cover_tags || [],
        data_freshness: data.data_freshness || '',
        weekday: data.weekday || '',
        slug: toUrlSlug(file),
        filename: file,
        body,
        category: 'morning'
      };
    });
    
    return reports.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  } catch (error) {
    console.error('[Hugo] 读取早盘资讯失败:', error);
    return [];
  }
}

// 获取量化策略报告
export async function getQuantStrategyReports(): Promise<Report[]> {
  const HUGO_PATH = getHugoPath();
  try {
    const dir = IS_VERCEL 
      ? path.join(HUGO_PATH, 'quant-strategies')
      : path.join(HUGO_PATH, 'research/量化策略/daily');
    
    if (!fs.existsSync(dir)) {
      console.log('[Hugo] 量化策略目录不存在:', dir);
      return [];
    }
    
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'index.md' && f !== '_index.md');
    
    const reports = files.map(file => {
      const filePath = path.join(dir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const { data, content: body } = matter(content);
      
      const titleMatch = body.match(/^#\s+(.+)/);
      const title = data.title || (titleMatch ? titleMatch[1] : extractTitleFromFilename(file));
      const date = normalizeDate(data.date, extractDateFromFilename(file));
      
      return {
        title,
        date,
        tags: data.tags || [],
        summary: data.summary || '',
        excerpt: data.description || '',
        author: data.author || '',
        cover_tags: data.cover_tags || [],
        data_freshness: data.data_freshness || '',
        weekday: data.weekday || '',
        slug: toUrlSlug(file),
        filename: file,
        body,
        category: 'quant-strategy',
        // quant strategy specific fields
        strategy_type: data.strategy_type || '',
        market: data.market || '',
        data_frequency: data.data_frequency || '',
        holding_period: data.holding_period || '',
        complexity: data.complexity || '',
        risk_level: data.risk_level || '',
        strategy_status: data.strategy_status || '',
        core_logic: data.core_logic || '',
        key_advantage: data.key_advantage || '',
        key_risk: data.key_risk || '',
        bull_bear: data.bull_bear || '',
      };
    });
    
    return reports.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  } catch (error) {
    console.error('[Hugo] 读取量化策略报告失败:', error);
    return [];
  }
}

// 获取单个报告
export async function getReport(category: string, slug: string): Promise<Report | null> {
  const HUGO_PATH = getHugoPath();
  const originalFilename = fromUrlSlug(slug, category);
  
  if (!originalFilename) {
    console.log('[Hugo] 未找到文件:', slug, category);
    return null;
  }
  
  let dir: string;
  switch (category) {
    case 'industry':
      dir = IS_VERCEL 
        ? path.join(HUGO_PATH, 'industries')
        : path.join(HUGO_PATH, 'research/industries');
      break;
    case 'company':
      dir = IS_VERCEL 
        ? path.join(HUGO_PATH, 'companies')
        : path.join(HUGO_PATH, 'research/companies');
      break;
    case 'daily':
      dir = path.join(HUGO_PATH, 'daily-report');
      break;
    case 'morning':
      dir = path.join(HUGO_PATH, 'morning-report');
      break;
    case 'quant-strategy':
      dir = IS_VERCEL 
        ? path.join(HUGO_PATH, 'quant-strategies')
        : path.join(HUGO_PATH, 'research/量化策略/daily');
      break;
    default:
      return null;
  }
  
  try {
    const filePath = path.join(dir, originalFilename);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data, content: body } = matter(content);
    
    const title = data.title || extractTitleFromFilename(originalFilename);
    const date = normalizeDate(data.date, extractDateFromFilename(originalFilename));
    
    return {
      title,
      date,
      tags: data.tags || [],
      summary: data.summary || '',
      author: data.author || '',
      cover_tags: data.cover_tags || [],
      data_freshness: data.data_freshness || '',
      weekday: data.weekday || '',
      company: data.company || '',
      slug,
      filename: originalFilename,
      body,
      category
    };
  } catch (error) {
    console.error('[Hugo] 读取报告失败:', error);
    return null;
  }
}

// 获取所有报告
export async function getAllReports(): Promise<Report[]> {
  const [industries, companies, daily, morning, quant] = await Promise.all([
    getIndustryReports(),
    getCompanyReports(),
    getDailyReports(),
    getMorningReports(),
    getQuantStrategyReports()
  ]);
  
  return [...daily, ...morning, ...industries, ...companies, ...quant];
}
