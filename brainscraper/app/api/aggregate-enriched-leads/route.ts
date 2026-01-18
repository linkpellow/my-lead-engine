import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getDataFilePath, safeReadFile, safeWriteFile, ensureDataDirectory } from '@/utils/dataDirectory';
import { withLock } from '@/utils/fileLock';
import type { LeadSummary } from '@/utils/extractLeadSummary';

let _pool: Pool | null = null;
function getPool(): Pool | null {
  if (_pool !== null) return _pool;
  const url = process.env.DATABASE_URL || process.env.APP_DATABASE_URL;
  if (!url) return null;
  _pool = new Pool({ connectionString: url });
  return _pool;
}

/** Upsert one lead to Postgres so queue-based and JSON-based paths both surface in unified load. */
async function upsertLeadToPostgres(lead: LeadSummary): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  const linkedinUrl = (lead as any).linkedinUrl || (lead as any).linkedin_url;
  if (!linkedinUrl) return;
  const name = (lead.name || '').trim() || 'Unknown';
  const phone = lead.phone ?? null;
  const email = lead.email ?? null;
  const city = lead.city ?? null;
  const state = lead.state ?? null;
  const zipcode = lead.zipcode ?? null;
  const age = lead.age != null ? Number(lead.age) : null;
  const income = lead.income ?? null;
  const dncStatus = lead.dncStatus ?? 'UNKNOWN';
  const canContact = !!lead.canContact;
  try {
    await pool.query(
      `INSERT INTO leads (linkedin_url, name, phone, email, city, state, zipcode, age, income, dnc_status, can_contact, confidence_age, confidence_income, source_metadata, enriched_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1.0, 1.0, '{"sources":{"aggregate":"json"}}'::jsonb, NOW())
       ON CONFLICT (linkedin_url) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, leads.name),
         phone = COALESCE(EXCLUDED.phone, leads.phone),
         email = COALESCE(EXCLUDED.email, leads.email),
         city = COALESCE(EXCLUDED.city, leads.city),
         state = COALESCE(EXCLUDED.state, leads.state),
         zipcode = COALESCE(EXCLUDED.zipcode, leads.zipcode),
         age = COALESCE(EXCLUDED.age, leads.age),
         income = COALESCE(EXCLUDED.income, leads.income),
         dnc_status = COALESCE(EXCLUDED.dnc_status, leads.dnc_status),
         can_contact = COALESCE(EXCLUDED.can_contact, leads.can_contact),
         enriched_at = NOW()`,
      [linkedinUrl, name, phone, email, city, state, zipcode, age, income, dncStatus, canContact]
    );
  } catch (e) {
    console.warn('[AGGREGATE] Postgres upsert failed:', e);
  }
}

/**
 * API endpoint to aggregate enriched leads: enriched-all-leads.json + Postgres.
 * Merges new leads with existing, deduplicates. Also upserts new leads to Postgres so
 * load-enriched-results (unified) surfaces both pipelines.
 */
