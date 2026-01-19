/**
 * Proxy to Scrapegoat GET /probe/sites. Returns which people-search site works: ok, block, empty, client_error, timeout.
 * ?site=fastpeoplesearch.com to probe one. Use to choose CHIMERA_PROVIDERS.
 */

import { getScrapegoatBase } from '@/utils/scrapegoatClient';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const site = request.nextUrl.searchParams.get('site') ?? '';
  const base = getScrapegoatBase();
  const q = site ? `?site=${encodeURIComponent(site)}` : '';
  try {
    const res = await fetch(`${base}/probe/sites${q}`, { method: 'GET', signal: AbortSignal.timeout(60000) });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `Scrapegoat probe failed: ${msg}. Check SCRAPEGOAT_API_URL.` },
      { status: 502 }
    );
  }
}
