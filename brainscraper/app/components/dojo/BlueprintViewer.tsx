'use client';

import { useState, useEffect } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  FileCode, 
  Sparkles,
  ChevronDown,
  ChevronRight,
  Github,
  Loader2,
  ExternalLink,
  AlertTriangle
} from 'lucide-react';
import type { ScraperBlueprint } from '@/app/dojo/types';

interface BlueprintViewerProps {
  blueprint: ScraperBlueprint;
  onClose: () => void;
}

interface DeployStatus {
  configured: boolean;
  owner: string | null;
  repo: string | null;
}

/**
 * Generate the "Mega-Prompt" for Cursor
 * 
 * Now instructs Cursor to inherit from BaseScraper for:
 * - Automatic 429 handling with exponential backoff
 * - Adaptive rate limiting based on response headers
 * - Circuit breaking after repeated failures
 * - Random jitter to avoid detection
 */
function generateMegaPrompt(blueprint: ScraperBlueprint): string {
  const headersJson = JSON.stringify(blueprint.headers, null, 2);
  const bodySection = blueprint.body 
    ? `\n**Request Body (JSON):**\n\`\`\`json\n${JSON.stringify(blueprint.body, null, 2)}\n\`\`\`\n` 
    : '';
  const dynamicParamsSection = blueprint.dynamicParams.length > 0
    ? `\n**Dynamic Parameters:** ${blueprint.dynamicParams.map(p => `\`${p}\``).join(', ')} - make these arguments in the \`extract()\` method.\n`
    : '';

  return `I need you to create a new Python scraper for my Scrapegoat engine.

**1. File Location:**
Create this file: \`scrapegoat/app/scraping/spiders/${blueprint.filename}\`

**2. The Architecture (CRITICAL - Inherit from BaseScraper):**
\`\`\`python
from app.scraping.base import BaseScraper
from pydantic import BaseModel
from typing import Optional, List, Any
from loguru import logger
\`\`\`

- The spider class MUST inherit from \`BaseScraper\`: \`class ${blueprint.responseModelName}Spider(BaseScraper):\`
- Override the \`async def extract(self, **kwargs)\` method for your logic.
- Use \`self.get(url, headers)\` and \`self.post(url, headers, json)\` - these methods automatically handle:
  - 429 rate limits with exponential backoff
  - Retry with jitter
  - Circuit breaking after 10 failures
  - Adaptive throttling based on X-RateLimit headers
- Use \`self.get_json(url)\` or \`self.post_json(url, json=data)\` for automatic JSON parsing.
- The base class handles session management, so DO NOT create your own httpx.AsyncClient.

**3. The Blueprint Data:**
- **Target URL:** \`${blueprint.targetUrl}\`
- **Method:** \`${blueprint.method}\`
- **Essential Headers (pass to self.get/post):**
\`\`\`json
${headersJson}
\`\`\`
${bodySection}${dynamicParamsSection}
**4. The Pydantic Models (Use this exact code):**
\`\`\`python
${blueprint.pydanticModels}
\`\`\`

**5. Extraction Logic:**
\`\`\`python
${blueprint.extractionLogic}
\`\`\`

**6. Implementation Template:**
\`\`\`python
from app.scraping.base import BaseScraper
from pydantic import BaseModel
from typing import Optional, List
from loguru import logger

# Pydantic Models
${blueprint.pydanticModels}

class ${blueprint.responseModelName}Spider(BaseScraper):
    """
    ${blueprint.responseModelName} Spider
    
    Target: ${blueprint.targetUrl}
    Method: ${blueprint.method}
    """
    
    def __init__(self):
        super().__init__(
            rate_limit_delay=1.0,  # Base delay between requests
            randomize_delay=True,  # Add jitter to avoid detection
            max_retries=5,
        )
        # Essential headers for this API
        self._headers.update(${headersJson.replace(/\n/g, '\n        ')})
    
    async def extract(self${blueprint.dynamicParams.length > 0 ? ', ' + blueprint.dynamicParams.join(': str, ') + ': str' : ''}) -> ${blueprint.responseModelName}:
        """
        Main extraction method.
        Uses self.get_json() which automatically handles retries, rate limits, and errors.
        """
        url = f"${blueprint.targetUrl.replace(/\{([^}]+)\}/g, '{$1}')}"
        
        ${blueprint.method === 'GET' ? 'data = await self.get_json(url)' : 'data = await self.post_json(url, json={})'}
        
        return ${blueprint.responseModelName}(**data)


# Example usage:
# async def main():
#     async with ${blueprint.responseModelName}Spider() as spider:
#         result = await spider.extract(${blueprint.dynamicParams.length > 0 ? blueprint.dynamicParams.map(p => `${p}="..."`).join(', ') : ''})
#         print(result)
\`\`\`

**7. Key Points:**
- DO inherit from \`BaseScraper\` - it provides military-grade error handling.
- DO use \`self.get()\`, \`self.post()\`, \`self.get_json()\`, \`self.post_json()\`.
- DO NOT create your own httpx.AsyncClient or implement retry logic (BaseScraper handles it).
- DO NOT implement 429 handling (BaseScraper handles it with exponential backoff).
- DO use the async context manager: \`async with Spider() as spider:\`

Generate the complete spider file now.`;
}

