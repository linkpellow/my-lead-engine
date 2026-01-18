/**
 * Dojo Neural Bridge - Publish Golden Route to Redis.
 *
 * POST /api/dojo/publish
 * Body: { domain, goldenRoute }
 *
 * Writes to Redis Hash BLUEPRINT:{domain}.
 * Publishes to blueprint_updates channel to notify all active workers.
 */

import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';

const BLUEPRINT_PREFIX = 'BLUEPRINT:';
const CHANNEL = 'blueprint_updates';

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

export async function POST(request: NextRequest) {
  let redis: Redis | null = null;
  try {
    const body = await request.json();
    const { domain, goldenRoute } = body;
    if (!domain || !goldenRoute) {
      return NextResponse.json({ success: false, error: 'Missing domain or goldenRoute' }, { status: 400 });
    }

    const d = normDomain(domain);
    if (!d) {
      return NextResponse.json({ success: false, error: 'Invalid domain' }, { status: 400 });
    }

    redis = getRedis();
    if (!redis) {
      return NextResponse.json(
        { success: false, error: 'REDIS_URL not set; cannot publish' },
        { status: 503 }
      );
    }

    const key = `${BLUEPRINT_PREFIX}${d}`;
    const instructions = Array.isArray((goldenRoute as any).instructions) ? (goldenRoute as any).instructions : [];
    const updated_at = new Date().toISOString();

    const mapping: Record<string, string> = {
      data: JSON.stringify(goldenRoute),
      instructions: JSON.stringify(instructions),
      updated_at,
    };

    await redis.hset(key, mapping);
    await redis.publish(CHANNEL, JSON.stringify({ domain: d, updated_at }));

    return NextResponse.json({ success: true, domain: d, channel: CHANNEL });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Publish failed' }, { status: 500 });
  } finally {
    redis?.disconnect();
  }
}