export async function POST(request: NextRequest) {
  try {
    ensureDataDirectory();
    
    const body = await request.json();
    const { newLeads } = body as { newLeads: LeadSummary[] };
    
    if (!Array.isArray(newLeads)) {
      return NextResponse.json(
        { success: false, error: 'newLeads must be an array' },
        { status: 400 }
      );
    }
    
    const existingPath = getDataFilePath('enriched-all-leads.json');
    
    // Load and save with file locking to prevent race conditions
    let existingLeads: LeadSummary[] = [];
    let aggregatedLeads: LeadSummary[] = [];
    let validNewLeads: LeadSummary[] = [];
    
    await withLock(existingPath, async () => {
      // Load existing leads from enriched-all-leads.json
      const existingContent = safeReadFile(existingPath);
      if (existingContent) {
        try {
          const existingData = JSON.parse(existingContent);
          // Handle both array format and metadata wrapper format for backward compatibility
          existingLeads = Array.isArray(existingData) ? existingData : (existingData.leads || []);
          
          // Validate data structure
          if (!Array.isArray(existingLeads)) {
            console.warn('⚠️ [AGGREGATE] Existing data is not an array, resetting to empty array');
            existingLeads = [];
          }
        } catch (error) {
          console.error('❌ [AGGREGATE] Error parsing existing enriched-all-leads.json:', error);
          // Continue with empty array
          existingLeads = [];
        }
      }
    
      // Validation function for NEW leads: must have name AND phone AND age <= 59
      // NOTE: This filter ONLY applies to NEW leads, NOT existing leads (existing leads are preserved)
      const isValidNewLead = (lead: LeadSummary): boolean => {
        const name = (lead.name || '').trim();
        const phone = (lead.phone || '').trim().replace(/\D/g, ''); // Remove non-digits for validation
        
        // Require phone number (10+ digits) - leads with only email are excluded
        if (name.length === 0 || phone.length < 10) {
          return false;
        }
        
        // Age filter: exclude NEW leads with age > 59 (if age is known)
        // CRITICAL: This filter does NOT apply to existing leads - they are preserved
        const dobOrAge = lead.dobOrAge || '';
        if (dobOrAge) {
          let ageNum: number | null = null;
          
          // Try to parse age from dobOrAge
          const parsed = parseInt(String(dobOrAge).trim(), 10);
          if (!isNaN(parsed) && parsed > 0 && parsed < 150) {
            ageNum = parsed;
          } else {
            // Try to calculate from DOB
            try {
              const dob = new Date(dobOrAge);
              if (!isNaN(dob.getTime())) {
                const today = new Date();
                let calculatedAge = today.getFullYear() - dob.getFullYear();
                const monthDiff = today.getMonth() - dob.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
                  calculatedAge--;
                }
                if (calculatedAge > 0 && calculatedAge < 150) {
                  ageNum = calculatedAge;
                }
              }
            } catch {
              // Couldn't parse as date, allow lead (age unknown)
            }
          }
          
          // Filter out NEW leads if age > 59 (allow if age unknown)
          if (ageNum !== null && ageNum > 59) {
            return false;
          }
        }
        
        return true;
      };
      
      // Validation function for EXISTING leads: only require name and phone (NO age filter)
      // CRITICAL: Existing leads are preserved regardless of age - we don't want to lose data
      const isValidExistingLead = (lead: LeadSummary): boolean => {
        const name = (lead.name || '').trim();
        const phone = (lead.phone || '').trim().replace(/\D/g, '');
        // Require phone number (10+ digits) - leads with only email are excluded
        // NO age filter for existing leads - preserve all existing data
        return name.length > 0 && phone.length >= 10;
      };
      
      // Filter existing leads to only valid ones (NO age filter - preserve existing data)
      existingLeads = existingLeads.filter(isValidExistingLead);
      
      // Create a deduplication map using LinkedIn URL or name+email+phone as key
      const seenKeys = new Set<string>();
      aggregatedLeads = [];
      
      // Helper to generate deduplication key
      const getLeadKey = (lead: LeadSummary): string => {
        if (lead.linkedinUrl) {
          return `linkedin:${lead.linkedinUrl}`;
        }
        const name = (lead.name || '').trim();
        const email = (lead.email || '').trim();
        const phone = (lead.phone || '').trim();
        if (name && (email || phone)) {
          return `name:${name}:${email || phone}`;
        }
        return `name:${name || 'unknown'}`;
      };
      
      // Add existing leads first
      for (const lead of existingLeads) {
        const key = getLeadKey(lead);
        if (!seenKeys.has(key) && key !== 'name:unknown') {
          seenKeys.add(key);
          aggregatedLeads.push(lead);
        }
      }
      
      // Filter new leads before processing (WITH age filter - only new leads are filtered)
      validNewLeads = newLeads.filter(isValidNewLead);
      
      // Helper function to merge leads intelligently, preserving DNC status
      const mergeLeads = (existing: LeadSummary, incoming: LeadSummary): LeadSummary => {
        // Start with existing lead as base
        const merged = { ...existing };
        
        // Preserve DNC-related fields from existing lead if they're valid
        // Only overwrite if incoming lead has valid DNC data
        const existingHasValidDNC = existing.dncStatus && 
                                    existing.dncStatus !== 'UNKNOWN' && 
                                    existing.dncLastChecked;
        const incomingHasValidDNC = incoming.dncStatus && 
                                    incoming.dncStatus !== 'UNKNOWN' && 
                                    incoming.dncLastChecked;
        
        if (existingHasValidDNC && !incomingHasValidDNC) {
          // Preserve existing DNC data
          merged.dncStatus = existing.dncStatus;
          merged.dncReason = existing.dncReason;
          merged.canContact = existing.canContact;
          merged.dncLastChecked = existing.dncLastChecked;
        } else if (incomingHasValidDNC) {
          // Use incoming DNC data (newer or more complete)
          merged.dncStatus = incoming.dncStatus;
          merged.dncReason = incoming.dncReason;
          merged.canContact = incoming.canContact;
          merged.dncLastChecked = incoming.dncLastChecked;
        }
        
        // For all other fields, prefer incoming lead data (newer data wins)
        // But don't overwrite with empty/undefined values
        Object.keys(incoming).forEach(key => {
          const value = incoming[key as keyof LeadSummary];
          // Only update if value is not empty/undefined
          if (value !== undefined && value !== null && value !== '') {
            // Skip DNC fields if we already handled them above
            if (key !== 'dncStatus' && key !== 'dncReason' && key !== 'canContact' && key !== 'dncLastChecked') {
              (merged as any)[key] = value;
            }
          }
        });
        
        return merged;
      };
      
      // Add new leads (will merge with duplicates, preserving DNC status)
      for (const lead of validNewLeads) {
        const key = getLeadKey(lead);
        if (key === 'name:unknown') continue; // Skip invalid leads
        
        const existingIndex = aggregatedLeads.findIndex(l => getLeadKey(l) === key);
        if (existingIndex >= 0) {
          // Merge existing lead with new data, preserving DNC status
          aggregatedLeads[existingIndex] = mergeLeads(aggregatedLeads[existingIndex], lead);
        } else {
          // Add new lead
          aggregatedLeads.push(lead);
          seenKeys.add(key);
        }
      }
      
      // Save aggregated leads with consistent data structure: array of leads
      safeWriteFile(existingPath, JSON.stringify(aggregatedLeads, null, 2));
    });

    // Unify: also upsert new leads to Postgres so load-enriched-results (unified) surfaces both pipelines
    for (const lead of validNewLeads) {
      await upsertLeadToPostgres(lead);
    }
    
    console.log(`✅ [AGGREGATE] Saved ${aggregatedLeads.length} to JSON + Postgres (${validNewLeads.length} new, ${newLeads.length - validNewLeads.length} invalid filtered)`);
    
    return NextResponse.json({
      success: true,
      totalLeads: aggregatedLeads.length,
      newLeadsAdded: validNewLeads.length,
      message: `Successfully aggregated ${aggregatedLeads.length} leads`,
    });
  } catch (error) {
    console.error('Error aggregating enriched leads:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
