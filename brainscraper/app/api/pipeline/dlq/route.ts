/**
 * Pipeline DLQ (Dead Letter Queue) API Route
 * Proxies to Scrapegoat's DLQ endpoints
 * Handles: GET (list failed leads), POST (retry operations)
 */

import { NextRequest, NextResponse } from 'next/server';
import { scrapegoatClient } from '@/utils/scrapegoatClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/pipeline/dlq
 * Fetch list of failed leads from DLQ
 * Query params: limit (optional, default 100)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit');
    
    const dlqData = await scrapegoatClient.getDLQ(
      limit ? parseInt(limit, 10) : undefined
    );

    return NextResponse.json({
      success: true,
      ...dlqData,
    });
  } catch (error) {
    console.error('DLQ fetch error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch DLQ',
        failed_leads: [],
        total: 0,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pipeline/dlq
 * Retry failed leads
 * Body: { action: 'retry_one' | 'retry_all', index?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, index } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Missing action parameter' },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case 'retry_one':
        if (typeof index !== 'number') {
          return NextResponse.json(
            { success: false, error: 'Missing or invalid index for retry_one' },
            { status: 400 }
          );
        }
        result = await scrapegoatClient.retryOne(index);
        break;

      case 'retry_all':
        result = await scrapegoatClient.retryAll();
        break;

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('DLQ action error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'DLQ action failed',
      },
      { status: 500 }
    );
  }
}
