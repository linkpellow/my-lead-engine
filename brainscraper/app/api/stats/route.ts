/**
 * GPS Dashboard - People-Search Magazine rankings.
 *
 * Returns success_rate and avg_latency_sec per provider from Redis (gps:provider:*).
 * Same keys as scrapegoat/app/pipeline/router.py.
 *
 * GET /api/stats
 */

import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';

const MAGAZINE = [
  'FastPeopleSearch',
  'TruePeopleSearch',
  'ZabaSearch',
  'SearchPeopleFree',
  'ThatsThem',
  'AnyWho',
];

const PREFIX = 'gps:provider:';

function getRedis(): Redis | null {
  const url = process.env.REDIS_URL || process.env.APP_REDIS_URL;
  if (!url) return null;
  try {
    return new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
  } catch {
    return null;
  }
}

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(_request: NextRequest) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({
      success: true,
      source: 'redis_unavailable',
      rankings: [],
      message: 'REDIS_URL not set; GPS rankings unavailable.',
    });
  }

  try {
    const rankings: { provider: string; success_rate: number; avg_latency_sec: number; n: number }[] = [];
    for (const name of MAGAZINE) {
      const raw = (await redis.hgetall(`${PREFIX}${name}`)) as Record<string, string> | undefined;
      const s = toNum(raw?.success_count);
      const f = toNum(raw?.failure_count);
      const t = toNum(raw?.total_latency_ms);
      const n = s + f;
      const success_rate = n > 0 ? Math.round((s / n) * 1000) / 10 : 0;
      const avg_latency_sec = n > 0 ? Math.round((t / n) / 10) / 100 : 0;
      rankings.push({ provider: name, success_rate, avg_latency_sec, n });
    }
    // Sort by success_rate desc, then latency asc
    rankings.sort((a, b) => (b.success_rate !== a.success_rate ? b.success_rate - a.success_rate : a.avg_latency_sec - b.avg_latency_sec));

    return NextResponse.json({
      success: true,
      source: 'redis',
      rankings,
      message: 'GPS Magazine rankings.',
    });
  } catch (e) {
    console.error('GPS stats error:', e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Unknown', rankings: [] },
      { status: 500 }
    );
  } finally {
    redis?.disconnect();
  }
}
