/**
 * Smart Request Classifier
 * 
 * Automatically categorizes, labels, and deduplicates captured HTTP requests.
 * Separates signal from noise so users see what matters.
 */

export type RequestCategory = 
  | 'data'      // API endpoints that return structured data
  | 'auth'      // Authentication, tokens, sessions
  | 'search'    // Search/lookup endpoints
  | 'media'     // Images, videos, fonts, CSS, JS
  | 'tracking'  // Analytics, pixels, telemetry
  | 'ads'       // Advertising networks
  | 'system'    // SDK, health checks, infrastructure
  | 'unknown';

export interface ClassifiedRequest {
  id: string;
  url: string;
  domain: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  status: number;
  
  // Classification
  category: RequestCategory;
  label: string;           // Human-readable: "Person Search API"
  icon: string;            // Emoji: "👤"
  isNoise: boolean;        // Should be hidden by default
  isGolden: boolean;       // Likely contains target data
  
  // Grouping
  patternKey: string;      // For deduplication: "fastpeoplesearch.com:GET:/api/person/{id}"
  
  // Original data
  timestamp: number;
  duration: number;
  responseSize?: number;
  contentType?: string;
  hasJsonResponse: boolean;
  extractedFieldCount: number;
}

export interface GroupedRequests {
  patternKey: string;
  label: string;
  icon: string;
  category: RequestCategory;
  domain: string;
  method: string;
  pathPattern: string;
  count: number;
  isNoise: boolean;
  isGolden: boolean;
  hasData: boolean;
  requests: ClassifiedRequest[];
  avgDuration: number;
  lastSeen: number;
}

export interface DomainSummary {
  domain: string;
  favicon: string;
  isTargetSite: boolean;
  totalRequests: number;
  dataEndpoints: number;
  goldenRoutes: number;
  categories: Record<RequestCategory, number>;
  groups: GroupedRequests[];
}

// ============================================================
// CLASSIFICATION RULES
// ============================================================

// Noise domains (always hide)
const NOISE_DOMAINS = new Set([
  'google-analytics.com',
  'googletagmanager.com',
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'facebook.com',
  'facebook.net',
  'fbcdn.net',
  'twitter.com',
  'linkedin.com', // Unless it's the target
  'hotjar.com',
  'mixpanel.com',
  'segment.com',
  'amplitude.com',
  'sentry.io',
  'newrelic.com',
  'datadog.com',
]);

