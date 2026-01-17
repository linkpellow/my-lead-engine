'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Radio, Clock, Filter } from 'lucide-react';
import type { CapturedRequest, HttpMethod } from '@/app/dojo/types';
import { getFaviconUrl } from '@/app/dojo/types';

interface TrafficStreamProps {
  requests: CapturedRequest[];
  isLive: boolean;
  onToggleLive: () => void;
  onSelectRequest: (id: string) => void;
  selectedRequestId?: string;
  focusDomain?: string;
  onFilterDomain: (domain: string | undefined) => void;
}

// Black and white color system for HTTP methods
const METHOD_COLORS: Record<HttpMethod, { text: string; bg: string; glow: string }> = {
  GET: { 
    text: 'text-white', 
    bg: 'bg-white/20', 
    glow: '' 
  },
  POST: { 
    text: 'text-white', 
    bg: 'bg-white/20', 
    glow: '' 
  },
  PUT: { 
    text: 'text-white', 
    bg: 'bg-white/20', 
    glow: '' 
  },
  PATCH: { 
    text: 'text-white', 
    bg: 'bg-white/20', 
    glow: '' 
  },
  DELETE: { 
    text: 'text-white', 
    bg: 'bg-white/20', 
    glow: '' 
  },
  OPTIONS: { 
    text: 'text-gray-400', 
    bg: 'bg-white/20', 
    glow: '' 
  },
  HEAD: { 
    text: 'text-gray-400', 
    bg: 'bg-white/20', 
    glow: '' 
  },
};

