/**
 * Spider Fleet - Type Definitions
 * Types for managing and monitoring deployed scraper bots
 */

export type SpiderStatus = 'idle' | 'running' | 'error' | 'success';

export interface SpiderClass {
  name: string;
  docstring: string;
}

export interface SpiderBot {
  id: string;              // Filename without extension (e.g., "linkedin_connections")
  filename: string;        // Full filename (e.g., "linkedin_connections_spider.py")
  name: string;            // Friendly name (e.g., "Linkedin Connections Spider")
  description: string;     // First line of module docstring
  classes: SpiderClass[];  // Spider classes found in file
  size: number;            // File size in bytes
  lastModified: string | null;  // ISO timestamp
  createdAt: string | null;     // ISO timestamp
  
  // Runtime stats (from Redis)
  status: SpiderStatus;
  lastRunAt: string | null;
  totalLeads: number;
  lastError: string | null;
}

export interface SpiderStats {
  spider_id: string;
  status: SpiderStatus;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  totalLeads: number;
  averageRunTime: number;
  lastRunAt: string | null;
  lastError: string | null;
}

export interface SpiderRunHistory {
  runId: string;
  startedAt: string;
  completedAt: string | null;
  status: 'success' | 'failed' | 'running';
  leadsFound: number;
  duration: number; // seconds
  error?: string;
}

export interface SpiderDetail extends SpiderBot {
  source: string;           // Full Python source code
  runHistory: SpiderRunHistory[];
}

export interface SpiderListResponse {
  spiders: SpiderBot[];
  total: number;
  directory: string;
}

export interface SpiderRunResponse {
  success: boolean;
  message: string;
  jobId: string;
}

// Helper to format spider status as display text
export function getStatusDisplay(status: SpiderStatus): { text: string; color: string } {
  switch (status) {
    case 'running':
      return { text: 'Running', color: 'text-yellow-400' };
    case 'success':
      return { text: 'Success', color: 'text-green-400' };
    case 'error':
      return { text: 'Error', color: 'text-red-400' };
    case 'idle':
    default:
      return { text: 'Idle', color: 'text-slate-400' };
  }
}

// Helper to format file size
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Helper to format relative time
export function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return 'Never';
  
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}
