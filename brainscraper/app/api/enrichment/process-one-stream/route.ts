/**
 * Proxy to Scrapegoat POST /worker/process-one-stream.
 * Streams NDJSON progress events (step, pct, station, status) then {done, success, steps, logs}.
 * Use this so the Enrich UI can show a live progress feed instead of appearing frozen.
 */

import { getScrapegoatBase } from '@/utils/scrapegoatClient';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const STREAM_TIMEOUT_MS = 330_000; // 330s so Chimera BRPOP 240s + pipeline overhead can finish

export async function POST() {
  const base = getScrapegoatBase();
  const url = `${base}/worker/process-one-stream`;
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', signal: controller.signal });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isAbort = e instanceof Error && e.name === 'AbortError';
    return new Response(
      JSON.stringify({
        done: true,
        processed: false,
        error: isAbort ? `Scrapegoat stream timeout after ${STREAM_TIMEOUT_MS / 1000}s` : `Scrapegoat fetch error: ${msg}`,
      }) + '\n',
      { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } }
    );
  } finally {
    clearTimeout(to);
  }
  if (!res.ok || !res.body) {
    const text = await res.text();
    return new Response(
      JSON.stringify({
        done: true,
        processed: false,
        error: `Scrapegoat ${res.status}: ${text || res.statusText}`,
      }) + '\n',
      { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } }
    );
  }

  return new Response(res.body, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