export default function TrafficStream({
  requests,
  isLive,
  onToggleLive,
  onSelectRequest,
  selectedRequestId,
  focusDomain,
  onFilterDomain,
}: TrafficStreamProps) {
  const [newRequestIds, setNewRequestIds] = useState<Set<string>>(new Set());
  const prevRequestsRef = useRef<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  // Detect new requests and trigger pulse animation
  useEffect(() => {
    const currentIds = requests.map(r => r.id);
    const prevIds = new Set(prevRequestsRef.current);
    const newIds = currentIds.filter(id => !prevIds.has(id));
    
    if (newIds.length > 0) {
      setNewRequestIds(new Set(newIds));
      // Clear the "new" state after animation completes
      setTimeout(() => {
        setNewRequestIds(new Set());
      }, 1000);
      
      // Auto-scroll to bottom for new traffic
      if (listRef.current && isLive) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }
    
    prevRequestsRef.current = currentIds;
  }, [requests, isLive]);

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-white';
    if (status >= 300 && status < 400) return 'text-gray-400';
    if (status >= 400 && status < 500) return 'text-gray-300';
    if (status >= 500) return 'text-white';
    return 'text-gray-400';
  };

  const getStatusBg = (status: number) => {
    if (status >= 200 && status < 300) return 'bg-white/10';
    if (status >= 400) return 'bg-white/10';
    return 'bg-white/10';
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatPath = (url: string) => {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname + parsed.search;
      return path.length > 45 ? path.substring(0, 42) + '...' : path;
    } catch {
      return url.length > 45 ? url.substring(0, 42) + '...' : url;
    }
  };

  // Get unique domains for filter dropdown
  const uniqueDomains = [...new Set(requests.map(r => r.domain))];

  // Filter requests by domain if set
  const filteredRequests = focusDomain 
    ? requests.filter(r => r.domain === focusDomain)
    : requests;

  return (
    <div className="h-full flex flex-col bg-black/80 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/20 bg-black/50">
        <div className="flex items-center gap-2">
          <Radio className={`w-4 h-4 ${isLive ? 'text-white animate-pulse' : 'text-gray-500'}`} />
          <span className="text-sm font-semibold text-white font-mono">TRAFFIC</span>
          <span className="text-xs text-gray-500 font-mono">({filteredRequests.length})</span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Domain Filter */}
          {uniqueDomains.length > 1 && (
            <div className="relative">
              <select
                value={focusDomain || ''}
                onChange={(e) => onFilterDomain(e.target.value || undefined)}
                className="appearance-none bg-black/80 border border-white/20 rounded-lg px-2 py-1 pr-6 text-xs text-gray-300 font-mono focus:outline-none focus:border-white cursor-pointer"
              >
                <option value="">All Domains</option>
                {uniqueDomains.map(domain => (
                  <option key={domain} value={domain}>{domain}</option>
                ))}
              </select>
              <Filter className="w-3 h-3 text-gray-500 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
          
          {/* Live Toggle */}
          <button
            onClick={onToggleLive}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all
              ${isLive 
                ? 'bg-white/20 text-white border border-white/30 hover:bg-white/30' 
                : 'bg-gray-700/50 text-gray-400 border border-gray-600 hover:bg-gray-700'
              }
            `}
          >
            {isLive ? (
              <>
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                LIVE
              </>
            ) : (
              <>
                <Pause className="w-3 h-3" />
                PAUSED
              </>
            )}
          </button>
        </div>
      </div>

      {/* Request List */}
      <div ref={listRef} className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700">
        {filteredRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
            <Radio className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm font-mono">No traffic captured</p>
            <p className="text-xs mt-1">Requests will stream here</p>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {filteredRequests.map((request) => {
              const methodStyle = METHOD_COLORS[request.method] || METHOD_COLORS.GET;
              const isNew = newRequestIds.has(request.id);
              const isSelected = selectedRequestId === request.id;
              
              return (
                <button
                  key={request.id}
                  onClick={() => onSelectRequest(request.id)}
                  className={`
                    w-full text-left p-2.5 transition-all relative
                    ${isSelected ? 'bg-white/20 border-l-2 border-white' : 'hover:bg-black/50'}
                    ${isNew ? 'animate-pulse-once' : ''}
                  `}
                  style={{
                    animation: isNew ? 'flashIn 0.6s ease-out' : undefined,
                  }}
                >
                  {/* Pulse glow overlay for new requests */}
                  {isNew && (
                    <div className="absolute inset-0 bg-white/10 animate-fade-out pointer-events-none" />
                  )}
                  
                  <div className="flex items-center gap-2">
                    {/* Favicon */}
                    <img
                      src={getFaviconUrl(request.domain)}
                      alt=""
                      className="w-4 h-4 rounded-sm"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    
                    {/* Method Pill */}
                    <span className={`
                      font-mono text-[10px] font-bold px-1.5 py-0.5 rounded
                      ${methodStyle.text} ${methodStyle.bg} ${methodStyle.glow}
                    `}>
                      {request.method}
                    </span>
                    
                    {/* Status Badge */}
                    <span className={`
                      font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded
                      ${getStatusColor(request.status)} ${getStatusBg(request.status)}
                    `}>
                      {request.status}
                    </span>
                    
                    {/* Duration */}
                    <span className="flex items-center gap-0.5 text-[10px] text-gray-500 font-mono ml-auto">
                      <Clock className="w-2.5 h-2.5" />
                      {formatDuration(request.duration)}
                    </span>
                  </div>
                  
                  {/* Path */}
                  <div className="font-mono text-xs text-gray-400 mt-1 truncate pl-6">
                    {formatPath(request.url)}
                  </div>
                  
                  {/* AI Summary */}
                  {request.summary && (
                    <div className="text-[10px] text-white mt-1 truncate pl-6">
                      💡 {request.summary}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
      
      {/* CSS for animations */}
      <style jsx>{`
        @keyframes flashIn {
          0% {
            background-color: rgba(255, 255, 255, 0.2);
          }
          100% {
            background-color: transparent;
          }
        }
        
        .animate-fade-out {
          animation: fadeOut 0.6s ease-out forwards;
        }
        
        @keyframes fadeOut {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
