'use client';

import { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Star,
  Eye,
  EyeOff,
  Zap,
  Filter,
} from 'lucide-react';
import { 
  classifyRequest, 
  groupByDomain, 
  getTrafficStats,
  type ClassifiedRequest,
  type DomainSummary,
  type GroupedRequests,
} from '@/utils/requestClassifier';
import type { CapturedRequest } from '@/app/dojo/types';

interface SmartTrafficViewProps {
  requests: CapturedRequest[];
  targetDomain?: string;
  onSelectGroup: (group: GroupedRequests) => void;
  selectedGroupKey?: string;
}

// Method colors
const METHOD_COLORS: Record<string, string> = {
  GET: 'text-emerald-400',
  POST: 'text-blue-400',
  PUT: 'text-amber-400',
  DELETE: 'text-red-400',
  PATCH: 'text-purple-400',
};

function DomainCard({ 
  summary, 
  isExpanded, 
  onToggle,
  onSelectGroup,
  selectedGroupKey,
  showNoise,
}: { 
  summary: DomainSummary;
  isExpanded: boolean;
  onToggle: () => void;
  onSelectGroup: (group: GroupedRequests) => void;
  selectedGroupKey?: string;
  showNoise: boolean;
}) {
  const visibleGroups = showNoise 
    ? summary.groups 
    : summary.groups.filter(g => !g.isNoise);
  
  const hasGolden = summary.goldenRoutes > 0;
  const hasData = summary.dataEndpoints > 0;
  
  return (
    <div className={`rounded-xl border transition-all ${
      summary.isTargetSite 
        ? 'border-purple-500/50 bg-purple-500/5' 
        : hasGolden
        ? 'border-yellow-500/30 bg-yellow-500/5'
        : 'border-slate-700/50 bg-slate-800/30'
    }`}>
      {/* Domain Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors rounded-t-xl"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-500" />
        )}
        
        <img
          src={summary.favicon}
          alt=""
          className="w-5 h-5 rounded"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-200">{summary.domain}</span>
            {summary.isTargetSite && (
              <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded font-mono">
                TARGET
              </span>
            )}
          </div>
        </div>
        
        {/* Stats badges */}
        <div className="flex items-center gap-2">
          {hasGolden && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full font-mono">
              <Star className="w-3 h-3 fill-yellow-400" />
              {summary.goldenRoutes}
            </span>
          )}
          {hasData && (
            <span className="text-[10px] px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full font-mono">
              {summary.dataEndpoints} data
            </span>
          )}
          <span className="text-[10px] text-slate-500 font-mono">
            {summary.totalRequests}
          </span>
        </div>
      </button>
      
      {/* Expanded Routes */}
      {isExpanded && visibleGroups.length > 0 && (
        <div className="border-t border-slate-700/30">
          {visibleGroups.map((group) => (
            <button
              key={group.patternKey}
              onClick={() => onSelectGroup(group)}
              className={`w-full flex items-center gap-2 px-4 py-2.5 hover:bg-white/5 transition-colors text-left border-b border-slate-800/50 last:border-0 ${
                selectedGroupKey === group.patternKey ? 'bg-purple-500/10' : ''
              }`}
            >
              {/* Icon */}
              <span className="text-lg w-6 text-center">{group.icon}</span>
              
              {/* Label + Path */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-200 truncate">
                    {group.label}
                  </span>
                  {group.isGolden && (
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                  )}
                </div>
                <div className="text-[11px] text-slate-500 font-mono truncate">
                  {group.pathPattern}
                </div>
              </div>
              
              {/* Method + Count */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-[10px] font-bold font-mono ${METHOD_COLORS[group.method] || 'text-slate-400'}`}>
                  {group.method}
                </span>
                {group.count > 1 && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    ×{group.count}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
      
      {/* Empty state when expanded but no visible groups */}
      {isExpanded && visibleGroups.length === 0 && (
        <div className="px-4 py-3 text-xs text-slate-500 border-t border-slate-700/30">
          {showNoise ? 'No requests' : 'Only noise (tracking/ads) - toggle filter to see'}
        </div>
      )}
    </div>
  );
}

export default function SmartTrafficView({
  requests,
  targetDomain,
  onSelectGroup,
  selectedGroupKey,
}: SmartTrafficViewProps) {
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const [showNoise, setShowNoise] = useState(false);
  
  // Classify and group requests
  const { domainSummaries, stats } = useMemo(() => {
    const classified = requests.map(req => classifyRequest({
      id: req.id,
      url: req.url,
      method: req.method,
      status: req.status,
      timestamp: req.timestamp,
      duration: req.duration,
      responseSize: req.responseSize,
      contentType: req.headers?.['content-type'],
      responseBody: req.responseBody,
      extractedFields: req.extractedFields,
    }));
    
    return {
      domainSummaries: groupByDomain(classified, targetDomain),
      stats: getTrafficStats(classified),
    };
  }, [requests, targetDomain]);
  
  // Auto-expand target domain and domains with golden routes
  useMemo(() => {
    const autoExpand = new Set<string>();
    for (const summary of domainSummaries) {
      if (summary.isTargetSite || summary.goldenRoutes > 0) {
        autoExpand.add(summary.domain);
      }
    }
    if (autoExpand.size > 0 && expandedDomains.size === 0) {
      setExpandedDomains(autoExpand);
    }
  }, [domainSummaries]);
  
  const toggleDomain = (domain: string) => {
    setExpandedDomains(prev => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  };
  
  // Filter domains
  const visibleDomains = showNoise 
    ? domainSummaries 
    : domainSummaries.filter(d => d.dataEndpoints > 0 || d.goldenRoutes > 0 || d.isTargetSite);

  return (
    <div className="h-full flex flex-col bg-slate-900/50 rounded-2xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-800/30">
        <div className="flex items-center gap-3">
          <Zap className="w-4 h-4 text-purple-400" />
          <span className="font-semibold text-slate-200">Traffic</span>
          
          {/* Quick stats */}
          <div className="flex items-center gap-2 text-[11px] font-mono">
            {stats.golden > 0 && (
              <span className="flex items-center gap-1 text-yellow-400">
                <Star className="w-3 h-3 fill-yellow-400" />
                {stats.golden}
              </span>
            )}
            <span className="text-emerald-400">{stats.data} data</span>
            <span className="text-slate-500">{stats.domains} sites</span>
          </div>
        </div>
        
        {/* Filter toggle */}
        <button
          onClick={() => setShowNoise(!showNoise)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-mono transition-colors ${
            showNoise 
              ? 'bg-slate-700 text-slate-300' 
              : 'bg-purple-500/20 text-purple-400'
          }`}
        >
          {showNoise ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          {showNoise ? 'All' : 'Data only'}
        </button>
      </div>
      
      {/* Domain List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {visibleDomains.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 p-6">
            <Filter className="w-8 h-8 mb-3 opacity-50" />
            <p className="text-sm">No data endpoints found</p>
            <p className="text-xs mt-1">Browse your target site to capture API calls</p>
          </div>
        ) : (
          visibleDomains.map((summary) => (
            <DomainCard
              key={summary.domain}
              summary={summary}
              isExpanded={expandedDomains.has(summary.domain)}
              onToggle={() => toggleDomain(summary.domain)}
              onSelectGroup={onSelectGroup}
              selectedGroupKey={selectedGroupKey}
              showNoise={showNoise}
            />
          ))
        )}
      </div>
      
      {/* Footer stats */}
      {stats.noise > 0 && !showNoise && (
        <div className="px-4 py-2 border-t border-slate-700/30 bg-slate-800/20">
          <button
            onClick={() => setShowNoise(true)}
            className="text-[11px] text-slate-500 hover:text-slate-400 transition-colors"
          >
            + {stats.noise} hidden (tracking, ads, media)
          </button>
        </div>
      )}
    </div>
  );
}
