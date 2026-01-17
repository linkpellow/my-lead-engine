import { NextRequest, NextResponse } from 'next/server';
import { dojoState, isProxyOnline, updateHeartbeat } from '../store';

/**
 * The Dojo - Proxy Status API
 * 
 * POST: Called by Python relay script (heartbeat)
 * GET: Called by UI (polling for status)
 */

type EventType = 'heartbeat' | 'connect' | 'disconnect';

interface StatusEvent {
  type: EventType;
  clients?: number;
}

/**
 * POST /api/dojo/status
 * Called by the Python relay script every 5 seconds
 */
export async function POST(request: NextRequest) {
  try {
    const event: StatusEvent = await request.json();

    switch (event.type) {
      case 'heartbeat':
        updateHeartbeat(event.clients || dojoState.clientCount);
        break;
        
      case 'connect':
        dojoState.clientCount = (event.clients ?? dojoState.clientCount + 1);
        updateHeartbeat(dojoState.clientCount);
        break;
        
      case 'disconnect':
        dojoState.clientCount = Math.max(0, (event.clients ?? dojoState.clientCount - 1));
        updateHeartbeat(dojoState.clientCount);
        break;
        
      default:
        return NextResponse.json(
          { error: `Unknown event type` },
          { status: 400 }
        );
    }

    // Return current capture state - this is how we send commands to the script
    return NextResponse.json({
      captureEnabled: dojoState.captureEnabled,
    });
  } catch (error) {
    console.error('[Dojo Status] Error:', error);
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}

/**
 * GET /api/dojo/status
 * Called by the UI to poll current status
 */
export async function GET() {
  return NextResponse.json({
    isProxyOnline: isProxyOnline(),
    clientCount: dojoState.clientCount,
    captureEnabled: dojoState.captureEnabled,
  });
}
