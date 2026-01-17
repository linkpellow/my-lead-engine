import { NextRequest, NextResponse } from 'next/server';
import { extractDomain } from '@/app/dojo/types';
import { extractLeadFields, likelyContainsLeadData, type ExtractedField, type ExtractionResult } from '@/utils/leadFieldExtractor';
import { validateAndFilterFields, crossValidateFields } from '@/utils/fieldValidator';

/**
 * The Dojo - Traffic Ingestion API
 * 
 * Receives captured network requests from external mitmproxy relay.
 * Stores last 200 requests in memory for real-time display.
 * Auto-extracts lead fields (phone, email, address, etc.) from responses.
 */

// In-memory storage for captured requests
// In production, consider Redis for persistence across restarts
interface StoredRequest {
  id: string;
  url: string;
  domain: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
  status: number;
  duration: number;
  timestamp: number;
  type: 'xhr' | 'fetch' | 'document' | 'other';
  summary?: string;
  headers?: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
  responseSize?: number;
  extractedFields?: ExtractedField[];  // NEW: Auto-extracted lead fields
}

// Global in-memory store (survives across requests, resets on deploy)
const MAX_STORED_REQUESTS = 200;
let capturedRequests: StoredRequest[] = [];
let lastIngestTime = 0;
let totalIngested = 0;

// NEW: Global store for extracted fields (aggregated across all requests)
interface ExtractedFieldSummary {
  fieldType: string;
  fieldName: string;
  sampleValues: string[];
  count: number;
  lastSeenAt: number;
  sources: string[];  // URLs where this field was found
}

const extractedFieldsStore: Map<string, ExtractedFieldSummary> = new Map();
let totalFieldsExtracted = 0;

// Payload from mitmproxy relay
interface IngestPayload {
  url: string;
  method: string;
  status: number;
  duration?: number;
  timestamp?: number;
  headers?: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
  responseSize?: number;
  contentType?: string;
}

// Determine request type from content-type and URL
function getRequestType(url: string, contentType?: string): StoredRequest['type'] {
  if (contentType?.includes('text/html')) return 'document';
  if (url.includes('/api/') || url.includes('/graphql')) return 'fetch';
  if (contentType?.includes('application/json')) return 'xhr';
  return 'other';
}

// Generate a simple AI-like summary based on URL patterns
function generateSummary(url: string, method: string, status: number): string | undefined {
  const path = new URL(url).pathname.toLowerCase();
  
  // Common patterns
  if (path.includes('profile')) return 'Profile data endpoint';
  if (path.includes('search')) return 'Search results query';
  if (path.includes('graphql')) return 'GraphQL query';
  if (path.includes('login') || path.includes('auth')) return 'Authentication endpoint';
  if (path.includes('message') || path.includes('inbox')) return 'Messaging endpoint';
  if (path.includes('connect')) return 'Connection/friend request';
  if (path.includes('feed') || path.includes('timeline')) return 'Feed/timeline data';
  if (path.includes('notification')) return 'Notifications endpoint';
  
  // Status-based summaries
  if (status === 401 || status === 403) return 'Blocked - requires authentication';
  if (status === 429) return 'Rate limited - too many requests';
  if (status >= 500) return 'Server error';
  
  return undefined;
}

/**
 * POST /api/dojo/ingest
 * Accepts traffic from mitmproxy relay
 */