// Noise path patterns
const NOISE_PATTERNS: Array<{ pattern: RegExp; category: RequestCategory; label: string }> = [
  // Tracking
  { pattern: /\/csi\?/i, category: 'tracking', label: 'Client-Side Instrumentation' },
  { pattern: /\/collect\?/i, category: 'tracking', label: 'Analytics Collection' },
  { pattern: /\/pixel/i, category: 'tracking', label: 'Tracking Pixel' },
  { pattern: /\/beacon/i, category: 'tracking', label: 'Beacon' },
  { pattern: /\/log\?/i, category: 'tracking', label: 'Event Logging' },
  { pattern: /\/analytics/i, category: 'tracking', label: 'Analytics' },
  { pattern: /\/telemetry/i, category: 'tracking', label: 'Telemetry' },
  { pattern: /\/_ga/i, category: 'tracking', label: 'Google Analytics' },
  
  // Ads
  { pattern: /\/pagead\//i, category: 'ads', label: 'Google Ads' },
  { pattern: /\/ads\//i, category: 'ads', label: 'Advertising' },
  { pattern: /\/adserver/i, category: 'ads', label: 'Ad Server' },
  { pattern: /\/doubleclick/i, category: 'ads', label: 'DoubleClick' },
  
  // Auth
  { pattern: /\/oauth/i, category: 'auth', label: 'OAuth' },
  { pattern: /\/token/i, category: 'auth', label: 'Token' },
  { pattern: /\/auth/i, category: 'auth', label: 'Authentication' },
  { pattern: /\/login/i, category: 'auth', label: 'Login' },
  { pattern: /\/session/i, category: 'auth', label: 'Session' },
  { pattern: /\/issuetoken/i, category: 'auth', label: 'Issue Token' },
  
  // System
  { pattern: /\/health/i, category: 'system', label: 'Health Check' },
  { pattern: /\/ping/i, category: 'system', label: 'Ping' },
  { pattern: /\/status/i, category: 'system', label: 'Status' },
  { pattern: /\/config/i, category: 'system', label: 'Configuration' },
  { pattern: /\/omsdk/i, category: 'system', label: 'SDK' },
  { pattern: /\/sdk/i, category: 'system', label: 'SDK' },
  
  // Media
  { pattern: /\.(jpg|jpeg|png|gif|webp|svg|ico)/i, category: 'media', label: 'Image' },
  { pattern: /\.(css|scss)/i, category: 'media', label: 'Stylesheet' },
  { pattern: /\.(js|mjs)/i, category: 'media', label: 'JavaScript' },
  { pattern: /\.(woff|woff2|ttf|eot)/i, category: 'media', label: 'Font' },
  { pattern: /\.(mp4|webm|mp3|wav)/i, category: 'media', label: 'Media' },
  { pattern: /googleusercontent\.com/i, category: 'media', label: 'Google CDN' },
];

// Data endpoint patterns (likely to contain useful data)
const DATA_PATTERNS: Array<{ pattern: RegExp; label: string; icon: string }> = [
  { pattern: /\/api\/.*search/i, label: 'Search API', icon: '🔍' },
  { pattern: /\/api\/.*person/i, label: 'Person API', icon: '👤' },
  { pattern: /\/api\/.*profile/i, label: 'Profile API', icon: '👤' },
  { pattern: /\/api\/.*user/i, label: 'User API', icon: '👤' },
  { pattern: /\/api\/.*address/i, label: 'Address API', icon: '📍' },
  { pattern: /\/api\/.*phone/i, label: 'Phone API', icon: '📞' },
  { pattern: /\/api\/.*email/i, label: 'Email API', icon: '✉️' },
  { pattern: /\/api\/.*contact/i, label: 'Contact API', icon: '📇' },
  { pattern: /\/api\/.*lookup/i, label: 'Lookup API', icon: '🔍' },
  { pattern: /\/search/i, label: 'Search', icon: '🔍' },
  { pattern: /\/lookup/i, label: 'Lookup', icon: '🔍' },
  { pattern: /\/find/i, label: 'Find', icon: '🔍' },
  { pattern: /\/people/i, label: 'People', icon: '👥' },
  { pattern: /\/person/i, label: 'Person', icon: '👤' },
  { pattern: /\/profile/i, label: 'Profile', icon: '👤' },
  { pattern: /\/details/i, label: 'Details', icon: '📋' },
  { pattern: /\/records/i, label: 'Records', icon: '📋' },
  { pattern: /\/results/i, label: 'Results', icon: '📋' },
  { pattern: /\/data/i, label: 'Data', icon: '📊' },
  { pattern: /graphql/i, label: 'GraphQL', icon: '⚡' },
];

// Category icons
const CATEGORY_ICONS: Record<RequestCategory, string> = {
  data: '🎯',
  search: '🔍',
  auth: '🔐',
  media: '🖼️',
  tracking: '📊',
  ads: '📢',
  system: '⚙️',
  unknown: '❓',
};

// ============================================================
// CLASSIFICATION FUNCTIONS
// ============================================================

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}

/**
 * Generate a pattern key for grouping similar requests
 */
function generatePatternKey(url: string, method: string): string {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.replace('www.', '');
    
    // Normalize path by replacing IDs with placeholders
    let path = parsed.pathname
      .replace(/\/[a-f0-9-]{20,}/gi, '/{id}')  // UUIDs
      .replace(/\/\d+/g, '/{id}')               // Numeric IDs
      .replace(/=[a-zA-Z0-9_-]{20,}/g, '={token}')  // Long tokens in query
      .replace(/\?.*$/, '');                    // Remove query string for grouping
    
    return `${domain}:${method}:${path}`;
  } catch {
    return `unknown:${method}:${url}`;
  }
}

/**
 * Classify a single request
 */
export function classifyRequest(request: {
  id: string;
  url: string;
  method: string;
  status: number;
  timestamp: number;
  duration: number;
  responseSize?: number;
  contentType?: string;
  responseBody?: string;
  extractedFields?: Array<{ fieldType: string }>;
}): ClassifiedRequest {
  const domain = extractDomain(request.url);
  const patternKey = generatePatternKey(request.url, request.method);
  const path = new URL(request.url).pathname;
  
  // Check content type for JSON
  const hasJsonResponse = 
    request.contentType?.includes('application/json') ||
    request.responseBody?.trim().startsWith('{') ||
    request.responseBody?.trim().startsWith('[') ||
    false;
  
  const extractedFieldCount = request.extractedFields?.length || 0;
  
  // Determine category
  let category: RequestCategory = 'unknown';
  let label = path.split('/').filter(Boolean).pop() || 'Request';
  let icon = CATEGORY_ICONS.unknown;
  let isNoise = false;
  let isGolden = false;
  
  // Check if it's a known noise domain
  if (NOISE_DOMAINS.has(domain)) {
    category = 'tracking';
    label = `${domain} (tracking)`;
    icon = CATEGORY_ICONS.tracking;
    isNoise = true;
  }
  
  // Check noise patterns
  for (const rule of NOISE_PATTERNS) {
    if (rule.pattern.test(request.url)) {
      category = rule.category;
      label = rule.label;
      icon = CATEGORY_ICONS[category];
      isNoise = ['tracking', 'ads', 'media', 'system'].includes(category);
      break;
    }
  }
  
  // Check data patterns (overrides noise if matches)
  if (!isNoise || category === 'unknown') {
    for (const rule of DATA_PATTERNS) {
      if (rule.pattern.test(request.url)) {
        category = 'data';
        label = rule.label;
        icon = rule.icon;
        isNoise = false;
        break;
      }
    }
  }
  
  // If has JSON response with extracted fields, it's likely data
  if (hasJsonResponse && extractedFieldCount > 0) {
    category = 'data';
    isNoise = false;
    isGolden = extractedFieldCount >= 3; // 3+ fields = golden
    icon = isGolden ? '⭐' : '🎯';
    label = isGolden ? `${label} (${extractedFieldCount} fields)` : label;
  }
  
  // Auth is not noise
  if (category === 'auth') {
    isNoise = false;
  }
  
  return {
    id: request.id,
    url: request.url,
    domain,
    method: request.method as ClassifiedRequest['method'],
    status: request.status,
    category,
    label,
    icon,
    isNoise,
    isGolden,
    patternKey,
    timestamp: request.timestamp,
    duration: request.duration,
    responseSize: request.responseSize,
    contentType: request.contentType,
    hasJsonResponse,
    extractedFieldCount,
  };
}

