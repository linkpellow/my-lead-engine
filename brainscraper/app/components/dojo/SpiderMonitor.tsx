'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Bug,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ExternalLink,
  Play,
  Pause,
  ChevronDown,
  ChevronRight,
  Github,
} from 'lucide-react';

interface SpiderStatus {
  id: string;
  domain: string;
  filename: string;
  health: number;
  healthStatus: 'healthy' | 'degraded' | 'broken' | 'unknown';
  lastRunAt?: number;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  lastError?: string;
  deployedAt: number;
  githubUrl?: string;
  runHistory?: Array<{
    runId: string;
    startedAt: number;
    completedAt?: number;
    status: string;
    itemsScraped: number;
    errors: string[];
    duration?: number;
  }>;
}

interface SpiderStats {
  total: number;
  healthy: number;
  degraded: number;
  broken: number;
  unknown: number;
  avgHealth: number;
}

interface SpiderMonitorProps {
  onRefresh?: () => void;
  focusDomain?: string;
}

const HEALTH_COLORS = {
  healthy: 'text-green-400 bg-green-500/20 border-green-500/30',
  degraded: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30',
  broken: 'text-red-400 bg-red-500/20 border-red-500/30',
  unknown: 'text-slate-400 bg-slate-500/20 border-slate-500/30',
};

const HEALTH_ICONS = {
  healthy: <CheckCircle className="w-4 h-4" />,
  degraded: <AlertTriangle className="w-4 h-4" />,
  broken: <XCircle className="w-4 h-4" />,
  unknown: <Activity className="w-4 h-4" />,
};

