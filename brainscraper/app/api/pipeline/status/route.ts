/**
 * Pipeline Status API Route
 * Proxies to Scrapegoat's /health and /queue/status endpoints
 * Returns combined pipeline status for the frontend
 */

import { NextResponse } from 'next/server';
import { scrapegoatClient, PipelineStatus } from '@/utils/scrapegoatClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const status: PipelineStatus = await scrapegoatClient.getPipelineStatus();

    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error('Pipeline status error:', error);
    
    // Return degraded status on error, don't fail the request
    return NextResponse.json({
      success: false,
      health: {
        status: 'degraded',
        redis: 'disconnected',
        redis_url_configured: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      queue: {
        leads_to_enrich: 0,
        failed_leads: 0,
        status: 'inactive',
      },
      timestamp: new Date().toISOString(),
    });
  }
}
