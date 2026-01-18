import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getDataFilePath, safeReadFile } from '@/utils/dataDirectory';

/**
 * Load enriched results: UNIFIED Postgres + JSON.
 * - Postgres: queue-based enrichment (leads_to_enrich -> Scrapegoat -> Chimera -> DatabaseSaveStation).
 * - JSON: enriched-all-leads.json (in-UI aggregate path).
 * Merges both, dedupes by linkedinUrl (Postgres wins). Surfaces queue-based enrichment in the UI.
 */

let _pool: Pool | null = null;
function getPool(): Pool | null {
  if (_pool !== null) return _pool;
  const url = process.env.DATABASE_URL || process.env.APP_DATABASE_URL;
  if (!url) return null;
  _pool = new Pool({ connectionString: url });
  return _pool;
}

const isValidLead = (lead: Record<string, unknown>): boolean => {
  const name = String(lead.name || '').trim();
  const phone = String(lead.phone || '').trim().replace(/\D/g, '');
  return name.length > 0 && phone.length >= 10;
};

const hasData = (arr: Record<string, unknown>[]): boolean =>
  arr.length > 0 && arr.some((l) => (l.name && String(l.name).trim()) || (l.phone && String(l.phone).trim()) || (l.email && String(l.email).trim()));

function rowToLead(row: Record<string, unknown>): Record<string, unknown> {
  const age = row.age != null ? row.age : null;
  return {
    linkedinUrl: row.linkedin_url,
    name: row.name,
    phone: row.phone,
    email: row.email,
    city: row.city,
    state: row.state,
    zipcode: row.zipcode,
    age,
    dobOrAge: age != null ? String(age) : '',
    income: row.income,
    dncStatus: row.dnc_status ?? 'UNKNOWN',
    canContact: row.can_contact ?? false,
    confidence_age: row.confidence_age != null ? Number(row.confidence_age) : undefined,
    confidence_income: row.confidence_income != null ? Number(row.confidence_income) : undefined,
    source_metadata: typeof row.source_metadata === 'object' && row.source_metadata !== null ? row.source_metadata : undefined,
    enriched_at: row.enriched_at,
    dateScraped: row.enriched_at ? String(row.enriched_at).slice(0, 10) : undefined,
  };
}

function jsonRowToLead(row: Record<string, unknown>): Record<string, unknown> {
  const age = row.age != null ? row.age : null;
  return {
    linkedinUrl: row.linkedinUrl || row.linkedin_url,
    name: row.name,
    phone: row.phone,
    email: row.email,
    city: row.city,
    state: row.state,
    zipcode: row.zipcode,
    age,
    dobOrAge: age != null ? String(age) : '',
    income: row.income,
    dncStatus: row.dncStatus ?? row.dnc_status ?? 'UNKNOWN',
    canContact: row.canContact ?? row.can_contact ?? false,
    confidence_age: row.confidence_age != null ? Number(row.confidence_age) : undefined,
    confidence_income: row.confidence_income != null ? Number(row.confidence_income) : undefined,
    source_metadata: typeof row.source_metadata === 'object' && row.source_metadata !== null ? row.source_metadata : undefined,
    enriched_at: row.enriched_at || row.dateScraped,
    dateScraped: row.dateScraped || (row.enriched_at ? String(row.enriched_at).slice(0, 10) : undefined),
    _source: 'json',
  };
}

export async function GET(_request: NextRequest) {
  const pool = getPool();
  let postgresLeads: Record<string, unknown>[] = [];
  let jsonLeads: Record<string, unknown>[] = [];

  if (pool) {
    try {
      const { rows } = await pool.query(
        `SELECT linkedin_url, name, phone, email, city, state, zipcode, age, income,
                dnc_status, can_contact, confidence_age, confidence_income, source_metadata, enriched_at
         FROM leads
         ORDER BY enriched_at DESC NULLS LAST`
      );
      postgresLeads = (rows as Record<string, unknown>[]).map(rowToLead);
      if (!hasData(postgresLeads)) postgresLeads = [];
    } catch (e) {
      console.error('Load enriched (Postgres) error:', e);
    }
  }

  try {
    const jsonPath = getDataFilePath('enriched-all-leads.json');
    const raw = safeReadFile(jsonPath);
    if (raw) {
      const data = JSON.parse(raw);
      const arr = Array.isArray(data) ? data : data?.leads || [];
      jsonLeads = (arr as Record<string, unknown>[]).map(jsonRowToLead).filter((l) => l.linkedinUrl || l.name);
    }
  } catch (e) {
    console.warn('Load enriched (JSON) error:', e);
  }

  // Merge: dedupe by linkedinUrl, Postgres wins
  const byUrl = new Map<string, Record<string, unknown>>();
  for (const l of jsonLeads) {
    const u = String(l.linkedinUrl || l.linkedin_url || '').trim();
    if (u) byUrl.set(u, l);
  }
  for (const l of postgresLeads) {
    const u = String(l.linkedinUrl || '').trim();
    if (u) byUrl.set(u, l);
  }
  let leads = Array.from(byUrl.values()).filter(isValidLead);

  const stats = {
    total: leads.length,
    withPhone: leads.filter((l) => l.phone && String(l.phone).trim().length >= 10).length,
    withAge: leads.filter((l) => (l.dobOrAge && String(l.dobOrAge).trim()) || (l.age != null)).length,
    withState: leads.filter((l) => l.state && String(l.state).trim()).length,
    withZip: leads.filter((l) => l.zipcode && String(l.zipcode).trim()).length,
    complete: leads.filter((l) => {
      const hasPhone = l.phone && String(l.phone).trim().length >= 10;
      const hasAge = (l.dobOrAge && String(l.dobOrAge).trim()) || (l.age != null);
      const hasState = l.state && String(l.state).trim();
      const hasZip = l.zipcode && String(l.zipcode).trim();
      return !!(hasPhone && hasAge && hasState && hasZip);
    }).length,
  };

  const nPostgres = postgresLeads.length;
  const nJson = jsonLeads.length;

  return NextResponse.json({
    success: true,
    leads,
    source: 'unified',
    sources: { postgres: nPostgres, json: nJson, merged: leads.length },
    stats,
    message: pool
      ? `Unified: ${leads.length} leads (Postgres: ${nPostgres}, JSON: ${nJson}).`
      : `JSON only: ${leads.length} (DATABASE_URL not set).`,
  });
}
