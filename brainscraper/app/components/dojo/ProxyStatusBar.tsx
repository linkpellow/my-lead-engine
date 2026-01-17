'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Wifi, 
  WifiOff, 
  Smartphone, 
  SmartphoneNfc,
  Power,
  PowerOff,
  RefreshCw
} from 'lucide-react';

interface ProxyStatus {
  isProxyOnline: boolean;
  clientCount: number;
  captureEnabled: boolean;
}

export default function ProxyStatusBar() {
  const [status, setStatus] = useState<ProxyStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);

  // Fetch status
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/dojo/status');
      const data = await response.json();
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Toggle capture
  const toggleCapture = async () => {
    if (!status) return;
    
    setIsToggling(true);
    try {
      const response = await fetch('/api/dojo/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !status.captureEnabled }),
      });
      
      const data = await response.json();
      if (data.captureEnabled !== undefined) {
        setStatus(prev => prev ? { ...prev, captureEnabled: data.captureEnabled } : null);
      }
    } catch {
      console.error('Toggle failed');
    } finally {
      setIsToggling(false);
    }
  };

  // Poll every 3 seconds
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
        <RefreshCw className="w-4 h-4 text-slate-500 animate-spin" />
        <span className="text-xs text-slate-500 font-mono">Loading...</span>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
        <WifiOff className="w-4 h-4 text-slate-500" />
        <span className="text-xs text-slate-500 font-mono">Offline</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 px-4 py-2.5">
      {/* Proxy Status */}
      <div className={`
        flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold font-mono
        ${status.isProxyOnline 
          ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
          : 'bg-slate-700/50 text-slate-400 border border-slate-600'
        }
      `}>
        {status.isProxyOnline ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
            </span>
            <Wifi className="w-3.5 h-3.5" />
            <span>PROXY ONLINE</span>
          </>
        ) : (
          <>
            <WifiOff className="w-3.5 h-3.5" />
            <span>PROXY OFFLINE</span>
          </>
        )}
      </div>

      {/* Device Status */}
      <div className={`
        flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold font-mono
        ${status.clientCount > 0 
          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
          : 'bg-slate-700/50 text-slate-400 border border-slate-600'
        }
      `}>
        {status.clientCount > 0 ? (
          <>
            <SmartphoneNfc className="w-3.5 h-3.5" />
            <span>{status.clientCount} DEVICE{status.clientCount > 1 ? 'S' : ''}</span>
          </>
        ) : (
          <>
            <Smartphone className="w-3.5 h-3.5 opacity-50" />
            <span>NO DEVICE</span>
          </>
        )}
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-slate-700/50" />

      {/* Master Switch */}
      <button
        onClick={toggleCapture}
        disabled={isToggling || !status.isProxyOnline}
        className={`
          flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold font-mono transition-all
          ${status.captureEnabled
            ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
            : 'bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      >
        {isToggling ? (
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        ) : status.captureEnabled ? (
          <>
            <Power className="w-3.5 h-3.5" />
            <span>CAPTURING</span>
          </>
        ) : (
          <>
            <PowerOff className="w-3.5 h-3.5" />
            <span>PAUSED</span>
          </>
        )}
      </button>
    </div>
  );
}
