'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  User, 
  Send, 
  Target, 
  Sparkles, 
  Link as LinkIcon, 
  Globe,
  Wand2,
  Star,
  AlertTriangle,
  Copy,
  Check,
  Code,
  Loader2
} from 'lucide-react';
import type { ChatMessage, CapturedRequest, AnalysisResult } from '@/app/dojo/types';
import { getFaviconUrl } from '@/app/dojo/types';

interface CopilotChatProps {
  messages: ChatMessage[];
  targetGoal: string;
  focusDomain?: string;
  availableDomains: string[];
  selectedRequest?: CapturedRequest;
  isAnalyzing?: boolean;
  onSetGoal: (goal: string) => void;
  onSetFocusDomain: (domain: string | undefined) => void;
  onSendMessage: (message: string) => void;
  onAnalyzeRequest: (request: CapturedRequest, goal: string) => void;
  onLinkRequest: (messageId: string) => void;
}

// Render analysis result with rich formatting
function AnalysisCard({ analysis }: { analysis: AnalysisResult }) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [showSchema, setShowSchema] = useState<'typescript' | 'pydantic' | null>(null);

  const handleCopyCode = () => {
    if (analysis.codeSnippet) {
      navigator.clipboard.writeText(analysis.codeSnippet);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className="mt-2 space-y-2">
      {/* Golden Route Badge */}
      {analysis.isGoldenRoute && (
        <div className="flex items-center gap-2 px-2 py-1.5 bg-white/20 border border-white/30 rounded-lg">
          <Star className="w-4 h-4 text-white fill-white" />
          <span className="text-xs font-bold text-white">GOLDEN ROUTE</span>
          <span className="text-[10px] text-white/70 ml-auto">
            {analysis.relevanceScore}% relevant
          </span>
        </div>
      )}

      {/* Relevance Score Bar */}
      {!analysis.isGoldenRoute && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">Relevance:</span>
          <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all ${
                analysis.relevanceScore >= 80 ? 'bg-white' :
                analysis.relevanceScore >= 50 ? 'bg-gray-400' :
                'bg-gray-500'
              }`}
              style={{ width: `${analysis.relevanceScore}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-400">{analysis.relevanceScore}%</span>
        </div>
      )}

      {/* Extracted Fields */}
      {analysis.extractedFields.length > 0 && (
        <div>
          <span className="text-[10px] text-gray-500 block mb-1">Extracted Fields:</span>
          <div className="flex flex-wrap gap-1">
            {analysis.extractedFields.map((field) => (
              <span
                key={field}
                className="font-mono text-[10px] px-1.5 py-0.5 bg-white/20 text-white rounded"
              >
                {field}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Dynamic Parameters */}
      {analysis.dynamicParameters.length > 0 && (
        <div>
          <span className="text-[10px] text-gray-500 block mb-1">Dynamic Parameters:</span>
          <div className="space-y-1">
            {analysis.dynamicParameters.map((param) => (
              <div key={param.name} className="flex items-center gap-2 text-[10px]">
                <span className="font-mono text-white">{param.name}</span>
                <span className="text-gray-600">→</span>
                <span className="text-gray-400">{param.location}</span>
                <span className="font-mono text-gray-500 truncate">
                  ({param.example})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {analysis.warnings && analysis.warnings.length > 0 && (
        <div className="flex items-start gap-2 px-2 py-1.5 bg-white/10 border border-white/20 rounded-lg">
          <AlertTriangle className="w-3 h-3 text-white mt-0.5 flex-shrink-0" />
          <div className="text-[10px] text-white">
            {analysis.warnings.join(' • ')}
          </div>
        </div>
      )}

      {/* Code Snippet */}
      {analysis.codeSnippet && (
        <div className="relative">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-gray-500">Code Snippet:</span>
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-white transition-colors"
            >
              {copiedCode ? (
                <><Check className="w-3 h-3" /> Copied</>
              ) : (
                <><Copy className="w-3 h-3" /> Copy</>
              )}
            </button>
          </div>
          <pre className="font-mono text-[10px] text-gray-300 bg-black/50 border border-white/20 rounded-lg p-2 overflow-x-auto">
            {analysis.codeSnippet}
          </pre>
        </div>
      )}

      {/* Schema Toggle */}
      {analysis.schema && (analysis.schema.typescript || analysis.schema.pydantic) && (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Code className="w-3 h-3 text-gray-500" />
            <span className="text-[10px] text-gray-500">Generated Schema:</span>
            <div className="flex gap-1 ml-auto">
              {analysis.schema.typescript && (
                <button
                  onClick={() => setShowSchema(showSchema === 'typescript' ? null : 'typescript')}
                  className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                    showSchema === 'typescript' 
                      ? 'bg-white/20 text-white' 
                      : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  TypeScript
                </button>
              )}
              {analysis.schema.pydantic && (
                <button
                  onClick={() => setShowSchema(showSchema === 'pydantic' ? null : 'pydantic')}
                  className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                    showSchema === 'pydantic' 
                      ? 'bg-white/20 text-white' 
                      : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  Pydantic
                </button>
              )}
            </div>
          </div>
          {showSchema && (
            <pre className="font-mono text-[10px] text-gray-300 bg-black/50 border border-white/20 rounded-lg p-2 overflow-x-auto max-h-48">
              {showSchema === 'typescript' ? analysis.schema.typescript : analysis.schema.pydantic}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export default function CopilotChat({
  messages,
  targetGoal,
  focusDomain,
  availableDomains,
  selectedRequest,
  isAnalyzing,
  onSetGoal,
  onSetFocusDomain,
  onSendMessage,
  onAnalyzeRequest,
  onLinkRequest,
}: CopilotChatProps) {
  const [input, setInput] = useState('');
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(targetGoal);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isAnalyzing) {
      // If there's a selected request, trigger analysis
      if (selectedRequest) {
        onAnalyzeRequest(selectedRequest, input.trim());
      } else {
        onSendMessage(input.trim());
      }
      setInput('');
    }
  };

  const handleGoalSubmit = () => {
    if (goalInput.trim()) {
      onSetGoal(goalInput.trim());
      setIsEditingGoal(false);
    }
  };

  const handleQuickAnalyze = () => {
    if (selectedRequest && targetGoal) {
      onAnalyzeRequest(selectedRequest, targetGoal);
    }
  };

  const getRoleConfig = (role: ChatMessage['role']) => {
    switch (role) {
      case 'user':
        return {
          icon: User,
          bgColor: 'bg-gray-700/50',
          borderColor: 'border-gray-600',
          iconColor: 'text-white',
          label: 'You',
        };
      case 'assistant':
        return {
          icon: Bot,
          bgColor: 'bg-white/20',
          borderColor: 'border-white/30',
          iconColor: 'text-white',
          label: 'Dojo AI',
        };
      case 'system':
        return {
          icon: Sparkles,
          bgColor: 'bg-white/10',
          borderColor: 'border-white/30',
          iconColor: 'text-white',
          label: 'System',
        };
    }
  };

  return (
    <div className="h-full flex flex-col bg-black/80 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
      {/* Goal Input Header */}
      <div className="p-3 border-b border-white/20 bg-black/50">
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 text-white" />
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">
            TARGET GOAL
          </span>
        </div>
        
        {isEditingGoal ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGoalSubmit()}
              placeholder="e.g., Extract emails from LinkedIn profiles"
              className="flex-1 bg-black/50 border border-gray-600 rounded-lg px-3 py-2 text-xs text-gray-200 font-mono placeholder:text-gray-500 focus:outline-none focus:border-white"
              autoFocus
            />
            <button
              onClick={handleGoalSubmit}
              className="px-3 py-2 bg-white hover:bg-gray-200 text-black rounded-lg text-xs font-bold font-mono transition-colors"
            >
              SET
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setGoalInput(targetGoal);
              setIsEditingGoal(true);
            }}
            className="w-full text-left px-3 py-2 bg-black/30 hover:bg-black/50 border border-white/20 hover:border-white/50 rounded-lg text-xs font-mono transition-all"
          >
            {targetGoal ? (
              <span className="text-gray-200">{targetGoal}</span>
            ) : (
              <span className="text-gray-500 italic">Click to set your scraping target...</span>
            )}
          </button>
        )}
        
        {/* Domain Focus Selector */}
        {availableDomains.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <Globe className="w-3 h-3 text-gray-500" />
            <span className="text-[10px] text-gray-500 font-mono">FOCUS:</span>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => onSetFocusDomain(undefined)}
                className={`
                  flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono transition-all
                  ${!focusDomain 
                    ? 'bg-white/30 text-white border border-white/50' 
                    : 'bg-black/50 text-gray-400 hover:bg-black/70'
                  }
                `}
              >
                ALL
              </button>
              {availableDomains.map(domain => (
                <button
                  key={domain}
                  onClick={() => onSetFocusDomain(domain)}
                  className={`
                    flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono transition-all
                    ${focusDomain === domain 
                      ? 'bg-white/30 text-white border border-white/50' 
                      : 'bg-black/50 text-gray-400 hover:bg-black/70'
                    }
                  `}
                >
                  <img
                    src={getFaviconUrl(domain)}
                    alt=""
                    className="w-3 h-3 rounded-sm"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  {domain.split('.')[0]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Selected Request Context */}
      {selectedRequest && (
        <div className="px-3 py-2 bg-white/10 border-b border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LinkIcon className="w-3 h-3 text-white" />
              <span className="text-[10px] text-white font-mono">
                Analyzing: {selectedRequest.method} {new URL(selectedRequest.url).pathname.substring(0, 30)}...
              </span>
            </div>
            <button
              onClick={handleQuickAnalyze}
              disabled={isAnalyzing || !targetGoal}
              className="flex items-center gap-1 px-2 py-1 bg-white/30 hover:bg-white/50 text-black rounded text-[10px] font-bold font-mono transition-colors disabled:opacity-50"
            >
              {isAnalyzing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Wand2 className="w-3 h-3" />
              )}
              ANALYZE
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin scrollbar-thumb-gray-700">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
            <Bot className="w-8 h-8 mb-2 opacity-50 text-white" />
            <p className="text-xs text-center font-mono">
              I'm your AI co-pilot for reverse engineering.
            </p>
            <p className="text-[10px] mt-1 text-center">
              Select a request and click Analyze.
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const config = getRoleConfig(message.role);
            const Icon = config.icon;

            return (
              <div
                key={message.id}
                className={`
                  p-2.5 rounded-lg border ${config.bgColor} ${config.borderColor}
                `}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  {message.isLoading ? (
                    <Loader2 className={`w-3 h-3 ${config.iconColor} animate-spin`} />
                  ) : (
                    <Icon className={`w-3 h-3 ${config.iconColor}`} />
                  )}
                  <span className={`text-[10px] font-bold font-mono ${config.iconColor}`}>
                    {config.label}
                  </span>
                  {message.relatedRequestId && (
                    <span className="flex items-center gap-1 text-[9px] text-gray-500 bg-gray-700/50 px-1.5 py-0.5 rounded-full">
                      <LinkIcon className="w-2 h-2" />
                      Linked
                    </span>
                  )}
                  {message.relatedDomain && (
                    <span className="flex items-center gap-1 text-[9px] text-white bg-white/20 px-1.5 py-0.5 rounded-full">
                      <img
                        src={getFaviconUrl(message.relatedDomain)}
                        alt=""
                        className="w-2 h-2 rounded-sm"
                      />
                      {message.relatedDomain}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {message.content}
                </p>
                
                {/* Render analysis result if present */}
                {message.analysis && <AnalysisCard analysis={message.analysis} />}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-2 border-t border-white/20 bg-black/30">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={selectedRequest ? "Ask about this request..." : "Ask about patterns or strategies..."}
            disabled={isAnalyzing}
            className="flex-1 bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-xs text-gray-200 font-mono placeholder:text-gray-500 focus:outline-none focus:border-white transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isAnalyzing}
            className="px-3 py-2 bg-white hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-black rounded-lg transition-all"
          >
            {isAnalyzing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
