/**
 * Dojo Blacklist - Paint red zones (Forbidden Regions) on a site's map.
 *
 * GET ?domain=...  -> returns { success, regions: { rects, selectors } }
 * POST { domain, regions: [ { type: "rect", x, y, width, height } | { type: "selector", selector } ] }
 *   -> writes dojo:forbidden:{domain}, publishes dojo:forbidden_updates for Chimera workers.
 */

import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';

const PREFIX = 'dojo:forbidden:';
const CHANNEL = 'dojo:forbidden_updates';

function getRedis(): Redis | null {
  const url = process.env.REDIS_URL || process.env.APP_REDIS_URL;
  if (!url) return null;
  try {
    return new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
  } catch {
    return null;
  }
}

function normDomain(d: string): string {
  return String(d || '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];
}

export async function GET(request: NextRequest) {
  let redis: Redis | null = null;
  try {
    const { searchParams } = new URL(request.url);
    const domain = normDomain(searchParams.get('domain') || '');
    if (!domain) {
      return NextResponse.json({ success: false, error: 'Missing domain' }, { status: 400 });
    }

    redis = getRedis();
    if (!redis) {
      return NextResponse.json({ success: false, error: 'Redis not configured' }, { status: 503 });
    }

    const raw = await redis.get(`${PREFIX}${domain}`);
    let regions: { rects: Array<{ x: number; y: number; width: number; height: number }>; selectors: string[] } = {
      rects: [],
      selectors: [],
    };
    if (raw) {
      try {
        const data = JSON.parse(raw);
        regions = {
          rects: Array.isArray(data.rects) ? data.rects : [],
          selectors: Array.isArray(data.selectors) ? data.selectors : [],
        };
      } catch {
        /**/
      }
    }

    return NextResponse.json({ success: true, domain, regions });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'GET failed' }, { status: 500 });
  } finally {
    redis?.disconnect();
  }
}

export async function POST(request: NextRequest) {
  let redis: Redis | null = null;
  try {
    const body = await request.json().catch(() => ({}));
    const { domain, regions } = body;
    const d = normDomain(domain || '');
    if (!d) {
      return NextResponse.json({ success: false, error: 'Missing or invalid domain' }, { status: 400 });
    }

    const rects: Array<{ type: string; x: number; y: number; width: number; height: number }> = [];
    const selectors: string[] = [];
    for (const r of Array.isArray(regions) ? regions : []) {
      if (r?.type === 'rect' && typeof r.x === 'number' && typeof r.y === 'number') {
        rects.push({
          type: 'rect',
          x: Number(r.x),
          y: Number(r.y),
          width: Number(r.width) || 0,
          height: Number(r.height) || 0,
        });
      } else if (r?.type === 'selector' && typeof r.selector === 'string') {
        selectors.push(String(r.selector).trim());
      }
    }

    redis = getRedis();
    if (!redis) {
      return NextResponse.json({ success: false, error: 'Redis not configured' }, { status: 503 });
    }

    const key = `${PREFIX}${d}`;
    const payload = JSON.stringify({ rects, selectors });
    await redis.set(key, payload);
    await redis.publish(CHANNEL, JSON.stringify({ domain: d, rects: rects.length, selectors: selectors.length }));

    return NextResponse.json({ success: true, domain: d, channel: CHANNEL, rects: rects.length, selectors: selectors.length });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'POST failed' }, { status: 500 });
  } finally {
    redis?.disconnect();
  }
}
