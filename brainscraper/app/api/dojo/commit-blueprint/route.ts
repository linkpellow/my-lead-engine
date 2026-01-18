/**
 * Commit to Swarm - Push Dojo Golden Route to Redis + site_blueprints.
 *
 * POST /api/dojo/commit-blueprint
 * Body: { domain, blueprint }
 *
 * Proxies to Scrapegoat /api/blueprints/commit-to-swarm. Workers pull from
 * Redis blueprint:{domain}; no restarts. Map-to-Engine / Zero-Bot.
 */

import { NextRequest, NextResponse } from 'next/server';

const SCRAPEGOAT_URL = process.env.SCRAPEGOAT_URL || process.env.SCRAPEGOAT_API_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { domain, blueprint } = body;
    if (!domain || !blueprint) {
      return NextResponse.json({ success: false, error: 'Missing domain or blueprint' }, { status: 400 });
    }

    const res = await fetch(`${SCRAPEGOAT_URL}/api/blueprints/commit-to-swarm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, blueprint }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: data.detail || data.error || `Scrapegoat ${res.status}` },
        { status: res.status }
      );
    }
    // Dojo → pipeline activation: mark domain active so workers prefer this blueprint
    const d = String(body.domain || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    if (d) {
      try {
        await fetch(`${SCRAPEGOAT_URL}/api/pipeline/trigger-dojo-domain`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: d }),
        });
      } catch {
        /* non-fatal */
      }
    }
    return NextResponse.json({ success: true, ...data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Commit failed' }, { status: 500 });
  }
}
