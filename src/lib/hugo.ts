/**
 * Hugo 报告读取工具
 * 直接读取本地 Markdown 文件
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const HUGO_PATH = '/Users/alpha/investment-platform/data/insights';

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
  try {
    const dir = path.join(HUGO_PATH, 'research/industries');
    if (!fs.existsSync(dir)) return [];
    
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    
    return files
      .map(file => {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8');
        const { data, content: body } = matter(content);
        return {
          title: data.title || file.replace('.md', ''),
          date: data.date || '',
          tags: data.tags || [],
          summary: data.summary || '',
          author: data.author || '',
          slug: file.replace('.md', ''),
          body,
          category: 'industry'
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error('Error reading industry reports:', error);
    return [];
  }
}

// 获取企业研究报告
export async function getCompanyReports(): Promise<Report[]> {
  try {
    const dir = path.join(HUGO_PATH, 'research/companies');
    if (!fs.existsSync(dir)) return [];
    
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    
    return files
      .map(file => {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8');
        const { data, content: body } = matter(content);
        return {
          title: data.title || file.replace('.md', ''),
          date: data.date || '',
          tags: data.tags || [],
          summary: data.summary || '',
          author: data.author || '',
          slug: file.replace('.md', ''),
          body,
          category: 'company'
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error('Error reading company reports:', error);
    return [];
  }
}

// 获取每日报告
export async function getDailyReports(): Promise<Report[]> {
  try {
    const dir = path.join(HUGO_PATH, 'daily-report');
    if (!fs.existsSync(dir)) return [];
    
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    
    return files
      .map(file => {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8');
        const { data, content: body } = matter(content);
        return {
          title: data.title || file.replace('.md', ''),
          date: data.date || '',
          tags: data.tags || [],
          summary: data.summary || '',
          author: data.author || '',
          slug: file.replace('.md', ''),
          body,
          category: 'daily'
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error('Error reading daily reports:', error);
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
  let dir: string;
  
  switch (category) {
    case 'industry':
      dir = path.join(HUGO_PATH, 'research/industries');
      break;
    case 'company':
      dir = path.join(HUGO_PATH, 'research/companies');
      break;
    case 'daily':
      dir = path.join(HUGO_PATH, 'daily-report');
      break;
    default:
      return null;
  }
  
  try {
    const filePath = path.join(dir, `${slug}.md`);
    if (!fs.existsSync(filePath)) return null;
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data, content: body } = matter(content);
    
    return {
      title: data.title || slug,
      date: data.date || '',
      tags: data.tags || [],
      summary: data.summary || '',
      author: data.author || '',
      slug,
      body,
      category
    };
  } catch (error) {
    console.error('Error reading report:', error);
    return null;
  }
}
