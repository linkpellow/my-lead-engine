import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * The Dojo - Spider Monitoring API
 * 
 * Provides real-time health monitoring for deployed spiders.
 * Scrapegoat workers report run status here.
 */

const DATA_DIR = process.env.DATA_DIR || './data';
const SITES_DIR = path.join(DATA_DIR, 'dojo-sites');

interface SpiderStatus {
  id: string;
  domain: string;
  filename: string;
  health: number;
  healthStatus: 'healthy' | 'degraded' | 'broken' | 'unknown';
  lastRunAt?: number;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  lastError?: string;
  deployedAt: number;
  githubUrl?: string;
}

interface SpiderRunReport {
  spiderId: string;
  domain: string;
  runId: string;
  status: 'running' | 'success' | 'failed' | 'timeout';
  startedAt: number;
  completedAt?: number;
  itemsScraped?: number;
  errors?: string[];
  duration?: number;
}

// Load all sites
function loadAllSites(): Array<{ domain: string; config: Record<string, unknown> }> {
  if (!fs.existsSync(SITES_DIR)) {
    return [];
  }
  
  const files = fs.readdirSync(SITES_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    try {
      const data = fs.readFileSync(path.join(SITES_DIR, f), 'utf-8');
      const config = JSON.parse(data);
      return { domain: config.domain, config };
    } catch {
      return null;
    }
  }).filter((s): s is { domain: string; config: Record<string, unknown> } => s !== null);
}

// Get all spiders across all sites
function getAllSpiders(): SpiderStatus[] {
  const sites = loadAllSites();
  const spiders: SpiderStatus[] = [];
  
  for (const { domain, config } of sites) {
    const deployedSpiders = (config.deployedSpiders || []) as SpiderStatus[];
    for (const spider of deployedSpiders) {
      spiders.push({
        ...spider,
        domain,
      });
    }
  }
  
  return spiders;
}

/**
 * GET /api/dojo/spiders
 * List all deployed spiders with health status
 * 
 * Query params:
 * - domain: Filter by domain
 * - status: Filter by health status (healthy, degraded, broken)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain');
  const status = searchParams.get('status');
  
  let spiders = getAllSpiders();
  
  // Filter by domain
  if (domain) {
    spiders = spiders.filter(s => s.domain === domain);
  }
  
  // Filter by status
  if (status) {
    spiders = spiders.filter(s => s.healthStatus === status);
  }
  
  // Sort by health (broken first, then by last run)
  spiders.sort((a, b) => {
    if (a.healthStatus === 'broken' && b.healthStatus !== 'broken') return -1;
    if (b.healthStatus === 'broken' && a.healthStatus !== 'broken') return 1;
    return (b.lastRunAt || 0) - (a.lastRunAt || 0);
  });
  
  // Calculate aggregate stats
  const stats = {
    total: spiders.length,
    healthy: spiders.filter(s => s.healthStatus === 'healthy').length,
    degraded: spiders.filter(s => s.healthStatus === 'degraded').length,
    broken: spiders.filter(s => s.healthStatus === 'broken').length,
    unknown: spiders.filter(s => s.healthStatus === 'unknown').length,
    avgHealth: spiders.length > 0 
      ? Math.round(spiders.reduce((sum, s) => sum + (s.health || 0), 0) / spiders.length)
      : 0,
  };
  
  return NextResponse.json({
    success: true,
    spiders,
    stats,
    timestamp: Date.now(),
  });
}

/**
 * POST /api/dojo/spiders
 * Report spider run status (called by scrapegoat workers)
 */
export async function POST(request: NextRequest) {
  try {
    const report: SpiderRunReport = await request.json();
    
    if (!report.spiderId || !report.domain || !report.runId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: spiderId, domain, runId' },
        { status: 400 }
      );
    }
    
    // Update site config with run info
    const siteFilePath = path.join(SITES_DIR, `${report.domain.replace(/\./g, '_').toLowerCase()}.json`);
    
    if (!fs.existsSync(siteFilePath)) {
      return NextResponse.json(
        { success: false, error: `Site not found: ${report.domain}` },
        { status: 404 }
      );
    }
    
    const siteData = JSON.parse(fs.readFileSync(siteFilePath, 'utf-8'));
    const spiders = siteData.deployedSpiders || [];
    const spiderIdx = spiders.findIndex((s: { id: string }) => s.id === report.spiderId);
    
    if (spiderIdx === -1) {
      return NextResponse.json(
        { success: false, error: `Spider not found: ${report.spiderId}` },
        { status: 404 }
      );
    }
    
    const spider = spiders[spiderIdx];
    
    // Update run history
    if (!spider.runHistory) spider.runHistory = [];
    
    // Check if this run already exists (update) or is new (add)
    const existingRunIdx = spider.runHistory.findIndex((r: { runId: string }) => r.runId === report.runId);
    
    const runRecord = {
      runId: report.runId,
      startedAt: report.startedAt,
      completedAt: report.completedAt,
      status: report.status,
      itemsScraped: report.itemsScraped || 0,
      errors: report.errors || [],
      duration: report.duration,
    };
    
    if (existingRunIdx >= 0) {
      spider.runHistory[existingRunIdx] = runRecord;
    } else {
      spider.runHistory.unshift(runRecord);
      spider.runHistory = spider.runHistory.slice(0, 100); // Keep last 100
      spider.totalRuns = (spider.totalRuns || 0) + 1;
    }
    
    // Update spider stats based on run status
    if (report.status === 'running') {
      spider.lastRunAt = report.startedAt;
    } else if (report.status === 'success') {
      spider.successfulRuns = (spider.successfulRuns || 0) + 1;
      spider.health = Math.min(100, (spider.health || 50) + 5);
      spider.healthStatus = spider.health >= 80 ? 'healthy' : 'degraded';
      spider.lastError = undefined;
    } else if (report.status === 'failed' || report.status === 'timeout') {
      spider.failedRuns = (spider.failedRuns || 0) + 1;
      spider.lastError = report.errors?.[0] || `Run ${report.status}`;
      spider.health = Math.max(0, (spider.health || 50) - 15);
      
      if (spider.health <= 30) {
        spider.healthStatus = 'broken';
        
        // Update site status to broken
        if (spider.health <= 20 && siteData.status !== 'broken') {
          siteData.status = 'broken';
          if (!siteData.statusHistory) siteData.statusHistory = [];
          siteData.statusHistory.push({
            from: siteData.status,
            to: 'broken',
            timestamp: Date.now(),
            reason: `Spider ${spider.id} health critical (${spider.health}%)`,
          });
        }
      } else {
        spider.healthStatus = 'degraded';
      }
    }
    
    // Save updated config
    spiders[spiderIdx] = spider;
    siteData.deployedSpiders = spiders;
    siteData.updatedAt = Date.now();
    fs.writeFileSync(siteFilePath, JSON.stringify(siteData, null, 2));
    
    return NextResponse.json({
      success: true,
      spider: {
        id: spider.id,
        health: spider.health,
        healthStatus: spider.healthStatus,
        totalRuns: spider.totalRuns,
        successfulRuns: spider.successfulRuns,
        failedRuns: spider.failedRuns,
      },
    });
  } catch (error) {
    console.error('[Dojo Spiders] Report error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to report spider status' },
      { status: 500 }
    );
  }
}
