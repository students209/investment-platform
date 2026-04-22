import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DIR_PATH = '/Users/alpha/Documents/learn/openclaw_project/teamwork_html/docs/insights/资金流看板';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    if (!filename || !filename.endsWith('.html')) {
      return new NextResponse('Invalid filename', { status: 400 });
    }

    // Security: prevent directory traversal
    if (filename.includes('/') || filename.includes('..')) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const filePath = path.join(DIR_PATH, filename);

    if (!fs.existsSync(filePath)) {
      return new NextResponse('File not found', { status: 404 });
    }

    const content = fs.readFileSync(filePath, 'utf-8');

    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Failed to read fund flow report:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