/**
 * Group classified requests by pattern
 */
export function groupRequests(requests: ClassifiedRequest[]): GroupedRequests[] {
  const groups = new Map<string, GroupedRequests>();
  
  for (const req of requests) {
    const existing = groups.get(req.patternKey);
    
    if (existing) {
      existing.requests.push(req);
      existing.count++;
      existing.avgDuration = (existing.avgDuration * (existing.count - 1) + req.duration) / existing.count;
      existing.lastSeen = Math.max(existing.lastSeen, req.timestamp);
      existing.isGolden = existing.isGolden || req.isGolden;
      existing.hasData = existing.hasData || req.hasJsonResponse;
    } else {
      // Extract path pattern
      let pathPattern = '/';
      try {
        pathPattern = new URL(req.url).pathname
          .replace(/\/[a-f0-9-]{20,}/gi, '/{id}')
          .replace(/\/\d+/g, '/{id}');
      } catch {}
      
      groups.set(req.patternKey, {
        patternKey: req.patternKey,
        label: req.label,
        icon: req.icon,
        category: req.category,
        domain: req.domain,
        method: req.method,
        pathPattern,
        count: 1,
        isNoise: req.isNoise,
        isGolden: req.isGolden,
        hasData: req.hasJsonResponse,
        requests: [req],
        avgDuration: req.duration,
        lastSeen: req.timestamp,
      });
    }
  }
  
  // Sort: golden first, then by count, then by recency
  return Array.from(groups.values()).sort((a, b) => {
    if (a.isGolden !== b.isGolden) return a.isGolden ? -1 : 1;
    if (a.isNoise !== b.isNoise) return a.isNoise ? 1 : -1;
    if (a.hasData !== b.hasData) return a.hasData ? -1 : 1;
    return b.lastSeen - a.lastSeen;
  });
}

/**
 * Group requests by domain with summaries
 */
export function groupByDomain(
  requests: ClassifiedRequest[],
  targetDomain?: string
): DomainSummary[] {
  const domains = new Map<string, DomainSummary>();
  
  for (const req of requests) {
    let summary = domains.get(req.domain);
    
    if (!summary) {
      summary = {
        domain: req.domain,
        favicon: `https://www.google.com/s2/favicons?domain=${req.domain}&sz=32`,
        isTargetSite: targetDomain ? req.domain.includes(targetDomain) : false,
        totalRequests: 0,
        dataEndpoints: 0,
        goldenRoutes: 0,
        categories: {
          data: 0,
          search: 0,
          auth: 0,
          media: 0,
          tracking: 0,
          ads: 0,
          system: 0,
          unknown: 0,
        },
        groups: [],
      };
      domains.set(req.domain, summary);
    }
    
    summary.totalRequests++;
    summary.categories[req.category]++;
    if (req.category === 'data' || req.hasJsonResponse) summary.dataEndpoints++;
    if (req.isGolden) summary.goldenRoutes++;
  }
  
  // Add grouped requests to each domain
  const grouped = groupRequests(requests);
  for (const group of grouped) {
    const summary = domains.get(group.domain);
    if (summary) {
      summary.groups.push(group);
    }
  }
  
  // Sort: target first, then by data endpoints, then by golden routes
  return Array.from(domains.values()).sort((a, b) => {
    if (a.isTargetSite !== b.isTargetSite) return a.isTargetSite ? -1 : 1;
    if (a.goldenRoutes !== b.goldenRoutes) return b.goldenRoutes - a.goldenRoutes;
    if (a.dataEndpoints !== b.dataEndpoints) return b.dataEndpoints - a.dataEndpoints;
    return b.totalRequests - a.totalRequests;
  });
}

/**
 * Get quick stats from classified requests
 */
export function getTrafficStats(requests: ClassifiedRequest[]) {
  const total = requests.length;
  const noise = requests.filter(r => r.isNoise).length;
  const data = requests.filter(r => r.category === 'data' || r.hasJsonResponse).length;
  const golden = requests.filter(r => r.isGolden).length;
  const domains = new Set(requests.map(r => r.domain)).size;
  
  return {
    total,
    noise,
    data,
    golden,
    domains,
    signalRatio: total > 0 ? Math.round((data / total) * 100) : 0,
  };
}

export default {
  classifyRequest,
  groupRequests,
  groupByDomain,
  getTrafficStats,
};
