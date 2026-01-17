'use client';

import { useState } from 'react';
import { 
  Map, 
  Play, 
  RefreshCw, 
  ChevronDown, 
  ChevronRight,
  Shield,
  ShieldAlert,
  ShieldX,
  ShieldCheck,
  Folder,
  FolderOpen,
  Wand2,
  Star,
  Loader2,
  FileCode
} from 'lucide-react';
import type { DomainGroup, MappedRoute, HttpMethod, AnalysisResult } from '@/app/dojo/types';
import { getFaviconUrl } from '@/app/dojo/types';

interface RouteMapperProps {
  domainGroups: DomainGroup[];
  analyzingRouteId?: string;
  generatingBlueprintRouteId?: string;
  routeAnalysis?: Record<string, AnalysisResult>;
  onReplayRoute: (id: string) => void;
  onRefreshRoute: (id: string) => void;
  onToggleDomain: (domain: string) => void;
  onAnalyzeRoute: (route: MappedRoute) => void;
  onGenerateBlueprint: (route: MappedRoute) => void;
}

// Neon method colors matching TrafficStream
const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'text-cyan-400',
  POST: 'text-green-400',
  PUT: 'text-orange-400',
  PATCH: 'text-amber-400',
  DELETE: 'text-red-400',
  OPTIONS: 'text-slate-400',
  HEAD: 'text-slate-400',
};

// Health Shield Component
function HealthShield({ health }: { health: number }) {
  if (health >= 80) {
    return (
      <div className="relative" title={`Health: ${health}%`}>
        <ShieldCheck className="w-5 h-5 text-green-400 drop-shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[8px] font-bold text-green-400">{health}</span>
        </div>
      </div>
    );
  }
  
  if (health >= 50) {
    return (
      <div className="relative" title={`Health: ${health}%`}>
        <ShieldAlert className="w-5 h-5 text-yellow-400 drop-shadow-[0_0_6px_rgba(234,179,8,0.6)]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[8px] font-bold text-yellow-400">{health}</span>
        </div>
      </div>
    );
  }
  
  if (health >= 20) {
    return (
      <div className="relative" title={`Health: ${health}%`}>
        <Shield className="w-5 h-5 text-orange-400 drop-shadow-[0_0_6px_rgba(251,146,60,0.6)]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[8px] font-bold text-orange-400">{health}</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="relative" title={`Health: ${health}%`}>
      <ShieldX className="w-5 h-5 text-red-400 drop-shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[8px] font-bold text-red-400">{health}</span>
      </div>
    </div>
  );
}

// Route Status Badge
function StatusBadge({ status }: { status: MappedRoute['status'] }) {
  const config = {
    active: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'ACTIVE' },
    blocked: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'BLOCKED' },
    deprecated: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'DEPRECATED' },
  }[status];
  
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

