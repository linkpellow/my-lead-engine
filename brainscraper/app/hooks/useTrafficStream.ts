'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { CapturedRequest } from '@/app/dojo/types';

interface TrafficStreamState {
  requests: CapturedRequest[];
  isLive: boolean;
  isPaused: boolean;
  isConnected: boolean;
  totalIngested: number;
  lastIngestTime: number;
  error: string | null;
}

interface UseTrafficStreamOptions {
  pollInterval?: number; // ms between polls (default: 2000)
  maxRequests?: number;  // max requests to keep in state (default: 100)
  initialPaused?: boolean;
}

interface UseTrafficStreamReturn extends TrafficStreamState {
  togglePause: () => void;
  clearRequests: () => void;
  refresh: () => Promise<void>;
}

/**
 * useTrafficStream - React hook for real-time traffic ingestion
 * 
 * Polls /api/dojo/ingest for captured network requests from mitmproxy.
 * Supports pause/resume, incremental updates, and connection status.
 */
export function useTrafficStream(options: UseTrafficStreamOptions = {}): UseTrafficStreamReturn {
  const {
    pollInterval = 2000,
    maxRequests = 100,
    initialPaused = false,
  } = options;

  const [state, setState] = useState<TrafficStreamState>({
    requests: [],
    isLive: false,
    isPaused: initialPaused,
    isConnected: false,
    totalIngested: 0,
    lastIngestTime: 0,
    error: null,
  });

  // Track last seen timestamp for incremental fetches
  const lastSeenTimestamp = useRef<number>(0);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Fetch requests from API
  const fetchRequests = useCallback(async (incremental = true) => {
    try {
      const params = new URLSearchParams({
        limit: maxRequests.toString(),
      });
      
      // Only fetch new requests if incremental
      if (incremental && lastSeenTimestamp.current > 0) {
        params.set('since', lastSeenTimestamp.current.toString());
      }

      const response = await fetch(`/api/dojo/ingest?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!mountedRef.current) return;

      if (data.success) {
        const newRequests: CapturedRequest[] = data.requests.map((r: CapturedRequest) => ({
          ...r,
          isNew: incremental && lastSeenTimestamp.current > 0,
        }));

        // Update last seen timestamp
        if (newRequests.length > 0) {
          lastSeenTimestamp.current = Math.max(
            lastSeenTimestamp.current,
            ...newRequests.map(r => r.timestamp)
          );
        }

        setState(prev => {
          // Merge new requests with existing, avoiding duplicates
          const existingIds = new Set(prev.requests.map(r => r.id));
          const uniqueNew = newRequests.filter(r => !existingIds.has(r.id));
          
          // Combine and sort by timestamp (newest first)
          let combined = [...uniqueNew, ...prev.requests];
          combined.sort((a, b) => b.timestamp - a.timestamp);
          
          // Trim to max
          if (combined.length > maxRequests) {
            combined = combined.slice(0, maxRequests);
          }

          return {
            ...prev,
            requests: combined,
            isLive: data.isLive,
            isConnected: true,
            totalIngested: data.total,
            lastIngestTime: data.lastIngestTime,
            error: null,
          };
        });
      }
    } catch (error) {
      if (!mountedRef.current) return;
      
      setState(prev => ({
        ...prev,
        isConnected: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      }));
    }
  }, [maxRequests]);

  // Start/stop polling based on pause state
  useEffect(() => {
    mountedRef.current = true;

    const poll = async () => {
      if (!state.isPaused) {
        await fetchRequests(true);
      }
      
      if (mountedRef.current) {
        pollTimeoutRef.current = setTimeout(poll, pollInterval);
      }
    };

    // Initial fetch (full, not incremental)
    fetchRequests(false).then(() => {
      if (mountedRef.current) {
        pollTimeoutRef.current = setTimeout(poll, pollInterval);
      }
    });

    return () => {
      mountedRef.current = false;
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, [fetchRequests, pollInterval, state.isPaused]);

  // Toggle pause/resume
  const togglePause = useCallback(() => {
    setState(prev => ({ ...prev, isPaused: !prev.isPaused }));
  }, []);

  // Clear all requests
  const clearRequests = useCallback(async () => {
    try {
      await fetch('/api/dojo/ingest', { method: 'DELETE' });
      lastSeenTimestamp.current = 0;
      setState(prev => ({
        ...prev,
        requests: [],
        totalIngested: 0,
      }));
    } catch (error) {
      console.error('[useTrafficStream] Clear failed:', error);
    }
  }, []);

  // Manual refresh
  const refresh = useCallback(async () => {
    await fetchRequests(false);
  }, [fetchRequests]);

  return {
    ...state,
    togglePause,
    clearRequests,
    refresh,
  };
}

export default useTrafficStream;
