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
  author?: string;
  slug: string;
  filename: string;
}

export interface Report extends ReportMeta {
  body: string;
  category?: string;
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
    
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    
    const reports = files.map(file => {
      const filePath = path.join(dir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const { data, content: body } = matter(content);
      
      const title = data.title || extractTitleFromFilename(file);
      const date = data.date || extractDateFromFilename(file);
      
      return {
        title,
        date,
        tags: data.tags || [],
        summary: data.summary || '',
        author: data.author || '',
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
    
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    
    const reports = files.map(file => {
      const filePath = path.join(dir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const { data, content: body } = matter(content);
      
      const title = data.title || extractTitleFromFilename(file);
      const date = data.date || extractDateFromFilename(file);
      
      return {
        title,
        date,
        tags: data.tags || [],
        summary: data.summary || '',
        author: data.author || '',
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
    
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    
    const reports = files.map(file => {
      const filePath = path.join(dir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const { data, content: body } = matter(content);
      
      const titleMatch = body.match(/^#\s+(.+)/);
      const title = data.title || (titleMatch ? titleMatch[1] : file.replace('.md', ''));
      const date = data.date || extractDateFromFilename(file);
      
      return {
        title,
        date,
        tags: data.tags || [],
        summary: data.summary || '',
        author: data.author || '',
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
    const date = data.date || extractDateFromFilename(originalFilename);
    
    return {
      title,
      date,
      tags: data.tags || [],
      summary: data.summary || '',
      author: data.author || '',
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
  const [industries, companies, daily] = await Promise.all([
    getIndustryReports(),
    getCompanyReports(),
    getDailyReports()
  ]);
  
  return [...daily, ...industries, ...companies];
}