export default function RouteMapper({
  domainGroups,
  analyzingRouteId,
  generatingBlueprintRouteId,
  routeAnalysis = {},
  onReplayRoute,
  onRefreshRoute,
  onToggleDomain,
  onAnalyzeRoute,
  onGenerateBlueprint,
}: RouteMapperProps) {
  // Group routes by path segments for tree structure
  const buildRouteTree = (routes: MappedRoute[]) => {
    const tree: Record<string, MappedRoute[]> = {};
    
    routes.forEach(route => {
      const segments = route.path.split('/').filter(Boolean);
      const category = segments[0] || 'root';
      if (!tree[category]) tree[category] = [];
      tree[category].push(route);
    });
    
    return tree;
  };

  return (
    <div className="h-full flex flex-col bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700/50 bg-slate-800/50">
        <div className="flex items-center gap-2">
          <Map className="w-4 h-4 text-[#e272db]" />
          <span className="text-sm font-semibold text-slate-200 font-mono">SITE MAP</span>
          <span className="text-xs text-slate-500 font-mono">
            ({domainGroups.length} domains)
          </span>
        </div>
      </div>

      {/* Domain Tree */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-700">
        {domainGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 p-4">
            <Map className="w-10 h-10 mb-3 opacity-50" />
            <p className="text-sm font-mono">No routes mapped</p>
            <p className="text-xs mt-1">Captured traffic will be analyzed here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {domainGroups.map((group) => {
              const routeTree = buildRouteTree(group.routes);
              
              return (
                <div 
                  key={group.domain}
                  className="border border-slate-700/50 rounded-lg overflow-hidden bg-slate-800/30"
                >
                  {/* Domain Header */}
                  <button
                    onClick={() => onToggleDomain(group.domain)}
                    className="w-full flex items-center gap-2 p-2.5 hover:bg-slate-800/50 transition-colors"
                  >
                    {/* Expand Icon */}
                    {group.isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    )}
                    
                    {/* Favicon */}
                    <img
                      src={group.favicon}
                      alt=""
                      className="w-4 h-4 rounded-sm"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    
                    {/* Domain Name */}
                    <span className="font-mono text-sm font-semibold text-slate-200 flex-1 text-left">
                      {group.domain}
                    </span>
                    
                    {/* Stats */}
                    <span className="text-[10px] text-slate-500 font-mono">
                      {group.routes.length} routes
                    </span>
                    
                    {/* Average Health */}
                    <HealthShield health={group.healthAverage} />
                  </button>
                  
                  {/* Routes (Expanded) */}
                  {group.isExpanded && (
                    <div className="border-t border-slate-700/30">
                      {Object.entries(routeTree).map(([category, routes]) => (
                        <div key={category} className="border-b border-slate-800/30 last:border-0">
                          {/* Category Header */}
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/20">
                            <FolderOpen className="w-3 h-3 text-[#8055a6]" />
                            <span className="font-mono text-[10px] text-slate-400">
                              /{category}
                            </span>
                          </div>
                          
                          {/* Routes in Category */}
                          {routes.map((route) => (
                            <div
                              key={route.id}
                              className="flex items-center gap-2 px-4 py-2 hover:bg-slate-700/30 transition-colors group"
                            >
                              {/* Indent + Method */}
                              <span className="text-slate-700 pl-2">├─</span>
                              <span className={`font-mono text-[10px] font-bold ${METHOD_COLORS[route.method]}`}>
                                {route.method}
                              </span>
                              
                              {/* Path */}
                              <span className="font-mono text-xs text-slate-300 flex-1 truncate">
                                {route.path}
                              </span>
                              
                              {/* Status Badge */}
                              <StatusBadge status={route.status} />
                              
                              {/* Health Shield */}
                              <HealthShield health={route.health} />
                              
                              {/* Golden Route Indicator */}
                              {routeAnalysis[route.id]?.isGoldenRoute && (
                                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                              )}

                              {/* Actions (visible on hover) */}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {/* Analyze Button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAnalyzeRoute(route);
                                  }}
                                  disabled={analyzingRouteId === route.id}
                                  className="p-1 hover:bg-[#8055a6]/30 rounded transition-colors disabled:opacity-50"
                                  title="Analyze with AI"
                                >
                                  {analyzingRouteId === route.id ? (
                                    <Loader2 className="w-3 h-3 text-[#e272db] animate-spin" />
                                  ) : (
                                    <Wand2 className="w-3 h-3 text-[#e272db]" />
                                  )}
                                </button>
                                {/* Blueprint Button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onGenerateBlueprint(route);
                                  }}
                                  disabled={generatingBlueprintRouteId === route.id}
                                  className="p-1 hover:bg-green-500/30 rounded transition-colors disabled:opacity-50"
                                  title="Generate Blueprint"
                                >
                                  {generatingBlueprintRouteId === route.id ? (
                                    <Loader2 className="w-3 h-3 text-green-400 animate-spin" />
                                  ) : (
                                    <FileCode className="w-3 h-3 text-green-400" />
                                  )}
                                </button>
                                {route.isReplayable && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onReplayRoute(route.id);
                                    }}
                                    className="p-1 hover:bg-[#8055a6]/30 rounded transition-colors"
                                    title="Replay"
                                  >
                                    <Play className="w-3 h-3 text-[#e272db]" />
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRefreshRoute(route.id);
                                  }}
                                  className="p-1 hover:bg-slate-600/30 rounded transition-colors"
                                  title="Refresh"
                                >
                                  <RefreshCw className="w-3 h-3 text-slate-400" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                      
                      {/* Parameters Section */}
                      {group.routes.some(r => r.parameters.length > 0) && (
                        <div className="px-3 py-2 bg-slate-900/50 border-t border-slate-700/30">
                          <span className="text-[10px] text-slate-500 font-mono">
                            DISCOVERED PARAMS:
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {[...new Set(group.routes.flatMap(r => r.parameters))].map(param => (
                              <span
                                key={param}
                                className="font-mono text-[10px] px-1.5 py-0.5 bg-[#8055a6]/20 text-[#e272db] rounded"
                              >
                                {param}
                              </span>
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
