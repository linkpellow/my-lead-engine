'use client';

import { useState, useMemo, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import TrafficStream from '../components/dojo/TrafficStream';
import RouteMapper from '../components/dojo/RouteMapper';
import CopilotChat from '../components/dojo/CopilotChat';
import ProxyStatusBar from '../components/dojo/ProxyStatusBar';
import BlueprintViewer from '../components/dojo/BlueprintViewer';
import ExtractedFieldsPanel from '../components/dojo/ExtractedFieldsPanel';
import SpiderMonitor from '../components/dojo/SpiderMonitor';
import MappingGuide, { type MappingProgress, type MappingStep } from '../components/dojo/MappingGuide';
import { Sword, Trash2, Bug } from 'lucide-react';
import { useTrafficStream } from '../hooks/useTrafficStream';
import type { 
  CapturedRequest, 
  MappedRoute, 
  ChatMessage, 
  DomainGroup,
  AnalysisResult,
  ScraperBlueprint,
} from './types';
import { getFaviconUrl } from './types';

// Demo routes to show structure (these would be built from captured traffic)
const DEMO_ROUTES: MappedRoute[] = [
  {
    id: '1',
    domain: 'linkedin.com',
    path: '/voyager/api/identity/profiles/{profileId}',
    method: 'GET',
    health: 95,
    status: 'active',
    description: 'Fetches complete profile data including contact information.',
    parameters: ['profileId'],
    isReplayable: true,
  },
  {
    id: '2',
    domain: 'linkedin.com',
    path: '/voyager/api/graphql',
    method: 'POST',
    health: 88,
    status: 'active',
    description: 'GraphQL endpoint for flexible queries.',
    parameters: ['query', 'variables'],
    isReplayable: true,
  },
  {
    id: '3',
    domain: 'linkedin.com',
    path: '/voyager/api/search/blended',
    method: 'GET',
    health: 72,
    status: 'active',
    description: 'Unified search across people, companies, jobs.',
    parameters: ['keywords', 'filters', 'start', 'count'],
    isReplayable: true,
  },
];

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    role: 'system',
    content: '🥋 Dojo initialized. Waiting for traffic...',
  },
];

