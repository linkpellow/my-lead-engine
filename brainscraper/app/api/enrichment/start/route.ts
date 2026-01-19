/**
 * Start enrichment of one lead: proxy to Scrapegoat POST /worker/process-one-start.
 * Returns { run_id, status: "started" } immediately. Client polls GET /api/enrichment/status?run_id=X.
 * No long-lived stream — avoids BodyStreamBuffer/AbortError when runs exceed 5–10 min.
 */

import { getScrapegoatBase } from '@/utils/scrapegoatClient';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const base = getScrapegoatBase();
  const url = `${base}/worker/process-one-start`;
  try {
    const res = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(15000) });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { done: true, processed: false, error: data.detail || res.statusText, failure_mode: 'NETWORK' },
        { status: 200 }
      );
    }
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        done: true,
        processed: false,
        error: `Scrapegoat unreachable: ${msg}. Check SCRAPEGOAT_API_URL and that Scrapegoat is running.`,
        failure_mode: 'NETWORK',
      },
      { status: 200 }
    );
  }
}
