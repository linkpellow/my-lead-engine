import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * The Dojo - Site Configuration Storage
 * 
 * Saves and loads mapped site configurations including:
 * - Discovered routes and their health status
 * - Golden routes (high-value endpoints)
 * - Extracted field patterns
 * - Generated blueprints
 */

// Site mapping status workflow
export type SiteMappingStatus = 
  | 'mapping'      // Initial capture phase - discovering endpoints
  | 'verifying'    // AI verification phase - testing extraction
  | 'complete'     // Fully mapped and verified by Copilot
  | 'broken'       // One or more endpoints failed health check
  | 'archived';    // No longer active

// Site configuration interface
export interface SiteConfig {
  id: string;                    // e.g., "fastpeoplesearch_com"
  domain: string;                // e.g., "fastpeoplesearch.com"
  name: string;                  // e.g., "FastPeopleSearch"
  description?: string;
  createdAt: number;
  updatedAt: number;
  
  // Mapping workflow status
  status: SiteMappingStatus;
  statusHistory: StatusChange[];
  verificationNotes?: string;    // Copilot's verification summary
  
  // Target fields (what user wants to extract)
  targetFields: string[];        // e.g., ["phone", "email", "address", "age"]
  
  routes: SavedRoute[];
  extractedFieldPatterns: ExtractedFieldPattern[];
  blueprints: SavedBlueprint[];
  
  // Deployed spiders
  deployedSpiders: DeployedSpider[];
  
  settings: SiteSettings;
}

// Track status changes
export interface StatusChange {
  from: SiteMappingStatus | null;
  to: SiteMappingStatus;
  timestamp: number;
  reason?: string;
  verifiedBy?: 'copilot' | 'manual';
}

// Deployed spider tracking
export interface DeployedSpider {
  id: string;                    // e.g., "fastpeoplesearch_person_spider"
  filename: string;              // e.g., "fastpeoplesearch_person_spider.py"
  githubUrl?: string;            // URL to the spider file on GitHub
  commitSha?: string;            // Git commit SHA
  deployedAt: number;            // Timestamp of deployment
  lastRunAt?: number;            // Last execution time
  health: number;                // 0-100 health rating
  healthStatus: 'healthy' | 'degraded' | 'broken' | 'unknown';
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  lastError?: string;
  monitoringEnabled: boolean;
  runHistory: SpiderRunRecord[];
}

export interface SavedRoute {
  id: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  description: string;
  isGoldenRoute: boolean;
  health: number;
  status: 'active' | 'blocked' | 'deprecated';
  parameters: string[];
  sampleUrl?: string;
  sampleHeaders?: Record<string, string>;
  sampleRequestBody?: string;
  sampleResponseBody?: string;
  lastSeenAt: number;
  successCount: number;
  failureCount: number;
}

export interface ExtractedFieldPattern {
  fieldName: string;             // e.g., "phone", "email", "zipcode"
  jsonPath: string;              // e.g., "$.data.person.phones[*].number"
  regex?: string;                // Optional regex to validate/extract
  sampleValues: string[];        // Last 5 sample values seen
  routeId: string;               // Which route this pattern was found on
  lastSeenAt: number;
}

export interface SavedBlueprint {
  id: string;
  filename: string;
  routeId: string;
  pydanticModels: string;
  extractionLogic: string;
  createdAt: number;
}

// Spider run history record
export interface SpiderRunRecord {
  runId: string;
  startedAt: number;
  completedAt?: number;
  status: 'running' | 'success' | 'failed' | 'timeout';
  itemsScraped: number;
  errors: string[];
  duration?: number;             // ms
}

export interface SiteSettings {
  autoCapture: boolean;          // Auto-capture traffic for this domain
  priorityFields: string[];      // Fields to highlight: ["phone", "email", "address"]
  rateLimit?: number;            // Requests per minute to avoid detection
  requiresAuth: boolean;
  authNotes?: string;
}

// Storage location
const DATA_DIR = process.env.DATA_DIR || './data';
const SITES_DIR = path.join(DATA_DIR, 'dojo-sites');

// Ensure directory exists
function ensureDir() {
  if (!fs.existsSync(SITES_DIR)) {
    fs.mkdirSync(SITES_DIR, { recursive: true });
  }
}

// Get site file path
function getSitePath(domain: string): string {
  const id = domain.replace(/\./g, '_').toLowerCase();
  return path.join(SITES_DIR, `${id}.json`);
}