export default function BlueprintViewer({ blueprint, onClose }: BlueprintViewerProps) {
  const [copied, setCopied] = useState(false);
  const [showModels, setShowModels] = useState(false);
  const [showLogic, setShowLogic] = useState(false);
  
  // Deploy state
  const [showDeployPanel, setShowDeployPanel] = useState(false);
  const [deployStatus, setDeployStatus] = useState<DeployStatus | null>(null);
  const [generatedCode, setGeneratedCode] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<{ success: boolean; prUrl?: string; error?: string } | null>(null);

  const megaPrompt = generateMegaPrompt(blueprint);

  // Check GitHub configuration on mount
  useEffect(() => {
    const checkDeployStatus = async () => {
      try {
        const response = await fetch('/api/dojo/deploy');
        const data = await response.json();
        setDeployStatus(data);
      } catch {
        setDeployStatus({ configured: false, owner: null, repo: null });
      }
    };
    checkDeployStatus();
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(megaPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeploy = async () => {
    if (!generatedCode.trim()) {
      setDeployResult({ success: false, error: 'Please paste the generated code first' });
      return;
    }

    setIsDeploying(true);
    setDeployResult(null);

    try {
      const response = await fetch('/api/dojo/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: generatedCode,
          blueprint,
          instructions: megaPrompt,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setDeployResult({ success: true, prUrl: data.prUrl });
      } else {
        setDeployResult({ success: false, error: data.error || 'Deployment failed' });
      }
    } catch (error) {
      setDeployResult({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Network error' 
      });
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#8055a6]/20 rounded-lg">
              <FileCode className="w-5 h-5 text-[#e272db]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-200 font-mono">
                Blueprint: {blueprint.id}
              </h2>
              <p className="text-xs text-slate-500 font-mono">
                {blueprint.filename}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Quick Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 font-mono mb-1">METHOD</div>
              <div className={`text-sm font-bold font-mono ${
                blueprint.method === 'GET' ? 'text-cyan-400' : 'text-green-400'
              }`}>
                {blueprint.method}
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 font-mono mb-1">MODEL</div>
              <div className="text-sm font-bold font-mono text-[#e272db]">
                {blueprint.responseModelName}
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 font-mono mb-1">HEADERS</div>
              <div className="text-sm font-bold font-mono text-slate-300">
                {Object.keys(blueprint.headers).length}
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 font-mono mb-1">PARAMS</div>
              <div className="text-sm font-bold font-mono text-slate-300">
                {blueprint.dynamicParams.length || 'None'}
              </div>
            </div>
          </div>

          {/* Target URL */}
          <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
            <div className="text-[10px] text-slate-500 font-mono mb-1">TARGET URL</div>
            <div className="font-mono text-xs text-slate-300 break-all">
              {blueprint.targetUrl}
            </div>
          </div>

          {/* Collapsible Sections */}
          <div className="space-y-2">
            {/* Pydantic Models */}
            <button
              onClick={() => setShowModels(!showModels)}
              className="w-full flex items-center gap-2 p-3 bg-slate-800/30 hover:bg-slate-800/50 rounded-lg border border-slate-700/50 transition-colors"
            >
              {showModels ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
              <span className="text-sm font-mono text-slate-300">Pydantic Models</span>
              <span className="text-[10px] text-slate-500 ml-auto">Click to expand</span>
            </button>
            {showModels && (
              <pre className="bg-slate-950 border border-slate-700/50 rounded-lg p-3 overflow-x-auto">
                <code className="text-xs text-green-400 font-mono">{blueprint.pydanticModels}</code>
              </pre>
            )}

            {/* Extraction Logic */}
            <button
              onClick={() => setShowLogic(!showLogic)}
              className="w-full flex items-center gap-2 p-3 bg-slate-800/30 hover:bg-slate-800/50 rounded-lg border border-slate-700/50 transition-colors"
            >
              {showLogic ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
              <span className="text-sm font-mono text-slate-300">Extraction Logic</span>
              <span className="text-[10px] text-slate-500 ml-auto">Click to expand</span>
            </button>
            {showLogic && (
              <pre className="bg-slate-950 border border-slate-700/50 rounded-lg p-3 overflow-x-auto">
                <code className="text-xs text-blue-400 font-mono">{blueprint.extractionLogic}</code>
              </pre>
            )}
          </div>

          {/* Mega Prompt Preview */}
          <div className="bg-slate-950 border border-[#8055a6]/30 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-3 bg-[#8055a6]/10 border-b border-[#8055a6]/30">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#e272db]" />
                <span className="text-sm font-bold font-mono text-[#e272db]">
                  MEGA-PROMPT FOR CURSOR
                </span>
              </div>
              <span className="text-[10px] text-slate-500">
                {megaPrompt.length.toLocaleString()} chars
              </span>
            </div>
            <pre className="p-4 overflow-x-auto max-h-64 text-xs text-slate-300 font-mono whitespace-pre-wrap">
              {megaPrompt}
            </pre>
          </div>

          {/* Deploy Panel (Expandable) */}
          {showDeployPanel && (
            <div className="bg-slate-950 border border-green-500/30 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-3 bg-green-500/10 border-b border-green-500/30">
                <div className="flex items-center gap-2">
                  <Github className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-bold font-mono text-green-400">
                    DEPLOY TO GITHUB
                  </span>
                </div>
                {deployStatus?.configured && (
                  <span className="text-[10px] text-slate-500">
                    {deployStatus.owner}/{deployStatus.repo}
                  </span>
                )}
              </div>

              <div className="p-4 space-y-4">
                {!deployStatus?.configured ? (
                  <div className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-yellow-400">GitHub Not Configured</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Set these environment variables in Railway:
                      </p>
                      <ul className="text-xs text-slate-500 mt-2 space-y-1 font-mono">
                        <li>• GITHUB_TOKEN</li>
                        <li>• GITHUB_OWNER</li>
                        <li>• GITHUB_REPO</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="text-[10px] text-slate-500 font-mono mb-1 block">
                        PASTE GENERATED CODE HERE
                      </label>
                      <textarea
                        value={generatedCode}
                        onChange={(e) => setGeneratedCode(e.target.value)}
                        placeholder="# Paste the Python spider code generated by Cursor here..."
                        className="w-full h-40 bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-300 placeholder-slate-600 focus:outline-none focus:border-green-500/50"
                      />
                    </div>

                    {deployResult && (
                      <div className={`p-3 rounded-lg border ${
                        deployResult.success 
                          ? 'bg-green-500/10 border-green-500/30' 
                          : 'bg-red-500/10 border-red-500/30'
                      }`}>
                        {deployResult.success ? (
                          <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-green-400" />
                            <span className="text-sm font-bold text-green-400">Pull Request Created!</span>
                            <a 
                              href={deployResult.prUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="ml-auto flex items-center gap-1 text-xs text-green-400 hover:underline"
                            >
                              View PR <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-400" />
                            <span className="text-sm text-red-400">{deployResult.error}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      onClick={handleDeploy}
                      disabled={isDeploying || !generatedCode.trim()}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-lg text-sm font-bold font-mono text-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isDeploying ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creating Pull Request...
                        </>
                      ) : (
                        <>
                          <Github className="w-4 h-4" />
                          Create Pull Request
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500 flex-1">
            {showDeployPanel 
              ? 'Paste code from Cursor, then deploy to GitHub' 
              : 'Copy prompt → Paste in Cursor → Deploy to GitHub'}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDeployPanel(!showDeployPanel)}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold font-mono transition-all border
                ${showDeployPanel
                  ? 'bg-green-500/20 text-green-400 border-green-500/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-green-500/30 hover:text-green-400'
                }
              `}
            >
              <Github className="w-4 h-4" />
              {showDeployPanel ? 'Hide Deploy' : 'Deploy'}
            </button>
            <button
              onClick={handleCopy}
              className={`
                flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold font-mono transition-all
                ${copied 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                  : 'bg-gradient-to-r from-[#e272db] to-[#8055a6] text-white hover:opacity-90 shadow-lg'
                }
              `}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Mega-Prompt
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
