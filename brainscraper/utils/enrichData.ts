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

export async function enrichData(
  data: { headers: string[]; rows: Record<string, any>[] },
  onProgress?: (progress: EnrichmentProgress) => void
): Promise<EnrichedData> {
  const enrichedRows: EnrichedRow[] = [];
  let enrichedCount = 0;
  
  for (let i = 0; i < data.rows.length; i++) {
    const row = data.rows[i];
    const enrichedRow: EnrichedRow = { ...row };
    
    // Simulate enrichment (in production, this would call enrichment APIs)
    if (onProgress) {
      onProgress({
        current: i + 1,
        total: data.rows.length,
        percentage: Math.round(((i + 1) / data.rows.length) * 100),
        status: 'enriching',
        message: `Enriching lead ${i + 1} of ${data.rows.length}`,
      });
    }
    
    // Mark as enriched
    enrichedRow.enriched = true;
    enrichedCount++;
    enrichedRows.push(enrichedRow);
  }
  
  if (onProgress) {
    onProgress({
      current: data.rows.length,
      total: data.rows.length,
      percentage: 100,
      status: 'complete',
      message: 'Enrichment complete',
    });
  }
  
  return {
    headers: data.headers,
    rows: enrichedRows,
    totalRows: enrichedRows.length,
    enrichedCount,
    fileName: 'enriched-data',
  };
}