export default function DojoPage() {
  // Live traffic stream from polling hook
  const {
    requests: liveRequests,
    isPaused,
    togglePause,
    clearRequests,
    totalIngested,
  } = useTrafficStream({
    pollInterval: 2000,
    maxRequests: 100,
  });

  const [targetGoal, setTargetGoal] = useState('Extract email addresses from LinkedIn Sales Navigator profiles');
  const [focusDomain, setFocusDomain] = useState<string | undefined>();
  const [routes, setRoutes] = useState<MappedRoute[]>(DEMO_ROUTES);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [selectedRequestId, setSelectedRequestId] = useState<string | undefined>();
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set(['linkedin.com']));
  
  // AI Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingRouteId, setAnalyzingRouteId] = useState<string | undefined>();
  const [routeAnalysis, setRouteAnalysis] = useState<Record<string, AnalysisResult>>({});
  
  // Blueprint state
  const [generatingBlueprintRouteId, setGeneratingBlueprintRouteId] = useState<string | undefined>();
  const [currentBlueprint, setCurrentBlueprint] = useState<ScraperBlueprint | null>(null);

  // Mapping workflow state
  const [showSpiderMonitor, setShowSpiderMonitor] = useState(false);
  const [mappingProgress, setMappingProgress] = useState<MappingProgress>({
    currentStep: 'set_target',
    completedSteps: [],
    targetFields: ['phone', 'email', 'address', 'zipcode', 'age'],
    discoveredFields: [],
    goldenRoutes: 0,
    totalRoutes: 0,
    siteStatus: 'mapping',
  });

  // Update mapping progress based on captured data
  useEffect(() => {
    setMappingProgress(prev => {
      const goldenRoutes = Object.values(routeAnalysis).filter(a => a.isGoldenRoute).length;
      const discoveredFields = Object.values(routeAnalysis).flatMap(a => a.extractedFields);
      
      // Determine current step based on progress
      let currentStep = prev.currentStep;
      const completedSteps = [...prev.completedSteps];
      
      // Auto-advance steps based on conditions
      if (prev.targetFields.length > 0 && !completedSteps.includes('set_target')) {
        completedSteps.push('set_target');
        currentStep = 'start_capture';
      }
      
      if (liveRequests.length > 0 && !completedSteps.includes('start_capture')) {
        completedSteps.push('start_capture');
        currentStep = 'browse_site';
      }
      
      if (routes.length > 3 && !completedSteps.includes('browse_site')) {
        completedSteps.push('browse_site');
        currentStep = 'identify_routes';
      }
      
      if (goldenRoutes > 0 && !completedSteps.includes('identify_routes')) {
        completedSteps.push('identify_routes');
        currentStep = 'verify_fields';
      }
      
      // Check if all target fields are found
      const allFieldsFound = prev.targetFields.every(tf =>
        discoveredFields.some(df => df.toLowerCase().includes(tf.toLowerCase()))
      );
      
      if (allFieldsFound && goldenRoutes > 0 && !completedSteps.includes('verify_fields')) {
        completedSteps.push('verify_fields');
        currentStep = 'generate_spider';
      }
      
      return {
        ...prev,
        currentStep,
        completedSteps,
        discoveredFields: [...new Set(discoveredFields)],
        goldenRoutes,
        totalRoutes: routes.length,
      };
    });
  }, [liveRequests.length, routes.length, routeAnalysis]);

  // Handle mapping step actions
  const handleMappingStepAction = (step: MappingStep, action: string) => {
    console.log(`[Dojo] Mapping step action: ${step} - ${action}`);
    // Handle specific step actions here
  };

  // Auto-generate routes from captured traffic
  useEffect(() => {
    if (liveRequests.length === 0) return;

    // Build routes from unique URL patterns
    const routeMap = new Map<string, MappedRoute>();
    
    liveRequests.forEach(req => {
      // Normalize path by replacing IDs with placeholders
      let normalizedPath = req.url;
      try {
        const parsed = new URL(req.url);
        normalizedPath = parsed.pathname
          .replace(/\/[a-f0-9-]{32,}/gi, '/{id}')
          .replace(/\/\d+/g, '/{id}');
      } catch {}
      
      const key = `${req.domain}:${req.method}:${normalizedPath}`;
      
      if (!routeMap.has(key)) {
        routeMap.set(key, {
          id: `route-${routeMap.size}`,
          domain: req.domain,
          path: normalizedPath.replace(new URL(req.url).origin, '') || '/',
          method: req.method,
          health: req.status >= 200 && req.status < 400 ? 90 : 20,
          status: req.status >= 400 ? 'blocked' : 'active',
          description: req.summary || 'Discovered endpoint',
          parameters: [],
          isReplayable: req.method === 'GET',
        });
      }
    });

    // Merge with demo routes, prioritizing live data
    const newRoutes = Array.from(routeMap.values());
    if (newRoutes.length > 0) {
      setRoutes(newRoutes);
      
      // Auto-expand first domain
      const firstDomain = newRoutes[0]?.domain;
      if (firstDomain && !expandedDomains.has(firstDomain)) {
        setExpandedDomains(prev => new Set([...prev, firstDomain]));
      }
    }
  }, [liveRequests]);

  // Add system message when traffic starts flowing
  useEffect(() => {
    if (totalIngested > 0 && messages.length === 1) {
      const domains = [...new Set(liveRequests.map(r => r.domain))];
      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}`,
        role: 'system',
        content: `🟢 Traffic detected! Monitoring ${domains.length} domain${domains.length !== 1 ? 's' : ''}.`,
      }]);
    }
  }, [totalIngested, liveRequests, messages.length]);

  // Build domain groups for RouteMapper
  const domainGroups: DomainGroup[] = useMemo(() => {
    const domains = [...new Set(routes.map(r => r.domain))];
    
    return domains.map(domain => {
      const domainRoutes = routes.filter(r => r.domain === domain);
      const avgHealth = domainRoutes.length > 0
        ? Math.round(domainRoutes.reduce((sum, r) => sum + r.health, 0) / domainRoutes.length)
        : 0;
      
      return {
        domain,
        favicon: getFaviconUrl(domain),
        routes: domainRoutes,
        isExpanded: expandedDomains.has(domain),
        totalRequests: liveRequests.filter(r => r.domain === domain).length,
        healthAverage: avgHealth,
      };
    });
  }, [routes, liveRequests, expandedDomains]);

  // Get available domains for chat focus
  const availableDomains = useMemo(() => {
    return [...new Set(liveRequests.map(r => r.domain))];
  }, [liveRequests]);

  // Get currently selected request
  const selectedRequest = useMemo(() => {
    return liveRequests.find(r => r.id === selectedRequestId);
  }, [liveRequests, selectedRequestId]);

  // Analyze a request with AI
  const analyzeRequest = async (request: CapturedRequest, goal: string): Promise<AnalysisResult | null> => {
    try {
      const response = await fetch('/api/dojo/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request: {
            id: request.id,
            url: request.url,
            method: request.method,
            status: request.status,
            headers: request.headers,
            requestBody: request.requestBody,
            responseBody: request.responseBody,
          },
          goal,
          generateSchema: 'both',
        }),
      });

      const data = await response.json();
      if (data.success) {
        return data.analysis;
      }
      console.error('[Dojo] Analysis failed:', data.error);
      return null;
    } catch (error) {
      console.error('[Dojo] Analysis error:', error);
      return null;
    }
  };

  const handleToggleLive = () => togglePause();
  
  const handleSelectRequest = (id: string) => {
    setSelectedRequestId(id === selectedRequestId ? undefined : id);
  };

  const handleFilterDomain = (domain: string | undefined) => {
    setFocusDomain(domain);
  };

  const handleSendMessage = (content: string) => {
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      relatedDomain: focusDomain,
    };
    
    // Simulate AI response based on context
    let aiContent = `Analyzing: "${content}"\n\n`;
    if (liveRequests.length > 0) {
      const domains = [...new Set(liveRequests.map(r => r.domain))];
      aiContent += `I see ${liveRequests.length} requests from ${domains.join(', ')}. `;
      
      const successRate = liveRequests.filter(r => r.status >= 200 && r.status < 400).length / liveRequests.length;
      aiContent += `Success rate: ${Math.round(successRate * 100)}%.`;
    } else {
      aiContent += `No traffic captured yet. Start the mitmproxy relay to begin capturing.`;
    }

    const aiResponse: ChatMessage = {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant',
      content: aiContent,
      relatedDomain: focusDomain,
    };

    setMessages([...messages, userMessage, aiResponse]);
  };

  const handleSetGoal = (goal: string) => {
    setTargetGoal(goal);
    const systemMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'system',
      content: `🎯 Target updated: "${goal}"`,
    };
    setMessages([...messages, systemMessage]);
  };

  const handleSetFocusDomain = (domain: string | undefined) => {
    setFocusDomain(domain);
  };

  const handleToggleDomain = (domain: string) => {
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

  const handleReplayRoute = (id: string) => {
    console.log('Replaying route:', id);
  };

  const handleRefreshRoute = (id: string) => {
    console.log('Refreshing route:', id);
  };

  // Handle saving site configuration with extracted fields
  const handleSaveSiteConfig = async (domain: string, fields: { fieldType: string; fieldName: string; sampleValues: string[]; count: number }[]) => {
    try {
      const response = await fetch('/api/dojo/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain,
          routes: routes.filter(r => r.domain === domain),
          extractedFieldPatterns: fields.map(f => ({
            fieldName: f.fieldName,
            fieldType: f.fieldType,
            sampleValues: f.sampleValues,
            lastSeenAt: Date.now(),
          })),
        }),
      });

      const data = await response.json();
      if (data.success) {
        const systemMessage: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'system',
          content: `💾 Site configuration saved for ${domain} (${fields.length} field patterns)`,
        };
        setMessages(prev => [...prev, systemMessage]);
      }
    } catch (error) {
      console.error('[Dojo] Save config failed:', error);
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'system',
        content: `❌ Failed to save site configuration`,
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleLinkRequest = (messageId: string) => {
    console.log('Linking request to message:', messageId);
  };

  // Handle AI analysis from CopilotChat
  const handleAnalyzeRequest = async (request: CapturedRequest, goal: string) => {
    setIsAnalyzing(true);
    
    // Add user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: goal,
      relatedRequestId: request.id,
      relatedDomain: request.domain,
    };
    
    // Add loading message
    const loadingMessage: ChatMessage = {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant',
      content: 'Analyzing request...',
      isLoading: true,
    };
    
    setMessages(prev => [...prev, userMessage, loadingMessage]);

    const analysis = await analyzeRequest(request, goal);
    
    // Replace loading message with result
    setMessages(prev => {
      const updated = prev.filter(m => m.id !== loadingMessage.id);
      const resultMessage: ChatMessage = {
        id: `msg-${Date.now() + 2}`,
        role: 'assistant',
        content: analysis 
          ? analysis.summary
          : 'Failed to analyze request. Please try again.',
        relatedRequestId: request.id,
        relatedDomain: request.domain,
        analysis: analysis || undefined,
      };
      return [...updated, resultMessage];
    });

    setIsAnalyzing(false);
  };

  // Handle AI analysis from RouteMapper
  const handleAnalyzeRoute = async (route: MappedRoute) => {
    setAnalyzingRouteId(route.id);

    // Find the most recent request matching this route
    const matchingRequest = liveRequests.find(req => {
      const reqPath = new URL(req.url).pathname
        .replace(/\/[a-f0-9-]{32,}/gi, '/{id}')
        .replace(/\/\d+/g, '/{id}');
      return req.domain === route.domain && 
             req.method === route.method &&
             reqPath === route.path;
    });

    if (matchingRequest) {
      const analysis = await analyzeRequest(matchingRequest, targetGoal);
      
      if (analysis) {
        // Store analysis for route
        setRouteAnalysis(prev => ({ ...prev, [route.id]: analysis }));
        
        // Update route health based on analysis
        setRoutes(prev => prev.map(r => 
          r.id === route.id 
            ? { ...r, health: analysis.relevanceScore, description: analysis.summary }
            : r
        ));

        // Add message to chat
        const resultMessage: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: `Analyzed route: ${route.method} ${route.path}\n\n${analysis.summary}`,
          relatedDomain: route.domain,
          analysis,
        };
        setMessages(prev => [...prev, resultMessage]);
      }
    } else {
      // No matching request found
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'system',
        content: `⚠️ No captured traffic for ${route.method} ${route.path}. Capture some traffic first.`,
      };
      setMessages(prev => [...prev, errorMessage]);
    }

    setAnalyzingRouteId(undefined);
  };

  // Handle Blueprint generation from RouteMapper
  const handleGenerateBlueprint = async (route: MappedRoute) => {
    setGeneratingBlueprintRouteId(route.id);

    // Find the most recent request matching this route
    const matchingRequest = liveRequests.find(req => {
      const reqPath = new URL(req.url).pathname
        .replace(/\/[a-f0-9-]{32,}/gi, '/{id}')
        .replace(/\/\d+/g, '/{id}');
      return req.domain === route.domain && 
             req.method === route.method &&
             reqPath === route.path;
    });

    if (matchingRequest) {
      try {
        const response = await fetch('/api/dojo/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            request: {
              id: matchingRequest.id,
              url: matchingRequest.url,
              method: matchingRequest.method,
              status: matchingRequest.status,
              headers: matchingRequest.headers,
              requestBody: matchingRequest.requestBody,
              responseBody: matchingRequest.responseBody,
            },
            goal: targetGoal,
            mode: 'blueprint',
          }),
        });

        const data = await response.json();
        if (data.success && data.blueprint) {
          setCurrentBlueprint(data.blueprint);
          
          // Add message to chat
          const resultMessage: ChatMessage = {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: `📋 Blueprint generated for ${route.method} ${route.path}\n\nOpen the Blueprint Viewer to copy the mega-prompt.`,
            relatedDomain: route.domain,
          };
          setMessages(prev => [...prev, resultMessage]);
        }
      } catch (error) {
        console.error('[Dojo] Blueprint generation failed:', error);
        const errorMessage: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'system',
          content: `❌ Blueprint generation failed. Please try again.`,
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } else {
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'system',
        content: `⚠️ No captured traffic for ${route.method} ${route.path}. Capture some traffic first.`,
      };
      setMessages(prev => [...prev, errorMessage]);
    }

    setGeneratingBlueprintRouteId(undefined);
  };

  const handleClearAll = async () => {
    await clearRequests();
    setRoutes(DEMO_ROUTES);
    setRouteAnalysis({});
    setSelectedRequestId(undefined);
    setMessages([{
      id: `msg-${Date.now()}`,
      role: 'system',
      content: '🧹 Traffic cleared. Waiting for new data...',
    }]);
  };

  return (
    <AppLayout>
      <div className="h-[calc(100vh-48px)] flex flex-col p-3 gap-3">
        {/* Header Row */}
        <div className="flex items-center gap-3">
          {/* Title */}
          <div className="flex items-center gap-3 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 px-4 py-2.5">
            <Sword className="w-5 h-5 text-[#e272db]" />
            <h1 className="text-lg font-bold bg-gradient-to-r from-[#e272db] via-[#8055a6] to-[#54317d] bg-clip-text text-transparent font-mono">
              THE DOJO
            </h1>
            <span className="text-[10px] text-slate-500 font-mono hidden lg:block">
              REVERSE ENGINEERING COCKPIT
            </span>
            
            {/* Clear Button */}
            {liveRequests.length > 0 && (
              <button
                onClick={handleClearAll}
                className="flex items-center gap-1 px-2 py-1 ml-2 text-[10px] font-mono text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                title="Clear all traffic"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
          
          {/* Proxy Status Bar */}
          <div className="flex-1">
            <ProxyStatusBar />
          </div>
        </div>

        {/* 3-Column Layout */}
        <div className="flex-1 grid grid-cols-12 gap-3 min-h-0">
          {/* Left Column (25%) - Traffic Stream */}
          <div className="col-span-12 lg:col-span-3 min-h-0">
            <TrafficStream
              requests={liveRequests}
              isLive={!isPaused}
              onToggleLive={handleToggleLive}
              onSelectRequest={handleSelectRequest}
              selectedRequestId={selectedRequestId}
              focusDomain={focusDomain}
              onFilterDomain={handleFilterDomain}
            />
          </div>

          {/* Center Column (50%) - Route Mapper + Extracted Fields */}
          <div className="col-span-12 lg:col-span-6 min-h-0 flex flex-col gap-3">
            {/* Route Mapper (60% height) */}
            <div className="flex-[6] min-h-0">
              <RouteMapper
                domainGroups={domainGroups}
                analyzingRouteId={analyzingRouteId}
                generatingBlueprintRouteId={generatingBlueprintRouteId}
                routeAnalysis={routeAnalysis}
                onReplayRoute={handleReplayRoute}
                onRefreshRoute={handleRefreshRoute}
                onToggleDomain={handleToggleDomain}
                onAnalyzeRoute={handleAnalyzeRoute}
                onGenerateBlueprint={handleGenerateBlueprint}
              />
            </div>
            
            {/* Extracted Fields Panel (40% height) */}
            <div className="flex-[4] min-h-0">
              <ExtractedFieldsPanel
                focusDomain={focusDomain}
                onSaveConfig={handleSaveSiteConfig}
              />
            </div>
          </div>

          {/* Right Column (25%) - Mapping Guide + Copilot Chat / Spider Monitor */}
          <div className="col-span-12 lg:col-span-3 min-h-0 flex flex-col gap-3">
            {/* Toggle for Spider Monitor */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSpiderMonitor(false)}
                className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-mono rounded-lg border transition-colors ${
                  !showSpiderMonitor 
                    ? 'bg-[#8055a6]/20 text-[#e272db] border-[#8055a6]/50' 
                    : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:text-slate-300'
                }`}
              >
                <Sword className="w-3 h-3" />
                COPILOT
              </button>
              <button
                onClick={() => setShowSpiderMonitor(true)}
                className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-mono rounded-lg border transition-colors ${
                  showSpiderMonitor 
                    ? 'bg-purple-500/20 text-purple-400 border-purple-500/50' 
                    : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:text-slate-300'
                }`}
              >
                <Bug className="w-3 h-3" />
                SPIDERS
              </button>
            </div>
            
            {/* Mapping Guide (compact) */}
            <MappingGuide
              domain={focusDomain}
              progress={mappingProgress}
              onStepAction={handleMappingStepAction}
            />
            
            {/* Conditional: Copilot Chat or Spider Monitor */}
            <div className="flex-1 min-h-0">
              {showSpiderMonitor ? (
                <SpiderMonitor focusDomain={focusDomain} />
              ) : (
                <CopilotChat
                  messages={messages}
                  targetGoal={targetGoal}
                  focusDomain={focusDomain}
                  availableDomains={availableDomains}
                  selectedRequest={selectedRequest}
                  isAnalyzing={isAnalyzing}
                  onSetGoal={handleSetGoal}
                  onSetFocusDomain={handleSetFocusDomain}
                  onSendMessage={handleSendMessage}
                  onAnalyzeRequest={handleAnalyzeRequest}
                  onLinkRequest={handleLinkRequest}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Blueprint Viewer Modal */}
      {currentBlueprint && (
        <BlueprintViewer
          blueprint={currentBlueprint}
          onClose={() => setCurrentBlueprint(null)}
        />
      )}
    </AppLayout>
  );
}