export async function POST(request: NextRequest) {
  try {
    const payload: IngestPayload = await request.json();
    
    // Validate required fields
    if (!payload.url || !payload.method) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: url, method' },
        { status: 400 }
      );
    }

    // Normalize method
    const method = payload.method.toUpperCase() as StoredRequest['method'];
    if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(method)) {
      return NextResponse.json(
        { success: false, error: `Invalid method: ${payload.method}` },
        { status: 400 }
      );
    }

    const domain = extractDomain(payload.url);
    
    // Extract and VALIDATE lead fields from response body
    let extractedFields: ExtractedField[] | undefined;
    let validationStats = { total: 0, valid: 0, suspect: 0 };
    
    if (payload.responseBody && likelyContainsLeadData(payload.responseBody)) {
      try {
        const extraction = extractLeadFields(payload.responseBody, payload.url, domain);
        
        if (extraction.fields.length > 0) {
          // VALIDATE extracted fields to prevent false positives
          const { validFields, suspectFields, validationResults } = validateAndFilterFields(extraction.fields);
          
          // Cross-validate for consistency
          const crossValidation = crossValidateFields(validFields);
          
          // Only use validated fields
          extractedFields = validFields.map(field => ({
            ...field,
            validated: true,
            qualityScore: validationResults.get(`${field.fieldType}:${field.jsonPath}`)?.qualityScore || 'medium',
          }));
          
          validationStats = {
            total: extraction.fields.length,
            valid: validFields.length,
            suspect: suspectFields.length,
          };
          
          // Log validation results for debugging
          if (suspectFields.length > 0) {
            console.log(`[Dojo Ingest] Filtered ${suspectFields.length} suspect fields from ${payload.url}`);
          }
          
          // Update global extracted fields store (only with validated fields)
          for (const field of extractedFields) {
            const key = `${field.fieldType}:${field.fieldName}`;
            const existing = extractedFieldsStore.get(key);
            
            if (existing) {
              existing.count++;
              existing.lastSeenAt = Date.now();
              if (!existing.sampleValues.includes(field.value)) {
                existing.sampleValues = [field.value, ...existing.sampleValues].slice(0, 5);
              }
              if (!existing.sources.includes(payload.url)) {
                existing.sources = [payload.url, ...existing.sources].slice(0, 3);
              }
            } else {
              extractedFieldsStore.set(key, {
                fieldType: field.fieldType,
                fieldName: field.fieldName,
                sampleValues: [field.value],
                count: 1,
                lastSeenAt: Date.now(),
                sources: [payload.url],
              });
            }
            totalFieldsExtracted++;
          }
        }
      } catch (e) {
        console.error('[Dojo Ingest] Field extraction error:', e);
      }
    }
    
    // Build stored request
    const storedRequest: StoredRequest = {
      id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      url: payload.url,
      domain,
      method,
      status: payload.status || 0,
      duration: payload.duration || 0,
      timestamp: payload.timestamp || Date.now(),
      type: getRequestType(payload.url, payload.contentType),
      summary: generateSummary(payload.url, method, payload.status || 0),
      headers: payload.headers,
      requestBody: payload.requestBody,
      responseBody: payload.responseBody,
      responseSize: payload.responseSize,
      extractedFields,  // NEW: Include extracted fields
    };

    // Add to front of array (newest first)
    capturedRequests.unshift(storedRequest);
    
    // Trim to max size
    if (capturedRequests.length > MAX_STORED_REQUESTS) {
      capturedRequests = capturedRequests.slice(0, MAX_STORED_REQUESTS);
    }

    lastIngestTime = Date.now();
    totalIngested++;

    return NextResponse.json({
      success: true,
      id: storedRequest.id,
      count: capturedRequests.length,
      total: totalIngested,
      fieldsExtracted: extractedFields?.length || 0,  // NEW: Report extracted fields count
    });
  } catch (error) {
    console.error('[Dojo Ingest] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to parse request body' },
      { status: 400 }
    );
  }
}

/**
 * GET /api/dojo/ingest
 * Returns stored requests for UI polling
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const since = searchParams.get('since');
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const domain = searchParams.get('domain');
  
  let results = capturedRequests;
  
  // Filter by timestamp if 'since' provided (for incremental updates)
  if (since) {
    const sinceTime = parseInt(since, 10);
    results = results.filter(r => r.timestamp > sinceTime);
  }
  
  // Filter by domain if specified
  if (domain) {
    results = results.filter(r => r.domain === domain);
  }
  
  // Limit results
  results = results.slice(0, limit);

  // NEW: Include extracted fields summary
  const extractedFieldsSummary = Array.from(extractedFieldsStore.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);  // Top 50 fields
  
  return NextResponse.json({
    success: true,
    requests: results,
    count: results.length,
    total: totalIngested,
    lastIngestTime,
    isLive: Date.now() - lastIngestTime < 10000, // Consider "live" if data in last 10s
    // NEW: Extracted fields data
    extractedFields: {
      summary: extractedFieldsSummary,
      totalFields: totalFieldsExtracted,
      uniqueFields: extractedFieldsStore.size,
    },
  });
}

/**
 * DELETE /api/dojo/ingest
 * Clears stored requests (for testing/reset)
 */
export async function DELETE() {
  const previousCount = capturedRequests.length;
  const previousFields = extractedFieldsStore.size;
  
  capturedRequests = [];
  totalIngested = 0;
  lastIngestTime = 0;
  extractedFieldsStore.clear();  // NEW: Clear extracted fields
  totalFieldsExtracted = 0;
  
  return NextResponse.json({
    success: true,
    cleared: previousCount,
    clearedFields: previousFields,
  });
}
