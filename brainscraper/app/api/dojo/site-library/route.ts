import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';

// Data directory for persistence
const DATA_DIR = process.env.DATA_DIR 
  ? join(process.env.DATA_DIR, 'dojo-sites')
  : join(process.cwd(), 'data', 'dojo-sites');

// Field types we track
const TRACKED_FIELDS = ['phone', 'age', 'income', 'address', 'email', 'name', 'city', 'state', 'zipcode'] as const;
type TrackedField = typeof TRACKED_FIELDS[number];

// Field status
interface FieldStatus {
  status: 'verified' | 'untested' | 'failed';
  selector: string;
  lastValue?: string;
  lastTested?: string;
}

// Site record structure
interface SiteRecord {
  id: string;
  domain: string;
  name: string;
  favicon: string;
  status: 'draft' | 'mapping' | 'mapped' | 'blocked' | 'broken';
  createdAt: string;
  updatedAt: string;
  
  // Blueprint
  blueprint: {
    targetUrl: string;
    method: string;
    responseType: 'html' | 'json';
    headers: Record<string, string>;
    extraction: Record<string, string>;
  };
  
  // Field status tracking
  fields: Record<TrackedField, FieldStatus>;
  
  // Health metrics
  lastTested?: string;
  successRate: number;
  totalTests: number;
  lastError?: string;
}

// Default field status
function createDefaultFieldStatus(): Record<TrackedField, FieldStatus> {
  const fields: Record<string, FieldStatus> = {};
  for (const field of TRACKED_FIELDS) {
    fields[field] = { status: 'untested', selector: '' };
  }
  return fields as Record<TrackedField, FieldStatus>;
}

// Create a new site record
function createSiteRecord(domain: string, name?: string): SiteRecord {
  const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  
  return {
    id: cleanDomain.replace(/\./g, '-'),
    domain: cleanDomain,
    name: name || cleanDomain.split('.')[0].charAt(0).toUpperCase() + cleanDomain.split('.')[0].slice(1),
    favicon: `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=64`,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    blueprint: {
      targetUrl: `https://${cleanDomain}`,
      method: 'GET',
      responseType: 'html',
      headers: {},
      extraction: {},
    },
    fields: createDefaultFieldStatus(),
    successRate: 0,
    totalTests: 0,
  };
}

// Ensure data directory exists
async function ensureDataDir() {
  const { mkdir } = await import('fs/promises');
  try {
    await mkdir(DATA_DIR, { recursive: true });
  } catch (e) {
    // Directory exists
  }
}

// Load all sites
async function loadSites(): Promise<SiteRecord[]> {
  await ensureDataDir();
  const { readdir, readFile } = await import('fs/promises');
  
  try {
    const files = await readdir(DATA_DIR);
    const sites: SiteRecord[] = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = await readFile(join(DATA_DIR, file), 'utf-8');
          sites.push(JSON.parse(content));
        } catch (e) {
          console.error(`Failed to load site ${file}:`, e);
        }
      }
    }
    
    // Sort by name
    return sites.sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) {
    return [];
  }
}

// Save a site
async function saveSite(site: SiteRecord): Promise<void> {
  await ensureDataDir();
  const { writeFile } = await import('fs/promises');
  
  site.updatedAt = new Date().toISOString();
  await writeFile(
    join(DATA_DIR, `${site.id}.json`),
    JSON.stringify(site, null, 2)
  );
}

// Delete a site
async function deleteSite(siteId: string): Promise<boolean> {
  const { unlink } = await import('fs/promises');
  
  try {
    await unlink(join(DATA_DIR, `${siteId}.json`));
    return true;
  } catch (e) {
    return false;
  }
}

// GET - List all sites or get specific site
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('id');
    
    if (siteId) {
      // Get specific site
      const sites = await loadSites();
      const site = sites.find(s => s.id === siteId);
      
      if (!site) {
        return NextResponse.json({ error: 'Site not found' }, { status: 404 });
      }
      
      return NextResponse.json({ success: true, site });
    }
    
    // List all sites
    const sites = await loadSites();
    
    // Calculate summary stats
    const stats = {
      total: sites.length,
      mapped: sites.filter(s => s.status === 'mapped').length,
      blocked: sites.filter(s => s.status === 'blocked').length,
      draft: sites.filter(s => s.status === 'draft').length,
    };
    
    return NextResponse.json({ success: true, sites, stats });
  } catch (error) {
    console.error('Site library error:', error);
    return NextResponse.json({ error: 'Failed to load sites' }, { status: 500 });
  }
}

// POST - Create or update site
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, domain, site: siteUpdate, testResult } = body;
    
    if (action === 'create') {
      // Create new site
      if (!domain) {
        return NextResponse.json({ error: 'Domain required' }, { status: 400 });
      }
      
      const site = createSiteRecord(domain, body.name);
      await saveSite(site);
      
      return NextResponse.json({ success: true, site });
    }
    
    if (action === 'update') {
      // Update existing site
      if (!siteUpdate?.id) {
        return NextResponse.json({ error: 'Site ID required' }, { status: 400 });
      }
      
      const sites = await loadSites();
      const existing = sites.find(s => s.id === siteUpdate.id);
      
      if (!existing) {
        return NextResponse.json({ error: 'Site not found' }, { status: 404 });
      }
      
      // Merge updates
      const updated = { ...existing, ...siteUpdate };
      await saveSite(updated);
      
      return NextResponse.json({ success: true, site: updated });
    }
    
    if (action === 'recordTest') {
      // Record test result for a site
      if (!testResult?.siteId) {
        return NextResponse.json({ error: 'Site ID required' }, { status: 400 });
      }
      
      const sites = await loadSites();
      const site = sites.find(s => s.id === testResult.siteId);
      
      if (!site) {
        return NextResponse.json({ error: 'Site not found' }, { status: 404 });
      }
      
      // Update test metrics
      site.totalTests++;
      site.lastTested = new Date().toISOString();
      
      if (testResult.success) {
        site.successRate = ((site.successRate * (site.totalTests - 1)) + 100) / site.totalTests;
        
        // Update field statuses
        if (testResult.extractedFields) {
          for (const [fieldName, value] of Object.entries(testResult.extractedFields)) {
            if (site.fields[fieldName as TrackedField]) {
              site.fields[fieldName as TrackedField].status = 'verified';
              site.fields[fieldName as TrackedField].lastValue = value as string;
              site.fields[fieldName as TrackedField].lastTested = new Date().toISOString();
            }
          }
        }
        
        // Update status if we have verified fields
        const verifiedCount = Object.values(site.fields).filter(f => f.status === 'verified').length;
        if (verifiedCount >= 2) {
          site.status = 'mapped';
        }
      } else {
        site.successRate = ((site.successRate * (site.totalTests - 1)) + 0) / site.totalTests;
        site.lastError = testResult.error || 'Unknown error';
        
        // Mark as blocked if Cloudflare/CAPTCHA
        if (testResult.error?.includes('403') || testResult.error?.includes('CAPTCHA')) {
          site.status = 'blocked';
        }
      }
      
      await saveSite(site);
      
      return NextResponse.json({ success: true, site });
    }
    
    if (action === 'delete') {
      if (!body.siteId) {
        return NextResponse.json({ error: 'Site ID required' }, { status: 400 });
      }
      
      const deleted = await deleteSite(body.siteId);
      
      return NextResponse.json({ success: deleted });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Site library error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
