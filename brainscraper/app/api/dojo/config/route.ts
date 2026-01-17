import { NextRequest, NextResponse } from 'next/server';
import { dojoState, setCaptureEnabled } from '../store';

/**
 * The Dojo - Capture Toggle API
 * 
 * POST: Toggle capture on/off (Master Switch)
 * GET: Get current config
 */

interface ConfigUpdate {
  enabled: boolean;
}

/**
 * POST /api/dojo/config
 * Called by the UI to toggle capture
 */
export async function POST(request: NextRequest) {
  try {
    const body: ConfigUpdate = await request.json();
    
    if (typeof body.enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing enabled boolean' },
        { status: 400 }
      );
    }

    setCaptureEnabled(body.enabled);
    console.log(`[Dojo] Capture ${body.enabled ? 'ENABLED' : 'DISABLED'}`);

    return NextResponse.json({
      captureEnabled: dojoState.captureEnabled,
    });
  } catch (error) {
    console.error('[Dojo Config] Error:', error);
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}

/**
 * GET /api/dojo/config
 * Returns current config
 */
export async function GET() {
  return NextResponse.json({
    captureEnabled: dojoState.captureEnabled,
  });
}
