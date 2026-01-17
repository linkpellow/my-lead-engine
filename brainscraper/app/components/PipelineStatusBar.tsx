'use client';

import { useState, useEffect } from 'react';
import { Activity, Users, AlertTriangle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import Link from 'next/link';

interface PipelineStatus {
  success: boolean;
  health: {
    status: 'healthy' | 'degraded';
    redis: 'connected' | 'disconnected';
    redis_url_configured: boolean;
    error?: string | null;
  };
  queue: {
    leads_to_enrich: number;
    failed_leads: number;
    status: 'active' | 'inactive';
  };
  timestamp: string;
}

export default function PipelineStatusBar() {
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/pipeline/status');
      const data = await response.json();
      setStatus(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch pipeline status:', error);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    
    // Poll every 10 seconds
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const getWorkerStatus = () => {
    if (!status) return { icon: WifiOff, color: 'text-gray-500', label: 'Offline' };
    if (status.health.status === 'healthy') {
      return { icon: Wifi, color: 'text-white', label: 'Online' };
    }
    return { icon: WifiOff, color: 'text-gray-400', label: 'Degraded' };
  };

  const workerStatus = getWorkerStatus();
  const WorkerIcon = workerStatus.icon;

  if (loading) {
    return (
      <div className="w-full bg-black/80 border-b border-white/20 px-4 py-2">
        <div className="flex items-center justify-center gap-2 text-gray-500">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-xs">Loading pipeline status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-black/80 border-b border-white/20 px-4 py-2">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        {/* Left: Status Indicators */}
        <div className="flex items-center gap-6">
          {/* Worker Status */}
          <div className="flex items-center gap-2">
            <WorkerIcon className={`w-4 h-4 ${workerStatus.color}`} />
            <span className={`text-xs font-medium ${workerStatus.color}`}>
              Workers: {workerStatus.label}
            </span>
          </div>

          {/* Queue Depth */}
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-white" />
            <span className="text-xs text-gray-300">
              Queue:{' '}
              <span className={`font-semibold ${
                (status?.queue.leads_to_enrich || 0) > 50 
                  ? 'text-gray-400' 
                  : 'text-white'
              }`}>
                {status?.queue.leads_to_enrich || 0}
              </span>
            </span>
          </div>

          {/* Failed Leads */}
          <Link 
            href="/pipeline/failed"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <AlertTriangle className={`w-4 h-4 ${
              (status?.queue.failed_leads || 0) > 0 
                ? 'text-white' 
                : 'text-gray-500'
            }`} />
            <span className="text-xs text-gray-300">
              Failed:{' '}
              <span className={`font-semibold ${
                (status?.queue.failed_leads || 0) > 0 
                  ? 'text-white' 
                  : 'text-gray-500'
              }`}>
                {status?.queue.failed_leads || 0}
              </span>
            </span>
          </Link>
        </div>

        {/* Right: Actions & Info */}
        <div className="flex items-center gap-4">
          {/* Last Updated */}
          {lastUpdated && (
            <span className="text-xs text-gray-500">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}

          {/* Refresh Button */}
          <button
            onClick={fetchStatus}
            className="p-1 rounded hover:bg-gray-700/50 transition-colors"
            title="Refresh status"
          >
            <RefreshCw className="w-3.5 h-3.5 text-gray-400 hover:text-gray-200" />
          </button>

          {/* Pipeline Link */}
          <Link
            href="/pipeline"
            className="text-xs text-white hover:text-gray-300 transition-colors font-medium"
          >
            View Pipeline →
          </Link>
        </div>
      </div>
    </div>
  );
}
