'use client';

import { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/AppLayout';
import SpiderCard from '../components/spiders/SpiderCard';
import { 
  Bug, 
  RefreshCw, 
  Search, 
  Filter,
  Loader2,
  FolderOpen,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import type { SpiderBot, SpiderListResponse } from './types';

const SCRAPEGOAT_URL = process.env.NEXT_PUBLIC_SCRAPEGOAT_URL || '';

export default function SpidersPage() {
  const [spiders, setSpiders] = useState<SpiderBot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'idle' | 'running' | 'error' | 'success'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchSpiders = useCallback(async () => {
    try {
      const response = await fetch('/api/spiders');
      const data: SpiderListResponse = await response.json();
      
      if (data.spiders) {
        setSpiders(data.spiders);
        setError(null);
      } else {
        throw new Error('Invalid response');
      }
    } catch (err) {
      console.error('Failed to fetch spiders:', err);
      setError(err instanceof Error ? err.message : 'Failed to load spiders');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSpiders();
    
    // Poll every 10 seconds for status updates
    const interval = setInterval(fetchSpiders, 10000);
    return () => clearInterval(interval);
  }, [fetchSpiders]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchSpiders();
  };

  const handleRunSpider = async (spiderId: string) => {
    try {
      const response = await fetch(`/api/spiders/${spiderId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Update local state to show running
        setSpiders(prev => prev.map(s => 
          s.id === spiderId ? { ...s, status: 'running' as const } : s
        ));
      } else {
        throw new Error(data.message || 'Failed to run spider');
      }
    } catch (err) {
      console.error('Failed to run spider:', err);
      alert(err instanceof Error ? err.message : 'Failed to run spider');
    }
  };

  const handleDeleteSpider = async (spiderId: string) => {
    try {
      const response = await fetch(`/api/spiders/${spiderId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Remove from local state
        setSpiders(prev => prev.filter(s => s.id !== spiderId));
      } else {
        throw new Error(data.message || 'Failed to archive spider');
      }
    } catch (err) {
      console.error('Failed to delete spider:', err);
      alert(err instanceof Error ? err.message : 'Failed to archive spider');
    }
  };

  // Filter spiders
  const filteredSpiders = spiders.filter(spider => {
    const matchesSearch = searchQuery === '' || 
      spider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      spider.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      spider.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || spider.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = {
    total: spiders.length,
    running: spiders.filter(s => s.status === 'running').length,
    idle: spiders.filter(s => s.status === 'idle').length,
    error: spiders.filter(s => s.status === 'error').length,
    totalLeads: spiders.reduce((sum, s) => sum + s.totalLeads, 0),
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-[#e272db]/20 to-[#8055a6]/20 rounded-xl border border-[#e272db]/20">
              <Bug className="w-8 h-8 text-[#e272db]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100 font-mono flex items-center gap-2">
                Spider Fleet
                <span className="text-sm font-normal text-slate-500">
                  ({stats.total} bots)
                </span>
              </h1>
              <p className="text-sm text-slate-500">
                Manage and monitor your deployed scraper bots
              </p>
            </div>
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-4">
            <div className="text-[10px] text-slate-500 font-mono mb-1">TOTAL BOTS</div>
            <div className="text-2xl font-bold text-slate-200 font-mono">{stats.total}</div>
          </div>
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-4">
            <div className="text-[10px] text-slate-500 font-mono mb-1">RUNNING</div>
            <div className="text-2xl font-bold text-yellow-400 font-mono">{stats.running}</div>
          </div>
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-4">
            <div className="text-[10px] text-slate-500 font-mono mb-1">IDLE</div>
            <div className="text-2xl font-bold text-slate-400 font-mono">{stats.idle}</div>
          </div>
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-4">
            <div className="text-[10px] text-slate-500 font-mono mb-1">ERRORS</div>
            <div className="text-2xl font-bold text-red-400 font-mono">{stats.error}</div>
          </div>
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-4">
            <div className="text-[10px] text-slate-500 font-mono mb-1">TOTAL LEADS</div>
            <div className="text-2xl font-bold text-cyan-400 font-mono">{stats.totalLeads.toLocaleString()}</div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search spiders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#e272db]/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="px-3 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-[#e272db]/50"
            >
              <option value="all">All Status</option>
              <option value="idle">Idle</option>
              <option value="running">Running</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
            </select>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#e272db] animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
            <h3 className="text-lg font-bold text-slate-200 mb-2">Failed to Load Spiders</h3>
            <p className="text-sm text-slate-500 mb-4">{error}</p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : filteredSpiders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            {spiders.length === 0 ? (
              <>
                <FolderOpen className="w-12 h-12 text-slate-600 mb-4" />
                <h3 className="text-lg font-bold text-slate-200 mb-2">No Spiders Deployed</h3>
                <p className="text-sm text-slate-500 mb-4 max-w-md">
                  Your spider fleet is empty. Use The Dojo to capture API traffic and deploy your first scraper bot.
                </p>
                <a
                  href="/dojo"
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#e272db] to-[#8055a6] text-white rounded-lg text-sm font-bold transition-opacity hover:opacity-90"
                >
                  <Sparkles className="w-4 h-4" />
                  Open The Dojo
                </a>
              </>
            ) : (
              <>
                <Search className="w-12 h-12 text-slate-600 mb-4" />
                <h3 className="text-lg font-bold text-slate-200 mb-2">No Matching Spiders</h3>
                <p className="text-sm text-slate-500">
                  No spiders match your search or filter criteria.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSpiders.map(spider => (
              <SpiderCard
                key={spider.id}
                spider={spider}
                onRun={handleRunSpider}
                onDelete={handleDeleteSpider}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
