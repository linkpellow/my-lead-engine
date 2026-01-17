import { NextRequest, NextResponse } from 'next/server';

/**
 * Spider Fleet API - Run Spider
 * 
 * POST /api/spiders/[spiderId]/run - Trigger spider execution
 */

const SCRAPEGOAT_URL = process.env.SCRAPEGOAT_API_URL || process.env.SCRAPEGOAT_URL || '';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ spiderId: string }> }
) {
  try {
    const { spiderId } = await params;

    if (!SCRAPEGOAT_URL) {
      return NextResponse.json(
        { success: false, error: 'Scrapegoat not configured' },
        { status: 503 }
      );
    }

    // Get optional params from request body
    let runParams = {};
    try {
      const body = await request.json();
      runParams = body.params || {};
    } catch {
      // No body or invalid JSON - that's fine, use empty params
    }

    const response = await fetch(`${SCRAPEGOAT_URL}/spiders/${spiderId}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(runParams),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { success: false, error: `Spider '${spiderId}' not found` },
          { status: 404 }
        );
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Scrapegoat responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Spider API] RUN Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to run spider' },
      { status: 500 }
    );
  }
}
