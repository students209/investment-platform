import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DIR_PATH = '/Users/alpha/Documents/learn/openclaw_project/teamwork_html/docs/insights/资金流看板';

export async function GET() {
  try {
    if (!fs.existsSync(DIR_PATH)) {
      return NextResponse.json({ files: [] });
    }

    const files = fs.readdirSync(DIR_PATH);
    const htmlFiles = files
      .filter((file) => file.endsWith('.html') && file.startsWith('资金流全景看板_'))
      .map((file) => {
        // Extract date from "资金流全景看板_YYYY_MM_DD.html" or "资金流全景看板_YYYY-MM-DD.html"
        let dateStr = file.replace('资金流全景看板_', '').replace('.html', '');
        // normalize _ to - for UI consistancy
        dateStr = dateStr.replace(/_/g, '-');
        return {
          filename: file,
          date: dateStr,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date)); // Newest first

    return NextResponse.json({ files: htmlFiles });
  } catch (error) {
    console.error('Failed to list fund flow files:', error);
    return NextResponse.json({ files: [] }, { status: 500 });
  }
}
