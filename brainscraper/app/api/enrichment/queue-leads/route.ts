/**
 * Queue leads for real enrichment (leads_to_enrich -> Scrapegoat -> Chimera -> Postgres).
 * Replaces simulated enrichData: rows are pushed to the pipeline and surface in
 * Enriched Leads when DatabaseSaveStation completes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { pushLeadsToEnrichQueueFromEnrichUI } from '@/utils/redisBridge';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const rows = Array.isArray(body.rows) ? body.rows : Array.isArray(body.leads) ? body.leads : [];
    if (rows.length === 0) {
      return NextResponse.json({ success: true, pushed: 0, skipped: 0, message: 'No rows to queue.' });
    }
    const { pushed, skipped } = await pushLeadsToEnrichQueueFromEnrichUI(rows);
    return NextResponse.json({
      success: true,
      pushed,
      skipped,
      message: `Queued ${pushed} for enrichment. Results will appear in Enriched Leads when ready.`,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Queue failed', pushed: 0, skipped: 0 },
      { status: 500 }
    );
  }
}
