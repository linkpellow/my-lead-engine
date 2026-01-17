'use client';

import { useState, useEffect } from 'react';
import { Activity, TrendingUp, TrendingDown, Minus, RefreshCw, Clock } from 'lucide-react';

interface QueueStats {
  leads_to_enrich: number;
  failed_leads: number;
  status: 'active' | 'inactive';
}

interface QueueHistory {
  timestamp: Date;
  count: number;
}

export default function QueueMonitor() {
  const [currentStats, setCurrentStats] = useState<QueueStats | null>(null);
  const [history, setHistory] = useState<QueueHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/pipeline/status');
      const data = await response.json();
      
      if (data.success) {
        const newStats = data.queue;
        setCurrentStats(newStats);
        
        // Add to history (keep last 30 data points)
        setHistory(prev => {
          const updated = [...prev, { 
            timestamp: new Date(), 
            count: newStats.leads_to_enrich 
          }];
          return updated.slice(-30);
        });
        
        setError(null);
      } else {
        setError(data.health?.error || 'Failed to fetch queue status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const getTrend = () => {
    if (history.length < 2) return 'stable';
    const recent = history.slice(-5);
    const first = recent[0]?.count || 0;
    const last = recent[recent.length - 1]?.count || 0;
    
    if (last > first + 2) return 'increasing';
    if (last < first - 2) return 'decreasing';
    return 'stable';
  };

  const trend = getTrend();
  const TrendIcon = trend === 'increasing' ? TrendingUp : trend === 'decreasing' ? TrendingDown : Minus;
  const trendColor = trend === 'increasing' ? 'text-yellow-400' : trend === 'decreasing' ? 'text-green-400' : 'text-slate-400';

  const getProcessingRate = () => {
    if (history.length < 2) return null;
    const recent = history.slice(-6); // Last minute of data (6 x 10s intervals)
    if (recent.length < 2) return null;
    
    const first = recent[0].count;
    const last = recent[recent.length - 1].count;
    const diff = first - last;
    
    if (diff <= 0) return null;
    
    // Calculate rate per minute
    const timeSpanMinutes = (recent.length - 1) * 10 / 60;
    return Math.round(diff / timeSpanMinutes);
  };

  const processingRate = getProcessingRate();

  if (loading) {
    return (
      <div className="panel-inactive rounded-xl p-6">
        <div className="flex items-center justify-center gap-2 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading queue status...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel-inactive rounded-xl p-6 border border-red-500/30">
        <div className="text-center">
          <Activity className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-400 font-medium">Queue Monitor Error</p>
          <p className="text-sm text-slate-500 mt-1">{error}</p>
          <button
            onClick={fetchStats}
            className="mt-3 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-inactive rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#e272db]" />
          Queue Monitor
        </h3>
        <button
          onClick={fetchStats}
          className="p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 gap-4">
        {/* Pending Leads */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Pending</span>
            <TrendIcon className={`w-4 h-4 ${trendColor}`} />
          </div>
          <div className="text-3xl font-bold text-blue-400">
            {currentStats?.leads_to_enrich || 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            leads awaiting enrichment
          </div>
        </div>

        {/* Failed Leads */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Failed</span>
            {(currentStats?.failed_leads || 0) > 0 && (
              <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                Needs attention
              </span>
            )}
          </div>
          <div className={`text-3xl font-bold ${
            (currentStats?.failed_leads || 0) > 0 ? 'text-red-400' : 'text-slate-500'
          }`}>
            {currentStats?.failed_leads || 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            leads in dead letter queue
          </div>
        </div>
      </div>

      {/* Processing Rate */}
      {processingRate !== null && (
        <div className="bg-gradient-to-r from-[#e272db]/10 to-[#8055a6]/10 rounded-lg p-4 border border-[#8055a6]/30">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#e272db]" />
            <span className="text-sm text-slate-300">
              Processing at approximately{' '}
              <span className="font-semibold text-[#e272db]">{processingRate}</span>{' '}
              leads/min
            </span>
          </div>
        </div>
      )}

      {/* Queue Status */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">Queue Status</span>
        <span className={`font-medium ${
          currentStats?.status === 'active' ? 'text-green-400' : 'text-slate-500'
        }`}>
          {currentStats?.status === 'active' ? '● Active' : '○ Inactive'}
        </span>
      </div>

      {/* Mini Sparkline (visual representation of history) */}
      {history.length > 1 && (
        <div className="pt-2 border-t border-slate-700/50">
          <div className="text-xs text-slate-500 mb-2">Queue depth (last 5 min)</div>
          <div className="flex items-end gap-1 h-8">
            {history.slice(-30).map((point, i) => {
              const maxCount = Math.max(...history.map(h => h.count), 1);
              const height = (point.count / maxCount) * 100;
              return (
                <div
                  key={i}
                  className="flex-1 bg-[#8055a6]/50 rounded-t"
                  style={{ height: `${Math.max(height, 5)}%` }}
                  title={`${point.count} leads at ${point.timestamp.toLocaleTimeString()}`}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
