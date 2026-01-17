/**
 * The Dojo - Reverse Engineering Cockpit
 * Type definitions for adaptive scraping with multi-domain support
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

export type RouteStatus = 'active' | 'blocked' | 'deprecated';

export interface CapturedRequest {
  id: string;
  url: string;
  domain: string; // e.g., "linkedin.com"
  method: HttpMethod;
  status: number;
  duration: number;
  timestamp: number;
  type: 'xhr' | 'fetch' | 'document' | 'other';
  summary?: string; // AI generated one-line summary
  isNew?: boolean; // For pulse animation on new entries
  headers?: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
  responseSize?: number;
  analysis?: AnalysisResult; // AI analysis result
  extractedFields?: Array<{ 
    fieldType: string; 
    value: string;
    // Validation fields
    validated?: boolean;
    qualityScore?: 'high' | 'medium' | 'low' | 'suspect';
    confidence?: number;
    validationIssues?: Array<{ code: string; message: string }>;
  }>; // Auto-extracted lead fields
}

export interface AnalysisResult {
  relevanceScore: number; // 0-100
  summary: string;
  isGoldenRoute: boolean;
  extractedFields: string[];
  dynamicParameters: Array<{
    name: string;
    location: 'url' | 'header' | 'body' | 'query';
    example: string;
  }>;
  codeSnippet?: string;
  schema?: {
    typescript?: string;
    pydantic?: string;
  };
  warnings?: string[];
}

/**
 * ScraperBlueprint - The "Mega-Prompt" data structure
 * Contains everything needed to generate a production Python spider
 */
export interface ScraperBlueprint {
  id: string;                      // e.g., "linkedin_connections"
  filename: string;                // e.g., "linkedin_connections_spider.py"
  targetUrl: string;               // Full URL template
  method: 'GET' | 'POST';
  headers: Record<string, string>; // ONLY essential headers (Cookie, Auth, CSRF)
  body?: unknown;                  // JSON body if POST
  responseModelName: string;       // e.g., "LinkedInConnectionsResponse"
  pydanticModels: string;          // Full Pydantic class code
  extractionLogic: string;         // JSONPath or extraction notes
  dynamicParams: string[];         // URL params that need to be arguments
  createdAt: number;
}

export interface MappedRoute {
  id: string;
  domain: string; // CRITICAL: Group by this field
  path: string; // e.g., "/api/v2/profile"
  method: HttpMethod;
  health: number; // 0-100
  status: RouteStatus;
  description: string;
  parameters: string[]; // e.g., ["profileId", "cursor"]
  isReplayable: boolean;
  lastSuccessAt?: number;
  failureCount?: number;
}

export interface DomainGroup {
  domain: string;
  favicon: string; // URL to favicon
  routes: MappedRoute[];
  isExpanded: boolean;
  totalRequests: number;
  healthAverage: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  relatedRequestId?: string; // Links chat to a specific network request
  relatedDomain?: string; // Links chat to a domain context
  analysis?: AnalysisResult; // Attached analysis result
  isLoading?: boolean; // Shows typing indicator
}

export interface InterceptorStatus {
  connected: boolean;
  activeDomains: string[];
  totalCaptured: number;
  sessionStartedAt: number;
}

export interface DojoState {
  isLive: boolean;
  targetGoal: string;
  focusDomain?: string; // Filter to show only this domain
  interceptorStatus: InterceptorStatus;
  capturedRequests: CapturedRequest[];
  domainGroups: DomainGroup[];
  chatMessages: ChatMessage[];
  selectedRequestId?: string;
}

// Helper to get favicon URL
export const getFaviconUrl = (domain: string): string => {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
};

// Helper to extract domain from URL
export const extractDomain = (url: string): string => {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
};