function formatTimeAgo(timestamp?: number): string {
  if (!timestamp) return 'Never';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function HealthBadge({ status, health }: { status: string; health: number }) {
  const colorClass = HEALTH_COLORS[status as keyof typeof HEALTH_COLORS] || HEALTH_COLORS.unknown;
  const icon = HEALTH_ICONS[status as keyof typeof HEALTH_ICONS] || HEALTH_ICONS.unknown;
  
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${colorClass}`}>
      {icon}
      <span className="text-xs font-bold font-mono">{health}%</span>
    </div>
  );
}

function HealthBar({ health }: { health: number }) {
  const color = health >= 80 ? 'bg-green-500' : health >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  
  return (
    <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
      <div 
        className={`h-full ${color} transition-all duration-500`}
        style={{ width: `${health}%` }}
      />
    </div>
  );
}

export default function SpiderMonitor({ onRefresh, focusDomain }: SpiderMonitorProps) {
  const [spiders, setSpiders] = useState<SpiderStatus[]>([]);
  const [stats, setStats] = useState<SpiderStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSpider, setExpandedSpider] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchSpiders = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (focusDomain) params.set('domain', focusDomain);
      
      const response = await fetch(`/api/dojo/spiders?${params.toString()}`);
      const data = await response.json();
      
      if (data.success) {
        setSpiders(data.spiders);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('[SpiderMonitor] Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [focusDomain]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    fetchSpiders();
    
    if (autoRefresh) {
      const interval = setInterval(fetchSpiders, 10000);
      return () => clearInterval(interval);
    }
  }, [fetchSpiders, autoRefresh]);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="flex items-center justify-center h-full">
          <RefreshCw className="w-5 h-5 text-slate-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700/50 bg-slate-800/50">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-semibold text-slate-200 font-mono">SPIDER MONITOR</span>
          {stats && (
            <span className="text-xs text-slate-500 font-mono">
              ({stats.total} deployed)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1 px-2 py-1 text-[10px] font-mono rounded border transition-colors ${
              autoRefresh 
                ? 'text-green-400 bg-green-500/10 border-green-500/30' 
                : 'text-slate-400 bg-slate-500/10 border-slate-500/30'
            }`}
          >
            {autoRefresh ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            AUTO
          </button>
          
          {/* Manual refresh */}
          <button
            onClick={fetchSpiders}
            className="p-1 hover:bg-slate-700/50 rounded transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && stats.total > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 border-b border-slate-700/30 bg-slate-800/30">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-[10px] font-mono text-slate-400">{stats.healthy} healthy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-yellow-400" />
            <span className="text-[10px] font-mono text-slate-400">{stats.degraded} degraded</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-[10px] font-mono text-slate-400">{stats.broken} broken</span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            <Activity className="w-3 h-3 text-slate-500" />
            <span className="text-[10px] font-mono text-slate-400">Avg: {stats.avgHealth}%</span>
          </div>
        </div>
      )}

      {/* Spider List */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-700">
        {spiders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 p-4">
            <Bug className="w-10 h-10 mb-3 opacity-50" />
            <p className="text-sm font-mono">No spiders deployed</p>
            <p className="text-xs mt-1 text-center">
              Generate and deploy spiders<br/>from mapped routes
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {spiders.map((spider) => {
              const isExpanded = expandedSpider === spider.id;
              const successRate = spider.totalRuns > 0 
                ? Math.round((spider.successfulRuns / spider.totalRuns) * 100) 
                : 0;
              
              return (
                <div 
                  key={spider.id}
                  className={`border rounded-lg overflow-hidden transition-colors ${
                    spider.healthStatus === 'broken' 
                      ? 'border-red-500/50 bg-red-500/5' 
                      : 'border-slate-700/50 bg-slate-800/30'
                  }`}
                >
                  {/* Spider Header */}
                  <button
                    onClick={() => setExpandedSpider(isExpanded ? null : spider.id)}
                    className="w-full flex items-center gap-2 p-2.5 hover:bg-white/5 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    )}
                    
                    <Bug className="w-4 h-4 text-purple-400" />
                    
                    <div className="flex-1 text-left">
                      <div className="font-mono text-sm text-slate-200">{spider.id}</div>
                      <div className="text-[10px] text-slate-500">{spider.domain}</div>
                    </div>
                    
                    <HealthBadge status={spider.healthStatus} health={spider.health} />
                  </button>
                  
                  {/* Health Bar */}
                  <div className="px-3 pb-2">
                    <HealthBar health={spider.health} />
                  </div>
                  
                  {/* Quick Stats */}
                  <div className="flex items-center gap-4 px-3 pb-2 text-[10px] font-mono text-slate-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTimeAgo(spider.lastRunAt)}
                    </div>
                    <div className="flex items-center gap-1">
                      {successRate >= 80 ? (
                        <TrendingUp className="w-3 h-3 text-green-400" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-red-400" />
                      )}
                      {successRate}% success
                    </div>
                    <div>{spider.totalRuns} runs</div>
                  </div>
                  
                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-slate-700/30 bg-slate-900/50 p-3 space-y-3">
                      {/* GitHub Link */}
                      {spider.githubUrl && (
                        <a
                          href={spider.githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-slate-400 hover:text-purple-400 transition-colors"
                        >
                          <Github className="w-3 h-3" />
                          View on GitHub
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      
                      {/* Deployment Info */}
                      <div className="text-xs font-mono text-slate-500">
                        <div>Deployed: {new Date(spider.deployedAt).toLocaleString()}</div>
                        <div>File: {spider.filename}</div>
                      </div>
                      
                      {/* Run Stats */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-slate-800/50 rounded p-2">
                          <div className="text-lg font-bold text-slate-200">{spider.totalRuns}</div>
                          <div className="text-[10px] text-slate-500">Total Runs</div>
                        </div>
                        <div className="bg-green-500/10 rounded p-2">
                          <div className="text-lg font-bold text-green-400">{spider.successfulRuns}</div>
                          <div className="text-[10px] text-slate-500">Successful</div>
                        </div>
                        <div className="bg-red-500/10 rounded p-2">
                          <div className="text-lg font-bold text-red-400">{spider.failedRuns}</div>
                          <div className="text-[10px] text-slate-500">Failed</div>
                        </div>
                      </div>
                      
                      {/* Last Error */}
                      {spider.lastError && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded p-2">
                          <div className="text-[10px] text-red-400 font-mono mb-1">LAST ERROR</div>
                          <div className="text-xs text-red-300 font-mono">{spider.lastError}</div>
                        </div>
                      )}
                      
                      {/* Recent Runs */}
                      {spider.runHistory && spider.runHistory.length > 0 && (
                        <div>
                          <div className="text-[10px] text-slate-500 font-mono mb-1">RECENT RUNS</div>
                          <div className="space-y-1">
                            {spider.runHistory.slice(0, 5).map((run) => (
                              <div 
                                key={run.runId}
                                className="flex items-center gap-2 text-[10px] font-mono"
                              >
                                <div className={`w-2 h-2 rounded-full ${
                                  run.status === 'success' ? 'bg-green-400' :
                                  run.status === 'running' ? 'bg-blue-400 animate-pulse' :
                                  'bg-red-400'
                                }`} />
                                <span className="text-slate-400">
                                  {new Date(run.startedAt).toLocaleTimeString()}
                                </span>
                                <span className={
                                  run.status === 'success' ? 'text-green-400' :
                                  run.status === 'running' ? 'text-blue-400' :
                                  'text-red-400'
                                }>
                                  {run.status}
                                </span>
                                {run.itemsScraped > 0 && (
                                  <span className="text-slate-500">
                                    ({run.itemsScraped} items)
                                  </span>
                                )}
                                {run.duration && (
                                  <span className="text-slate-600">
                                    {run.duration}ms
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
