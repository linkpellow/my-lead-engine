/**
 * Scrape History API Route
 * Handles lead scraping history and results
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export async function GET(request: NextRequest) {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    
    if (!fs.existsSync(dataDir)) {
      return NextResponse.json({ 
        success: true, 
        history: [] 
      });
    }
    
    const files = fs.readdirSync(dataDir)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(dataDir, file);
        const stats = fs.statSync(filePath);
        return {
          id: file,
          name: file,
          createdAt: stats.birthtime.toISOString(),
          size: stats.size,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return NextResponse.json({
      success: true,
      history: files,
    });
  } catch (error) {
    console.error('Error fetching scrape history:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch scrape history' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { location, maxLeads } = body;

    // Scrape initiation via this endpoint is not implemented. Use LinkedIn Lead
    // Generator or V2 Pilot to run searches. Returning implemented: false so
    // callers do not treat a fake jobId as a queued job.
    return NextResponse.json({
      success: true,
      jobId: null,
      implemented: false,
      message: 'Scrape initiation is not implemented. Use LinkedIn Lead Generator or V2 Pilot.',
      location: location ?? null,
      maxLeads: maxLeads ?? null,
    });
  } catch (error) {
    console.error('Error initiating scrape:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to initiate scrape' },
      { status: 500 }
    );
  }
}