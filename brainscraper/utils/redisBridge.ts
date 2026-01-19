/**
 * Redis Bridge - LPUSH to leads_to_enrich for Scrapegoat worker swarm
 *
 * When Sales Navigator search returns person leads, we push them directly to
 * Redis. The moment you click "Search", the Scrapegoat workers wake up.
 *
 * Pre-flight (Bloom-style check): skips linkedinUrls that exist in Postgres with enriched_at within 30 days.
 * Queue: leads_to_enrich (FIFO)
 * Format: { linkedinUrl, name, location, title, company, platform, sourceDetails }
 *
 * Requires: REDIS_URL or APP_REDIS_URL. DATABASE_URL or APP_DATABASE_URL for dedup. If unset, LPUSH/dedup degrades.
 */

import Redis from 'ioredis';
import { Pool } from 'pg';

const QUEUE_NAME = 'leads_to_enrich';
const DEDUP_DAYS = 30;

let _pg: Pool | null = null;
function getDb(): Pool | null {
  if (_pg !== null) return _pg;
  const url = process.env.DATABASE_URL || process.env.APP_DATABASE_URL;
  if (!url) return null;
  _pg = new Pool({ connectionString: url });
  return _pg;
}

/** Bloom-style pre-filter: linkedinUrls with enriched_at within the last DEDUP_DAYS days. */
async function getRecentlyEnrichedSet(urls: string[]): Promise<Set<string>> {
  const db = getDb();
  if (!db || urls.length === 0) return new Set();
  try {
    const { rows } = await db.query<{ linkedin_url: string }>(
      `SELECT linkedin_url FROM leads
       WHERE linkedin_url = ANY($1) AND enriched_at > NOW() - ($2::text || ' days')::interval`,
      [urls, DEDUP_DAYS]
    );
    return new Set(rows.map((r) => r.linkedin_url));
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[REDIS_BRIDGE] getRecentlyEnrichedSet failed:', e instanceof Error ? e.message : e);
    }
    return new Set();
  }
}

const PERSON_ENDPOINTS = new Set([
  'search_person',
  'premium_search_person',
  'search_person_via_url',
  'premium_search_person_via_url',
]);

let _client: Redis | null = null;

function getClient(): Redis | null {
  if (_client !== null) return _client;
  const url = process.env.REDIS_URL || process.env.APP_REDIS_URL;
  if (!url) return null;
  try {
    _client = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
    return _client;
  } catch {
    return null;
  }
}

/**
 * Normalize a raw Sales Navigator lead to the Scrapegoat queue format.
 * Matches LinkedInLeadGenerator / Scrapegoat identity_resolution expectations.
 */
function toQueueLead(raw: Record<string, unknown>, sourceDetails?: Record<string, unknown>): Record<string, unknown> | null {
  const linkedinUrl =
    (raw.navigationUrl as string) ||
    (raw.linkedin_url as string) ||
    (raw.profile_url as string) ||
    (raw.url as string) ||
    '';
  if (!linkedinUrl || typeof linkedinUrl !== 'string') return null;

  const first = (raw.firstName as string) || '';
  const last = (raw.lastName as string) || '';
  const full = (raw.name as string) || [first, last].filter(Boolean).join(' ').trim() || 'Unknown';

  const cur = raw.currentPosition as Record<string, unknown> | undefined;
  const title =
    (cur?.title as string) ||
    (raw.title as string) ||
    (raw.job_title as string) ||
    (raw.headline as string) ||
    '';
  const company =
    (cur?.companyName as string) || (raw.company as string) || (raw.company_name as string) || '';

  const location = (raw.geoRegion as string) || (raw.location as string) || '';

  return {
    linkedinUrl,
    name: full,
    location,
    title,
    company,
    platform: 'linkedin',
    sourceDetails: sourceDetails && Object.keys(sourceDetails).length > 0 ? sourceDetails : { source: 'linkedin_sales_navigator' },
  };
}

/**
 * Push person leads to leads_to_enrich. No-op for company endpoints or if REDIS_URL unset.
 * Pre-flight: skips linkedinUrls already enriched in Postgres within the last 30 days (dedup guardrail).
 * Swallows errors so the API response is never broken by Redis or Postgres.
 */
