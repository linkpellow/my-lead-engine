import { NextResponse } from 'next/server';

/**
 * Spider Fleet API - Proxy to Scrapegoat
 * 
 * GET /api/spiders - List all spiders
 */

const SCRAPEGOAT_URL = process.env.SCRAPEGOAT_API_URL || process.env.SCRAPEGOAT_URL || '';

export async function GET() {
  try {
    if (!SCRAPEGOAT_URL) {
      return NextResponse.json({
        spiders: [],
        total: 0,
        directory: 'scrapegoat/app/scraping/spiders',
        note: 'Scrapegoat not configured. Set SCRAPEGOAT_API_URL to list spiders.',
      });
    }

    const response = await fetch(`${SCRAPEGOAT_URL}/spiders`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Scrapegoat responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Spiders API] Error:', error);
    return NextResponse.json(
      { 
        spiders: [],
        total: 0,
        error: error instanceof Error ? error.message : 'Failed to fetch spiders'
      },
      { status: 200 } // Return 200 with empty array to avoid UI errors
    );
  }
}
