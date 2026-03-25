/**
 * Hugo 报告读取工具
 * Vercel: 从 public/hugo-data 读取
 * 本地: 从 data/insights 软链接读取
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

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
  // 本地开发：优先用软链接，不存在则用 Hugo 源目录
  if (fs.existsSync(LOCAL_HUGO_PATH)) {
    return LOCAL_HUGO_PATH;
  }
  // 备选：直接用 Hugo 源目录
  return '/Users/alpha/Documents/learn/openclaw_project/teamwork_html/docs/insights';
}

// 从文件名提取日期，如 "2026-03-14-食品饮料.md" -> "2026-03-14"
function extractDateFromFilename(filename: string): string {
  // 匹配 YYYY-MM-DD 格式
  const match = filename.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

// 从文件名提取标题，如 "2026-03-14-食品饮料.md" -> "食品饮料"
function extractTitleFromFilename(filename: string): string {
  // 去掉日期前缀
  return filename.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace('.md', '');
}

export interface ReportMeta {
  title: string;
  date: string;
  tags?: string[];
  summary?: string;
  author?: string;
  slug: string;
}

export interface Report extends ReportMeta {
  body: string;
  category?: string;
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
      
      // 优先用 frontmatter 的 title，其次从文件名提取
      const title = data.title || extractTitleFromFilename(file);
      // 优先用 frontmatter 的 date，其次从文件名提取
      const date = data.date || extractDateFromFilename(file);
      
      return {
        title,
        date,
        tags: data.tags || [],
        summary: data.summary || '',
        author: data.author || '',
        slug: file.replace('.md', ''),
        body,
        category: 'industry'
      };
    });
    
    // 按日期倒序排列
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
        slug: file.replace('.md', ''),
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
      
      // 每日报告的标题从文件内容第一行提取
      const titleMatch = body.match(/^#\s+(.+)/);
      const title = data.title || (titleMatch ? titleMatch[1] : file.replace('.md', ''));
      const date = data.date || extractDateFromFilename(file);
      
      return {
        title,
        date,
        tags: data.tags || [],
        summary: data.summary || '',
        author: data.author || '',
        slug: file.replace('.md', ''),
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

// 获取所有报告
export async function getAllReports(): Promise<Report[]> {
  const [industries, companies, daily] = await Promise.all([
    getIndustryReports(),
    getCompanyReports(),
    getDailyReports()
  ]);
  
  return [...daily, ...industries, ...companies];
}

// 获取单个报告
export async function getReport(category: string, slug: string): Promise<Report | null> {
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
  
  try {
    const filePath = path.join(dir, `${slug}.md`);
    if (!fs.existsSync(filePath)) {
      console.log('[Hugo] 文件不存在:', filePath);
      return null;
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data, content: body } = matter(content);
    
    const titleMatch = body.match(/^#\s+(.+)/);
    const title = data.title || (titleMatch ? titleMatch[1] : slug);
    const date = data.date || extractDateFromFilename(slug);
    
    return {
      title,
      date,
      tags: data.tags || [],
      summary: data.summary || '',
      author: data.author || '',
      slug,
      body,
      category
    };
  } catch (error) {
    console.error('[Hugo] 读取报告失败:', error);
    return null;
  }
}
