'use client';

import AppLayout from '../components/AppLayout';
import QueueMonitor from '../components/QueueMonitor';
import DLQViewer from '../components/DLQViewer';
import { Activity, Wifi, WifiOff, Database, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';

interface PipelineHealth {
  status: 'healthy' | 'degraded';
  redis: 'connected' | 'disconnected';
  redis_url_configured: boolean;
  error?: string | null;
}

export default function PipelinePage() {
  const [health, setHealth] = useState<PipelineHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    try {
      const response = await fetch('/api/pipeline/status');
      const data = await response.json();
      if (data.success) {
        setHealth(data.health);
      }
    } catch (error) {
      console.error('Failed to fetch pipeline health:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AppLayout>
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#e272db] via-[#8055a6] to-[#54317d] bg-clip-text text-transparent">
              Enrichment Pipeline
            </h1>
            <p className="text-slate-400 mt-1">
              Monitor queue status, worker health, and manage failed leads
            </p>
          </div>
          <button
            onClick={fetchHealth}
            className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Worker Health Card */}
        <div className="panel-inactive rounded-xl p-6">
          <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-[#e272db]" />
            Worker Health
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Overall Status */}
            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                {health?.status === 'healthy' ? (
                  <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                    <Wifi className="w-5 h-5 text-green-400" />
                  </div>
                ) : (
                  <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
                    <WifiOff className="w-5 h-5 text-yellow-400" />
                  </div>
                )}
                <div>
                  <div className="text-sm text-slate-400">Status</div>
                  <div className={`font-semibold ${
                    health?.status === 'healthy' ? 'text-green-400' : 'text-yellow-400'
                  }`}>
                    {loading ? 'Loading...' : (health?.status === 'healthy' ? 'Healthy' : 'Degraded')}
                  </div>
                </div>
              </div>
            </div>

            {/* Redis Connection */}
            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 ${
                  health?.redis === 'connected' ? 'bg-green-500/20' : 'bg-red-500/20'
                } rounded-full flex items-center justify-center`}>
                  <Database className={`w-5 h-5 ${
                    health?.redis === 'connected' ? 'text-green-400' : 'text-red-400'
                  }`} />
                </div>
                <div>
                  <div className="text-sm text-slate-400">Redis</div>
                  <div className={`font-semibold ${
                    health?.redis === 'connected' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {loading ? 'Loading...' : (health?.redis === 'connected' ? 'Connected' : 'Disconnected')}
                  </div>
                </div>
              </div>
            </div>

            {/* Configuration Status */}
            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 ${
                  health?.redis_url_configured ? 'bg-green-500/20' : 'bg-yellow-500/20'
                } rounded-full flex items-center justify-center`}>
                  <Activity className={`w-5 h-5 ${
                    health?.redis_url_configured ? 'text-green-400' : 'text-yellow-400'
                  }`} />
                </div>
                <div>
                  <div className="text-sm text-slate-400">Config</div>
                  <div className={`font-semibold ${
                    health?.redis_url_configured ? 'text-green-400' : 'text-yellow-400'
                  }`}>
                    {loading ? 'Loading...' : (health?.redis_url_configured ? 'Configured' : 'Not Set')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {health?.error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              {health.error}
            </div>
          )}
        </div>

        {/* Queue Monitor & DLQ Viewer Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <QueueMonitor />
          <DLQViewer compact />
        </div>
      </div>
    </AppLayout>
  );
}
