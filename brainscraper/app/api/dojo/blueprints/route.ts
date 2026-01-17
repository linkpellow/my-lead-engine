import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

/**
 * Blueprint Storage API
 * 
 * Stores extraction blueprints from The Dojo for use by scrapegoat workers.
 * Blueprints contain endpoint patterns and JSON paths for extracting data.
 */

const BLUEPRINT_DIR = process.env.DATA_DIR 
  ? join(process.env.DATA_DIR, 'dojo-blueprints')
  : join(process.cwd(), 'data', 'dojo-blueprints');

interface Blueprint {
  id: string;
  domain: string;
  targetUrl: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers: Record<string, string>;
  body?: any;
  extraction: Record<string, string>; // field_name -> json_path
  dynamicParams: string[]; // Parameters that need to be filled (name, city, etc.)
  createdAt: number;
  updatedAt: number;
}

// Ensure directory exists
async function ensureBlueprintDir() {
  try {
    await mkdir(BLUEPRINT_DIR, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      console.error('[Blueprints] Failed to create directory:', error);
    }
  }
}

/**
 * POST /api/dojo/blueprints
 * Save or update a blueprint
 */
export async function POST(request: NextRequest) {
  try {
    await ensureBlueprintDir();
    
    const body = await request.json();
    const { domain, blueprint } = body;
    
    if (!domain || !blueprint) {
      return NextResponse.json(
        { success: false, error: 'Missing domain or blueprint' },
        { status: 400 }
      );
    }
    
    // Normalize domain
    const normalizedDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    
    // Build blueprint with metadata
    const fullBlueprint: Blueprint = {
      id: blueprint.id || `blueprint-${Date.now()}`,
      domain: normalizedDomain,
      targetUrl: blueprint.targetUrl || blueprint.url || '',
      method: blueprint.method || 'GET',
      headers: blueprint.headers || {},
      body: blueprint.body,
      extraction: blueprint.extraction || blueprint.extractionPaths || {},
      dynamicParams: blueprint.dynamicParams || blueprint.params || [],
      createdAt: blueprint.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    
    // Save to file (same format scrapegoat expects)
    const filePath = join(BLUEPRINT_DIR, `${normalizedDomain}.json`);
    await writeFile(filePath, JSON.stringify(fullBlueprint, null, 2));
    
    console.log(`✅ Blueprint saved: ${normalizedDomain} -> ${filePath}`);
    
    // Sync to Scrapegoat (so workers can use it immediately)
    const scrapegoatUrl = process.env.SCRAPEGOAT_URL || 'http://localhost:8000';
    try {
      const syncResponse = await fetch(`${scrapegoatUrl}/api/blueprints/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: normalizedDomain,
          blueprint: fullBlueprint,
        }),
      });
      
      if (syncResponse.ok) {
        console.log(`🔄 Blueprint synced to Scrapegoat: ${normalizedDomain}`);
      } else {
        console.warn(`⚠️ Failed to sync blueprint to Scrapegoat: ${syncResponse.status}`);
      }
    } catch (syncError) {
      console.warn(`⚠️ Could not sync blueprint to Scrapegoat (service may be down):`, syncError);
      // Don't fail the request - local save succeeded
    }
    
    return NextResponse.json({
      success: true,
      domain: normalizedDomain,
      filePath,
      blueprint: fullBlueprint,
    });
    
  } catch (error: any) {
    console.error('[Blueprints] Save failed:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save blueprint' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/dojo/blueprints
 * List all saved blueprints or get specific one
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');
    
    if (domain) {
      // Get specific blueprint
      const { readFile } = await import('fs/promises');
      const normalizedDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      const filePath = join(BLUEPRINT_DIR, `${normalizedDomain}.json`);
      
      try {
        const content = await readFile(filePath, 'utf-8');
        const blueprint = JSON.parse(content);
        return NextResponse.json({ success: true, blueprint });
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          return NextResponse.json(
            { success: false, error: 'Blueprint not found' },
            { status: 404 }
          );
        }
        throw error;
      }
    } else {
      // List all blueprints
      const { readdir, stat, readFile } = await import('fs/promises');
      await ensureBlueprintDir();
      
      const files = await readdir(BLUEPRINT_DIR);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      const blueprints = await Promise.all(
        jsonFiles.map(async (file) => {
          try {
            const filePath = join(BLUEPRINT_DIR, file);
            const stats = await stat(filePath);
            const content = await readFile(filePath, 'utf-8');
            const blueprint = JSON.parse(content);
            return {
              domain: blueprint.domain || file.replace('.json', ''),
              ...blueprint,
              fileSize: stats.size,
              modifiedAt: stats.mtimeMs,
            };
          } catch {
            return null;
          }
        })
      );
      
      return NextResponse.json({
        success: true,
        count: blueprints.filter(Boolean).length,
        blueprints: blueprints.filter(Boolean),
      });
    }
    
  } catch (error: any) {
    console.error('[Blueprints] List failed:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list blueprints' },
      { status: 500 }
    );
  }
}
