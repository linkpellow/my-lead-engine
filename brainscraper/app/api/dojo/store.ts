/**
 * The Dojo - Shared State Store
 * 
 * Simple in-memory singleton for serverless deployment.
 * Tracks proxy status, connected clients, and capture toggle.
 */

export interface DojoState {
  lastHeartbeat: number;
  clientCount: number;
  captureEnabled: boolean;
}

// Singleton state - survives across API calls within same instance
export const dojoState: DojoState = {
  lastHeartbeat: 0,
  clientCount: 0,
  captureEnabled: true, // Default to ON
};

// Heartbeat timeout threshold (10 seconds)
export const HEARTBEAT_TIMEOUT = 10000;

// Helper: Check if proxy is online
export function isProxyOnline(): boolean {
  return dojoState.lastHeartbeat > 0 && 
    (Date.now() - dojoState.lastHeartbeat) < HEARTBEAT_TIMEOUT;
}

// Helper: Update heartbeat
export function updateHeartbeat(clients: number = 0): void {
  dojoState.lastHeartbeat = Date.now();
  dojoState.clientCount = clients;
}

// Helper: Toggle capture
export function setCaptureEnabled(enabled: boolean): void {
  dojoState.captureEnabled = enabled;
}