export async function pushLeadsToEnrichQueue(
  leads: unknown[],
  endpoint: string,
  sourceDetails?: Record<string, unknown>
): Promise<{ pushed: number; skipped: number }> {
  if (!Array.isArray(leads) || leads.length === 0) return { pushed: 0, skipped: 0 };
  if (!PERSON_ENDPOINTS.has(endpoint)) return { pushed: 0, skipped: leads.length };

  const client = getClient();
  if (!client) return { pushed: 0, skipped: leads.length };

  const sd = sourceDetails ?? { source: 'linkedin_sales_navigator', endpoint };
  const cand: { q: Record<string, unknown>; url: string }[] = [];
  for (const raw of leads) {
    if (!raw || typeof raw !== 'object') continue;
    const q = toQueueLead(raw as Record<string, unknown>, sd);
    if (!q) continue;
    const url = String(q.linkedinUrl || '');
    if (!url) continue;
    cand.push({ q, url });
  }
  if (cand.length === 0) return { pushed: 0, skipped: leads.length };

  // Dedup guardrail: exclude linkedinUrls already enriched in Postgres within 30 days
  const recentlyEnriched = await getRecentlyEnrichedSet(cand.map((c) => c.url));

  let pushed = 0;
  let skipped = leads.length - cand.length; // invalid or toQueueLead null
  try {
    for (const { q, url } of cand) {
      if (recentlyEnriched.has(url)) {
        skipped++;
        continue;
      }
      await client.lpush(QUEUE_NAME, JSON.stringify(q));
      pushed++;
    }
    if (pushed > 0 && typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      console.log(`[REDIS_BRIDGE] LPUSH ${pushed} leads to ${QUEUE_NAME} (skipped ${skipped}, dedup=${recentlyEnriched.size})`);
    }
  } catch (e) {
    console.warn('[REDIS_BRIDGE] LPUSH failed:', e instanceof Error ? e.message : String(e));
  }

  return { pushed, skipped };
}

/**
 * Map a generic enrich-UI row to queue lead format.
 */
function toQueueLeadFromRow(row: Record<string, unknown>): { q: Record<string, unknown>; url: string } | null {
  const linkedinUrl = String(row.linkedinUrl ?? row.linkedin_url ?? '').trim();
  if (!linkedinUrl) return null;
  const name =
    String(row.name ?? '').trim() ||
    [row.firstName, row.lastName].filter(Boolean).join(' ').trim() ||
    'Unknown';
  const location = String(row.location ?? row.geoRegion ?? '').trim();
  const title = String(row.title ?? row.headline ?? row.job_title ?? '').trim();
  const company = String(row.company ?? row.companyName ?? '').trim();
  const q: Record<string, unknown> = {
    linkedinUrl,
    name,
    location,
    title,
    company,
    platform: 'linkedin',
    sourceDetails: { source: 'enrich_ui' },
  };
  if (row.firstName != null && String(row.firstName).trim()) q.firstName = String(row.firstName).trim();
  if (row.lastName != null && String(row.lastName).trim()) q.lastName = String(row.lastName).trim();
  if (row.city != null && String(row.city).trim()) q.city = String(row.city).trim();
  if (row.state != null && String(row.state).trim()) q.state = String(row.state).trim();
  if (row.email != null && String(row.email).trim()) q.email = String(row.email).trim();
  if (row.phone != null && String(row.phone).trim()) q.phone = String(row.phone).trim();
  return { q, url: linkedinUrl };
}

/**
 * Push rows from the Enrich UI (e.g. enrichData) to leads_to_enrich.
 * Uses same dedup guardrail as pushLeadsToEnrichQueue. For use by /api/enrichment/queue-leads.
 */
export async function pushLeadsToEnrichQueueFromEnrichUI(
  rows: Record<string, unknown>[]
): Promise<{ pushed: number; skipped: number }> {
  if (!Array.isArray(rows) || rows.length === 0) return { pushed: 0, skipped: 0 };
  const client = getClient();
  if (!client) return { pushed: 0, skipped: rows.length };
  const cand: { q: Record<string, unknown>; url: string }[] = [];
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const x = toQueueLeadFromRow(r as Record<string, unknown>);
    if (x) cand.push(x);
  }
  if (cand.length === 0) return { pushed: 0, skipped: rows.length };
  const recentlyEnriched = await getRecentlyEnrichedSet(cand.map((c) => c.url));
  let pushed = 0;
  let skipped = rows.length - cand.length;
  try {
    for (const { q, url } of cand) {
      if (recentlyEnriched.has(url)) {
        skipped++;
        continue;
      }
      await client.lpush(QUEUE_NAME, JSON.stringify(q));
      pushed++;
    }
  } catch (e) {
    console.warn('[REDIS_BRIDGE] pushLeadsToEnrichQueueFromEnrichUI:', (e as Error)?.message);
  }
  return { pushed, skipped };
}
