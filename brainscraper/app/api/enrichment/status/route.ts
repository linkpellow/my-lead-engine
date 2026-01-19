/**
 * Poll enrichment run: proxy to Scrapegoat GET /worker/process-one-status?run_id=X.
 * Returns { status, progress, result?, error? }. status=running|done|error.
 */

import { getScrapegoatBase } from '@/utils/scrapegoatClient';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get('run_id');
  if (!runId) {
    return NextResponse.json({ error: 'run_id required' }, { status: 400 });
  }
  const base = getScrapegoatBase();
  const url = `${base}/worker/process-one-status?run_id=${encodeURIComponent(runId)}`;
  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    if (res.status === 404) {
      return NextResponse.json(data, { status: 404 });
    }
    if (!res.ok) {
      return NextResponse.json({ status: 'error', error: data.detail || res.statusText }, { status: 200 });
    }
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { status: 'error', error: `Scrapegoat unreachable: ${msg}` },
      { status: 200 }
    );
  }
}
