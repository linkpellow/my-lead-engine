'use client';

import { useState, useMemo } from 'react';
import AppLayout from '../components/AppLayout';
import DataFieldView from '../components/dojo/DataFieldView';
import ProxyStatusBar from '../components/dojo/ProxyStatusBar';
import BlueprintViewer from '../components/dojo/BlueprintViewer';
import SiteLibrary from '../components/dojo/SiteLibrary';
import { useTrafficStream } from '../hooks/useTrafficStream';
import { 
  Sword, 
  Sparkles, 
  Send, 
  Star,
  FileCode,
  Loader2,
  Bot,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  Database,
  Radio,
  Library,
} from 'lucide-react';
import type { 
  ScraperBlueprint,
  AnalysisResult,
} from './types';

// Tab types
type DojoTab = 'traffic' | 'library';

export default function DojoPageV2() {
  // Active tab
  const [activeTab, setActiveTab] = useState<DojoTab>('library');
  
  // Traffic stream
  const { requests: liveRequests } = useTrafficStream({
    pollInterval: 2000,
    maxRequests: 200,
  });

  // UI State
  const [selectedFieldType, setSelectedFieldType] = useState<string | undefined>();
  const [selectedFieldRequests, setSelectedFieldRequests] = useState<typeof liveRequests>([]);
  const [targetDomain, setTargetDomain] = useState<string>('');
  const [copilotInput, setCopilotInput] = useState('');
  
  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  
  // Blueprint state
  const [isGenerating, setIsGenerating] = useState(false);
  const [blueprint, setBlueprint] = useState<ScraperBlueprint | null>(null);
  const [copied, setCopied] = useState(false);

  // Messages for copilot
  const [messages, setMessages] = useState<Array<{
    id: string;
    type: 'system' | 'user' | 'ai';
    content: string;
  }>>([
    { id: '1', type: 'system', content: 'Ready to map. Browse your target site on mobile.' }
  ]);

  // Handle field selection
  const handleSelectField = (fieldType: string, requests: typeof liveRequests) => {
    setSelectedFieldType(fieldType);
    setSelectedFieldRequests(requests);
    setAnalysis(null);
    
    // Get field metadata
    const fieldNames: Record<string, string> = {
      phone: 'Phone',
      email: 'Email',
      address: 'Address',
      city: 'City',
      state: 'State',
      zipcode: 'Zipcode',
      age: 'Age',
      name: 'Name',
      income: 'Income',
    };
    
    const fieldName = fieldNames[fieldType] || fieldType;
    
    // Auto-suggest analysis
    setMessages(prev => [...prev, {
      id: `msg-${Date.now()}`,
      type: 'ai',
      content: `Found ${fieldName} in ${requests.length} request${requests.length !== 1 ? 's' : ''}. Click Analyze to extract more details.`
    }]);
  };

  // Analyze selected field's source requests
  const handleAnalyze = async () => {
    if (!selectedFieldType || selectedFieldRequests.length === 0) return;
    
    setIsAnalyzing(true);
    // Use the request with the most extracted fields of this type
    const request = selectedFieldRequests.reduce((best, req) => {
      const bestCount = best.extractedFields?.filter(f => f.fieldType === selectedFieldType).length || 0;
      const reqCount = req.extractedFields?.filter(f => f.fieldType === selectedFieldType).length || 0;
      return reqCount > bestCount ? req : best;
    }, selectedFieldRequests[0]);
    
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
          },
          goal: 'Extract person data: phone, email, address, age',
          mode: 'analyze',
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        setAnalysis(data.analysis);
        setMessages(prev => [...prev, {
          id: `msg-${Date.now()}`,
          type: 'ai',
          content: data.analysis.isGoldenRoute 
            ? `⭐ Golden route confirmed! Found ${data.analysis.extractedFields.length} extractable fields.`
            : `Analyzed. Relevance: ${data.analysis.relevanceScore}%`
        }]);
      }
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Generate blueprint from selected field's source
  const handleGenerateBlueprint = async () => {
    if (!selectedFieldType || selectedFieldRequests.length === 0) return;
    
    setIsGenerating(true);
    // Use the request with the most extracted fields of this type
    const request = selectedFieldRequests.reduce((best, req) => {
      const bestCount = best.extractedFields?.filter(f => f.fieldType === selectedFieldType).length || 0;
      const reqCount = req.extractedFields?.filter(f => f.fieldType === selectedFieldType).length || 0;
      return reqCount > bestCount ? req : best;
    }, selectedFieldRequests[0]);
    
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
          },
          goal: 'Extract person data: phone, email, address, age',
          mode: 'blueprint',
        }),
      });
      
      const data = await response.json();
      if (data.success && data.blueprint) {
        setBlueprint(data.blueprint);
        setMessages(prev => [...prev, {
          id: `msg-${Date.now()}`,
          type: 'ai',
          content: `✅ Blueprint generated: ${data.blueprint.filename}`
        }]);
      }
    } catch (error) {
      console.error('Blueprint generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle copilot message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!copilotInput.trim()) return;
    
    setMessages(prev => [...prev, {
      id: `msg-${Date.now()}`,
      type: 'user',
      content: copilotInput
    }]);
    
    // Simple response logic
    setTimeout(() => {
      let response = "I can help with that. Select a route to analyze.";
      
      if (copilotInput.toLowerCase().includes('target')) {
        response = "Set your target domain by browsing the site. I'll auto-detect it.";
      } else       if (copilotInput.toLowerCase().includes('analyze')) {
        response = selectedFieldType 
          ? "Click 'Analyze' to examine the selected data field."
          : "First select a data field from the left panel.";
      }
      
      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}`,
        type: 'ai',
        content: response
      }]);
    }, 500);
    
    setCopilotInput('');
  };

  // Copy blueprint
  const handleCopy = () => {
    if (blueprint) {
      navigator.clipboard.writeText(blueprint.pydanticModels + '\n\n' + blueprint.extractionLogic);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <AppLayout>
      <div className="h-[calc(100vh-48px)] flex flex-col">
        {/* Header with Tabs */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
          <div className="flex items-center gap-6">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <Sword className="w-5 h-5 text-purple-400" />
              <span className="font-bold text-lg bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                DOJO
              </span>
            </div>
            
            {/* Tab Navigation */}
            <div className="flex items-center bg-slate-800/50 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('library')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'library'
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                <Library className="w-4 h-4" />
                Site Library
              </button>
              <button
                onClick={() => setActiveTab('traffic')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'traffic'
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                <Radio className="w-4 h-4" />
                Traffic Stream
                {liveRequests.length > 0 && (
                  <span className="flex items-center gap-1 ml-1">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                    </span>
                    <span className="text-xs text-emerald-400 font-mono">{liveRequests.length}</span>
                  </span>
                )}
              </button>
            </div>
          </div>
          
          <ProxyStatusBar />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex min-h-0">
          {/* Site Library Tab */}
          {activeTab === 'library' && (
            <div className="flex-1 p-4">
              <SiteLibrary
                requests={liveRequests}
                onSelectSite={(site) => {
                  // Switch to traffic tab and set target domain
                  setTargetDomain(site.domain);
                  setActiveTab('traffic');
                }}
              />
            </div>
          )}
          
          {/* Traffic Stream Tab */}
          {activeTab === 'traffic' && (
            <>
              {/* Left: Data Field View (40%) */}
              <div className="w-[40%] border-r border-slate-800 p-3">
                <DataFieldView
                  requests={liveRequests}
                  targetDomain={targetDomain}
                  onSelectField={handleSelectField}
                  selectedFieldType={selectedFieldType}
                />
              </div>

              {/* Right: Focus Panel + Copilot (60%) */}
              <div className="flex-1 flex flex-col">
            {/* Selected Field Detail */}
            {selectedFieldType && selectedFieldRequests.length > 0 ? (
              <div className="flex-1 p-4 overflow-y-auto">
                {/* Field Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-xl font-bold text-slate-200">
                        {selectedFieldType.charAt(0).toUpperCase() + selectedFieldType.slice(1).replace(/_/g, ' ')}
                      </h2>
                      <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                    </div>
                    <p className="text-sm text-slate-500">
                      Found in {selectedFieldRequests.length} request{selectedFieldRequests.length !== 1 ? 's' : ''} from{' '}
                      {[...new Set(selectedFieldRequests.map(r => r.domain))].join(', ')}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAnalyze}
                      disabled={isAnalyzing}
                      className="flex items-center gap-2 px-3 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors disabled:opacity-50"
                    >
                      {isAnalyzing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      Analyze
                    </button>
                    <button
                      onClick={handleGenerateBlueprint}
                      disabled={isGenerating}
                      className="flex items-center gap-2 px-3 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                    >
                      {isGenerating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileCode className="w-4 h-4" />
                      )}
                      Blueprint
                    </button>
                  </div>
                </div>

                {/* Analysis Result */}
                {analysis && (
                  <div className="mb-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-slate-200">Analysis</h3>
                      <span className={`text-sm font-mono px-2 py-0.5 rounded ${
                        analysis.relevanceScore >= 80 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'bg-slate-600/50 text-slate-400'
                      }`}>
                        {analysis.relevanceScore}% relevant
                      </span>
                    </div>
                    
                    <p className="text-sm text-slate-300 mb-3">{analysis.summary}</p>
                    
                    {analysis.extractedFields.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-500 mb-2">Extractable fields:</p>
                        <div className="flex flex-wrap gap-1">
                          {analysis.extractedFields.map(field => (
                            <span key={field} className="text-xs px-2 py-1 bg-purple-500/20 text-purple-300 rounded">
                              {field}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Blueprint Preview */}
                {blueprint && (
                  <div className="p-4 bg-slate-800/50 rounded-xl border border-emerald-500/30">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                        <FileCode className="w-4 h-4 text-emerald-400" />
                        {blueprint.filename}
                      </h3>
                      <button
                        onClick={handleCopy}
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300"
                      >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    
                    <pre className="text-xs text-slate-300 bg-slate-900/50 rounded-lg p-3 overflow-x-auto max-h-64">
                      {blueprint.pydanticModels.substring(0, 500)}...
                    </pre>
                  </div>
                )}

                {/* Field samples */}
                {(() => {
                  const fieldSamples = selectedFieldRequests
                    .flatMap(req => req.extractedFields?.filter(f => f.fieldType === selectedFieldType) || [])
                    .map(f => f.value)
                    .filter((v, i, arr) => v && arr.indexOf(v) === i)
                    .slice(0, 20);
                  
                  if (fieldSamples.length > 0) {
                    return (
                      <div className="mt-4">
                        <h3 className="text-sm font-semibold text-slate-300 mb-2">
                          Sample Values ({fieldSamples.length})
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {fieldSamples.map((value, idx) => (
                            <span
                              key={idx}
                              className="text-xs px-3 py-1.5 bg-slate-800/50 text-slate-200 rounded-lg font-mono border border-slate-700/50"
                            >
                              {value}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Source endpoints (collapsible) */}
                <details className="mt-4">
                  <summary className="text-sm font-semibold text-slate-400 cursor-pointer hover:text-slate-300 mb-2">
                    Source Endpoints ({selectedFieldRequests.length})
                  </summary>
                  <div className="space-y-2 mt-2 pl-4 border-l border-slate-700/50">
                    {selectedFieldRequests.slice(0, 10).map((req) => (
                      <div key={req.id} className="text-xs text-slate-500 font-mono p-2 bg-slate-800/30 rounded">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-slate-400">{req.method}</span>
                          <span className="text-slate-600">{req.domain}</span>
                        </div>
                        <div className="text-slate-600 truncate">{new URL(req.url).pathname}</div>
                      </div>
                    ))}
                    {selectedFieldRequests.length > 10 && (
                      <div className="text-xs text-slate-600 italic">
                        + {selectedFieldRequests.length - 10} more...
                      </div>
                    )}
                  </div>
                </details>
              </div>
            ) : (
              /* Empty state */
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-800/50 flex items-center justify-center">
                    <Database className="w-8 h-8 text-slate-600" />
                  </div>
                  <p className="text-slate-400">Select a data field to analyze</p>
                  <p className="text-sm text-slate-600 mt-1">Extracted fields appear as you browse</p>
                </div>
              </div>
            )}

            {/* Copilot - Always visible at bottom */}
            <div className="border-t border-slate-800 bg-slate-900/50">
              {/* Messages */}
              <div className="max-h-32 overflow-y-auto px-4 py-2 space-y-2">
                {messages.slice(-3).map(msg => (
                  <div key={msg.id} className={`text-sm ${
                    msg.type === 'ai' ? 'text-purple-300' :
                    msg.type === 'user' ? 'text-slate-300' :
                    'text-slate-500'
                  }`}>
                    {msg.type === 'ai' && <Bot className="w-3 h-3 inline mr-1" />}
                    {msg.content}
                  </div>
                ))}
              </div>
              
              {/* Input */}
              <form onSubmit={handleSendMessage} className="flex items-center gap-2 p-3 border-t border-slate-800/50">
                <input
                  type="text"
                  value={copilotInput}
                  onChange={(e) => setCopilotInput(e.target.value)}
                  placeholder="Ask about patterns or strategies..."
                  className="flex-1 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  type="submit"
                  className="p-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
            </>
          )}
        </div>
      </div>

      {/* Blueprint Modal */}
      {blueprint && (
        <BlueprintViewer
          blueprint={blueprint}
          onClose={() => setBlueprint(null)}
        />
      )}
    </AppLayout>
  );
}
