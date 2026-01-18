/**
 * Data Enrichment Utilities
 * Handles lead enrichment with demographic and contact data
 */

export interface EnrichedRow {
  [key: string]: any;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  age?: number;
  income?: string;
  enriched?: boolean;
}

export interface EnrichedData {
  headers: string[];
  rows: EnrichedRow[];
  totalRows: number;
  enrichedCount: number;
  fileName: string;
}

export interface EnrichmentProgress {
  current: number;
  total: number;
  percentage: number;
  status: 'idle' | 'enriching' | 'complete' | 'error';
  message?: string;
  // Optional detailed progress fields (for UI display)
  leadName?: string;
  step?: 'linkedin' | 'zip' | 'phone-discovery' | 'telnyx' | 'gatekeep' | 'age' | 'complete' | string;
  stepDetails?: {
    firstName?: string;
    lastName?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    phone?: string;
    email?: string;
    lineType?: string;
    carrier?: string;
    age?: string | number;
  };
  errors?: string[];
  timestamp?: number;
}

/**
 * Queue leads for real enrichment (leads_to_enrich -> Scrapegoat -> Chimera -> Postgres).
 * No simulation: rows are pushed to the pipeline. Results appear in Enriched Leads
 * when the Scrapegoat worker and Chimera complete.
 */
export async function enrichData(
  data: { headers: string[]; rows: Record<string, any>[] },
  onProgress?: (progress: EnrichmentProgress) => void
): Promise<EnrichedData> {
  if (!data.rows?.length) {
    if (onProgress) {
      onProgress({ current: 0, total: 0, percentage: 100, status: 'complete', message: 'No rows to enrich.' });
    }
    return {
      headers: data.headers || [],
      rows: [],
      totalRows: 0,
      enrichedCount: 0,
      fileName: 'enriched-data',
    };
  }

  if (onProgress) {
    onProgress({
      current: 0,
      total: data.rows.length,
      percentage: 0,
      status: 'enriching',
      message: `Queuing ${data.rows.length} leads for enrichment…`,
    });
  }

  let pushed = 0;
  let skipped = 0;
  try {
    const res = await fetch('/api/enrichment/queue-leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: data.rows }),
    });
    const json = await res.json().catch(() => ({}));
    pushed = json.pushed ?? 0;
    skipped = json.skipped ?? 0;
  } catch (e) {
    if (onProgress) {
      onProgress({
        current: data.rows.length,
        total: data.rows.length,
        percentage: 100,
        status: 'error',
        message: `Queue failed: ${(e as Error)?.message || 'Unknown error'}`,
      });
    }
    return {
      headers: data.headers,
      rows: data.rows.map((r) => ({ ...r, enriched: false })),
      totalRows: data.rows.length,
      enrichedCount: 0,
      fileName: 'enriched-data',
    };
  }

  if (onProgress) {
    onProgress({
      current: data.rows.length,
      total: data.rows.length,
      percentage: 100,
      status: 'complete',
      message: `Queued ${pushed} for enrichment. Results will appear in Enriched Leads when ready.${skipped > 0 ? ` (${skipped} skipped, already recently enriched.)` : ''}`,
    });
  }

  return {
    headers: data.headers,
    rows: data.rows.map((r) => ({ ...r, enriched: 'queued' as any })),
    totalRows: data.rows.length,
    enrichedCount: pushed,
    fileName: 'enriched-data',
  };
}