// Load site config
function loadSite(domain: string): SiteConfig | null {
  const filePath = getSitePath(domain);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data) as SiteConfig;
  } catch {
    return null;
  }
}

// Save site config
function saveSite(config: SiteConfig): void {
  ensureDir();
  const filePath = getSitePath(config.domain);
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
}

// List all saved sites
function listSites(): SiteConfig[] {
  ensureDir();
  const files = fs.readdirSync(SITES_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    try {
      const data = fs.readFileSync(path.join(SITES_DIR, f), 'utf-8');
      return JSON.parse(data) as SiteConfig;
    } catch {
      return null;
    }
  }).filter((s): s is SiteConfig => s !== null);
}

// Delete site config
function deleteSite(domain: string): boolean {
  const filePath = getSitePath(domain);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

/**
 * GET /api/dojo/sites
 * List all saved site configurations
 * 
 * Query params:
 * - domain: Get specific site config
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain');
  
  if (domain) {
    const site = loadSite(domain);
    if (!site) {
      return NextResponse.json(
        { success: false, error: `Site not found: ${domain}` },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, site });
  }
  
  const sites = listSites();
  return NextResponse.json({
    success: true,
    sites,
    count: sites.length,
  });
}

/**
 * POST /api/dojo/sites
 * Save or update a site configuration
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.domain) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: domain' },
        { status: 400 }
      );
    }
    
    // Load existing or create new
    const existing = loadSite(body.domain);
    const now = Date.now();
    
    // Determine status
    const newStatus = body.status || existing?.status || 'mapping';
    const statusChanged = existing && existing.status !== newStatus;
    
    // Build status history
    const statusHistory: StatusChange[] = existing?.statusHistory || [];
    if (!existing) {
      // New site - add initial status
      statusHistory.push({
        from: null,
        to: 'mapping',
        timestamp: now,
        reason: 'Site mapping initiated',
      });
    } else if (statusChanged) {
      // Status changed - add to history
      statusHistory.push({
        from: existing.status,
        to: newStatus,
        timestamp: now,
        reason: body.statusReason || `Status changed to ${newStatus}`,
        verifiedBy: body.verifiedBy,
      });
    }
    
    const config: SiteConfig = {
      id: body.domain.replace(/\./g, '_').toLowerCase(),
      domain: body.domain,
      name: body.name || body.domain.split('.')[0].charAt(0).toUpperCase() + body.domain.split('.')[0].slice(1),
      description: body.description,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      
      // Status workflow
      status: newStatus,
      statusHistory,
      verificationNotes: body.verificationNotes || existing?.verificationNotes,
      
      // Target fields
      targetFields: body.targetFields || existing?.targetFields || ['phone', 'email', 'address', 'zipcode', 'age'],
      
      routes: body.routes || existing?.routes || [],
      extractedFieldPatterns: body.extractedFieldPatterns || existing?.extractedFieldPatterns || [],
      blueprints: body.blueprints || existing?.blueprints || [],
      
      // Deployed spiders
      deployedSpiders: body.deployedSpiders || existing?.deployedSpiders || [],
      
      settings: {
        autoCapture: body.settings?.autoCapture ?? existing?.settings?.autoCapture ?? true,
        priorityFields: body.settings?.priorityFields || existing?.settings?.priorityFields || ['phone', 'email', 'address', 'zipcode', 'age'],
        rateLimit: body.settings?.rateLimit || existing?.settings?.rateLimit,
        requiresAuth: body.settings?.requiresAuth ?? existing?.settings?.requiresAuth ?? false,
        authNotes: body.settings?.authNotes || existing?.settings?.authNotes,
      },
    };
    
    saveSite(config);
    
    return NextResponse.json({
      success: true,
      site: config,
      created: !existing,
    });
  } catch (error) {
    console.error('[Dojo Sites] Save error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save site configuration' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/dojo/sites
 * Add a route or field pattern to existing site
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.domain) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: domain' },
        { status: 400 }
      );
    }
    
    const existing = loadSite(body.domain);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: `Site not found: ${body.domain}` },
        { status: 404 }
      );
    }
    
    // Add route
    if (body.addRoute) {
      const route = body.addRoute as SavedRoute;
      const existingIdx = existing.routes.findIndex(r => r.id === route.id);
      if (existingIdx >= 0) {
        existing.routes[existingIdx] = { ...existing.routes[existingIdx], ...route };
      } else {
        existing.routes.push(route);
      }
    }
    
    // Add field pattern
    if (body.addFieldPattern) {
      const pattern = body.addFieldPattern as ExtractedFieldPattern;
      const existingIdx = existing.extractedFieldPatterns.findIndex(
        p => p.fieldName === pattern.fieldName && p.routeId === pattern.routeId
      );
      if (existingIdx >= 0) {
        // Merge sample values
        const existingSamples = existing.extractedFieldPatterns[existingIdx].sampleValues;
        const newSamples = [...new Set([...pattern.sampleValues, ...existingSamples])].slice(0, 5);
        existing.extractedFieldPatterns[existingIdx] = { ...pattern, sampleValues: newSamples };
      } else {
        existing.extractedFieldPatterns.push(pattern);
      }
    }
    
    // Add blueprint
    if (body.addBlueprint) {
      const blueprint = body.addBlueprint as SavedBlueprint;
      const existingIdx = existing.blueprints.findIndex(b => b.id === blueprint.id);
      if (existingIdx >= 0) {
        existing.blueprints[existingIdx] = blueprint;
      } else {
        existing.blueprints.push(blueprint);
      }
    }
    
    // Add/update deployed spider
    if (body.addSpider || body.updateSpider) {
      const spider = (body.addSpider || body.updateSpider) as DeployedSpider;
      if (!existing.deployedSpiders) {
        existing.deployedSpiders = [];
      }
      const existingIdx = existing.deployedSpiders.findIndex(s => s.id === spider.id);
      if (existingIdx >= 0) {
        existing.deployedSpiders[existingIdx] = { ...existing.deployedSpiders[existingIdx], ...spider };
      } else {
        existing.deployedSpiders.push(spider);
      }
    }
    
    // Update spider run history
    if (body.spiderRun) {
      const { spiderId, run } = body.spiderRun as { spiderId: string; run: SpiderRunRecord };
      const spider = existing.deployedSpiders?.find(s => s.id === spiderId);
      if (spider) {
        if (!spider.runHistory) spider.runHistory = [];
        spider.runHistory.unshift(run);
        spider.runHistory = spider.runHistory.slice(0, 100); // Keep last 100 runs
        spider.lastRunAt = run.startedAt;
        spider.totalRuns = (spider.totalRuns || 0) + 1;
        
        if (run.status === 'success') {
          spider.successfulRuns = (spider.successfulRuns || 0) + 1;
          spider.health = Math.min(100, (spider.health || 50) + 5);
          spider.healthStatus = spider.health >= 80 ? 'healthy' : 'degraded';
        } else if (run.status === 'failed') {
          spider.failedRuns = (spider.failedRuns || 0) + 1;
          spider.lastError = run.errors?.[0];
          spider.health = Math.max(0, (spider.health || 50) - 15);
          spider.healthStatus = spider.health <= 30 ? 'broken' : 'degraded';
          
          // Update site status to broken if spider health is critical
          if (spider.health <= 20) {
            existing.status = 'broken';
            existing.statusHistory.push({
              from: existing.status,
              to: 'broken',
              timestamp: Date.now(),
              reason: `Spider ${spider.id} health critical (${spider.health}%)`,
            });
          }
        }
      }
    }
    
    // Update status if provided
    if (body.status && body.status !== existing.status) {
      existing.statusHistory.push({
        from: existing.status,
        to: body.status,
        timestamp: Date.now(),
        reason: body.statusReason || `Status changed to ${body.status}`,
        verifiedBy: body.verifiedBy,
      });
      existing.status = body.status;
      if (body.verificationNotes) {
        existing.verificationNotes = body.verificationNotes;
      }
    }
    
    existing.updatedAt = Date.now();
    saveSite(existing);
    
    return NextResponse.json({
      success: true,
      site: existing,
    });
  } catch (error) {
    console.error('[Dojo Sites] Patch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update site configuration' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/dojo/sites
 * Delete a site configuration
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain');
  
  if (!domain) {
    return NextResponse.json(
      { success: false, error: 'Missing required param: domain' },
      { status: 400 }
    );
  }
  
  const deleted = deleteSite(domain);
  
  return NextResponse.json({
    success: deleted,
    message: deleted ? `Deleted site: ${domain}` : `Site not found: ${domain}`,
  });
}
