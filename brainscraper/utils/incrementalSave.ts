/**
 * Incremental Save Utilities
 * Saves enriched leads immediately as they're processed to prevent data loss
 * 
 * CRITICAL: Always merges with existing data, never overwrites
 * See .cursor/rules/data-protection.mdc
 */
import * as fs from 'fs';
import * as path from 'path';
import { getDataDirectory, getDataFilePath, ensureDataDirectory, safeWriteFile, safeReadFile } from './dataDirectory';
import { withLock } from './fileLock';
import type { EnrichedRow } from './enrichData';
import type { LeadSummary } from './extractLeadSummary';

/**
 * Save an enriched lead immediately to disk
 * This is called after each successful enrichment to prevent data loss
 * 
 * @param enrichedRow - The full enriched row data
 * @param leadSummary - The lead summary for the all-leads file
 */
export function saveEnrichedLeadImmediate(
  enrichedRow: EnrichedRow,
  leadSummary: LeadSummary
): void {
  try {
    ensureDataDirectory();
    
    // Save individual lead file
    const leadId = generateLeadId(leadSummary);
    const leadFilePath = getDataFilePath(`enriched-leads/${leadId}.json`);
    
    // Ensure directory exists
    const leadsDir = path.dirname(leadFilePath);
    if (!fs.existsSync(leadsDir)) {
      fs.mkdirSync(leadsDir, { recursive: true });
    }
    
    safeWriteFile(leadFilePath, JSON.stringify({
      enrichedRow,
      leadSummary,
      savedAt: new Date().toISOString(),
    }, null, 2));
    
    console.log(`✅ [INCREMENTAL_SAVE] Saved lead: ${leadSummary.name || leadId}`);
  } catch (error) {
    console.error('❌ [INCREMENTAL_SAVE] Failed to save lead:', error);
    // Don't throw - we don't want to break the enrichment flow
  }
}

/**
 * Generate a unique ID for a lead based on its data
 */
function generateLeadId(lead: LeadSummary): string {
  // Use LinkedIn URL if available
  if (lead.linkedinUrl) {
    const match = lead.linkedinUrl.match(/\/in\/([^\/\?]+)/);
    if (match) {
      return `linkedin_${match[1]}`;
    }
  }
  
  // Fall back to name + phone/email hash
  const identifier = `${lead.name || 'unknown'}_${lead.phone || lead.email || Date.now()}`;
  return identifier.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
}

/**
 * Load all enriched leads from disk
 * Combines data from individual files and the main all-leads file
 * 
 * @returns Array of lead summaries
 */
export function loadAllEnrichedLeads(): LeadSummary[] {
  try {
    ensureDataDirectory();
    
    const allLeads: LeadSummary[] = [];
    const seenKeys = new Set<string>();
    
    // Load from main file first
    const mainFilePath = getDataFilePath('enriched-all-leads.json');
    const mainContent = safeReadFile(mainFilePath);
    
    if (mainContent) {
      try {
        const data = JSON.parse(mainContent);
        const leads = Array.isArray(data) ? data : (data.leads || []);
        
        for (const lead of leads) {
          const key = getLeadKey(lead);
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            allLeads.push(lead);
          }
        }
      } catch (error) {
        console.warn('⚠️ [INCREMENTAL_SAVE] Error parsing main leads file:', error);
      }
    }
    
    // Load from individual lead files
    const leadsDir = getDataFilePath('enriched-leads');
    if (fs.existsSync(leadsDir)) {
      const files = fs.readdirSync(leadsDir).filter(f => f.endsWith('.json'));
      
      for (const file of files) {
        try {
          const filePath = path.join(leadsDir, file);
          const content = safeReadFile(filePath);
          
          if (content) {
            const data = JSON.parse(content);
            const lead = data.leadSummary || data;
            const key = getLeadKey(lead);
            
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              allLeads.push(lead);
            }
          }
        } catch (error) {
          console.warn(`⚠️ [INCREMENTAL_SAVE] Error loading ${file}:`, error);
        }
      }
    }
    
    console.log(`✅ [INCREMENTAL_SAVE] Loaded ${allLeads.length} leads`);
    return allLeads;
  } catch (error) {
    console.error('❌ [INCREMENTAL_SAVE] Failed to load leads:', error);
    return [];
  }
}

/**
 * Generate a deduplication key for a lead
 */
function getLeadKey(lead: LeadSummary): string {
  if (lead.linkedinUrl) {
    return `linkedin:${lead.linkedinUrl}`;
  }
  
  const name = (lead.name || '').trim().toLowerCase();
  const phone = (lead.phone || '').replace(/\D/g, '');
  const email = (lead.email || '').trim().toLowerCase();
  
  if (name && (phone || email)) {
    return `contact:${name}:${phone || email}`;
  }
  
  return `unknown:${Date.now()}`;
}

/**
 * Merge new leads with existing leads file
 * Uses proper deduplication and data preservation
 * 
 * @param newLeads - New leads to merge
 * @returns Total count after merge
 */
export async function mergeEnrichedLeads(newLeads: LeadSummary[]): Promise<number> {
  const mainFilePath = getDataFilePath('enriched-all-leads.json');
  
  return await withLock(mainFilePath, async () => {
    const existingLeads = loadAllEnrichedLeads();
    const seenKeys = new Set<string>();
    const mergedLeads: LeadSummary[] = [];
    
    // Add existing leads first
    for (const lead of existingLeads) {
      const key = getLeadKey(lead);
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        mergedLeads.push(lead);
      }
    }
    
    // Add new leads (skip duplicates)
    let newCount = 0;
    for (const lead of newLeads) {
      const key = getLeadKey(lead);
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        mergedLeads.push(lead);
        newCount++;
      }
    }
    
    // Save merged result
    ensureDataDirectory();
    safeWriteFile(mainFilePath, JSON.stringify(mergedLeads, null, 2));
    
    console.log(`✅ [INCREMENTAL_SAVE] Merged ${newCount} new leads (total: ${mergedLeads.length})`);
    return mergedLeads.length;
  });
}

/**
 * Get count of saved leads without loading all data
 */
export function getEnrichedLeadCount(): number {
  try {
    ensureDataDirectory();
    let count = 0;
    
    // Count from main file
    const mainFilePath = getDataFilePath('enriched-all-leads.json');
    const mainContent = safeReadFile(mainFilePath);
    
    if (mainContent) {
      try {
        const data = JSON.parse(mainContent);
        const leads = Array.isArray(data) ? data : (data.leads || []);
        count = leads.length;
      } catch {
        // Ignore parse errors
      }
    }
    
    // Add individual files if main count is 0
    if (count === 0) {
      const leadsDir = getDataFilePath('enriched-leads');
      if (fs.existsSync(leadsDir)) {
        const files = fs.readdirSync(leadsDir).filter(f => f.endsWith('.json'));
        count = files.length;
      }
    }
    
    return count;
  } catch {
    return 0;
  }
}
