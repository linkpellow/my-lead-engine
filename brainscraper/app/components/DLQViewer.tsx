'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw, Trash2, User, Clock, AlertCircle } from 'lucide-react';

interface DLQItem {
  index: number;
  lead_data: {
    linkedinUrl?: string;
    name?: string;
    location?: string;
    [key: string]: any;
  };
  error: string;
  retry_count: number;
  failed_at: string;
}

interface DLQViewerProps {
  compact?: boolean;
}

export default function DLQViewer({ compact = false }: DLQViewerProps) {
  const [items, setItems] = useState<DLQItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<number | 'all' | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchDLQ = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/pipeline/dlq?limit=100');
      const data = await response.json();
      
      if (data.success) {
        setItems(data.failed_leads || []);
        setTotal(data.total || 0);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch failed leads');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDLQ();
  }, []);

  const handleRetryOne = async (index: number) => {
    setRetrying(index);
    setActionMessage(null);
    
    try {
      const response = await fetch('/api/pipeline/dlq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry_one', index }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setActionMessage({ type: 'success', text: 'Lead re-queued for processing' });
        // Refresh the list
        await fetchDLQ();
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to retry lead' });
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Failed to retry lead' });
    } finally {
      setRetrying(null);
    }
  };

  const handleRetryAll = async () => {
    if (items.length === 0) return;
    
    const confirmed = window.confirm(`Are you sure you want to retry all ${total} failed leads?`);
    if (!confirmed) return;
    
    setRetrying('all');
    setActionMessage(null);
    
    try {
      const response = await fetch('/api/pipeline/dlq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry_all' }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setActionMessage({ 
          type: 'success', 
          text: `${data.retried_count || 0} leads re-queued for processing` 
        });
        // Refresh the list
        await fetchDLQ();
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to retry leads' });
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Failed to retry leads' });
    } finally {
      setRetrying(null);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === 'Unknown') return 'Unknown';
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const getLeadName = (item: DLQItem) => {
    return item.lead_data?.name || 
           item.lead_data?.linkedinUrl?.split('/').pop() || 
           'Unknown Lead';
  };

  if (loading) {
    return (
      <div className="panel-inactive rounded-xl p-6">
        <div className="flex items-center justify-center gap-2 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading failed leads...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel-inactive rounded-xl p-6 border border-red-500/30">
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-400 font-medium">Failed to Load DLQ</p>
          <p className="text-sm text-slate-500 mt-1">{error}</p>
          <button
            onClick={fetchDLQ}
            className="mt-3 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="panel-inactive rounded-xl p-6">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-green-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-200">No Failed Leads</h3>
          <p className="text-sm text-slate-500 mt-1">
            All leads are processing successfully
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-inactive rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <h3 className="text-lg font-semibold text-slate-200">
            Failed Leads
          </h3>
          <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full">
            {total}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={fetchDLQ}
            className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
            title="Refresh list"
          >
            <RefreshCw className="w-4 h-4 text-slate-400" />
          </button>
          
          <button
            onClick={handleRetryAll}
            disabled={retrying !== null}
            className="flex items-center gap-2 px-4 py-2 bg-[#8055a6] hover:bg-[#6a4589] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
          >
            {retrying === 'all' ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            Retry All
          </button>
        </div>
      </div>

      {/* Action Message */}
      {actionMessage && (
        <div className={`px-4 py-2 text-sm ${
          actionMessage.type === 'success' 
            ? 'bg-green-500/10 text-green-400 border-b border-green-500/30' 
            : 'bg-red-500/10 text-red-400 border-b border-red-500/30'
        }`}>
          {actionMessage.text}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-800/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Lead
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Error
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Retries
              </th>
              {!compact && (
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Failed At
                </th>
              )}
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {items.map((item) => (
              <tr key={item.index} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-500" />
                    <div>
                      <div className="text-sm font-medium text-slate-200">
                        {getLeadName(item)}
                      </div>
                      {item.lead_data?.location && (
                        <div className="text-xs text-slate-500">
                          {item.lead_data.location}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-start gap-2 max-w-xs">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-red-400 truncate" title={item.error}>
                      {item.error.length > 50 ? `${item.error.substring(0, 50)}...` : item.error}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-sm font-medium ${
                    item.retry_count >= 3 ? 'text-red-400' : 'text-slate-400'
                  }`}>
                    {item.retry_count}
                  </span>
                </td>
                {!compact && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="w-3 h-3" />
                      {formatDate(item.failed_at)}
                    </div>
                  </td>
                )}
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleRetryOne(item.index)}
                    disabled={retrying !== null}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs font-medium transition-colors"
                  >
                    {retrying === item.index ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3 h-3" />
                    )}
                    Retry
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {total > items.length && (
        <div className="px-4 py-3 bg-slate-800/30 text-center text-sm text-slate-500">
          Showing {items.length} of {total} failed leads
        </div>
      )}
    </div>
  );
}
