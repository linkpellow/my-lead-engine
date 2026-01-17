'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Loader2,
  Globe,
  Radio,
  Sparkles,
  FileCode,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  User,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import type { CapturedRequest } from '../../dojo/types';

// Field configuration
const TARGET_FIELDS = [
  { key: 'phone', label: 'Phone', icon: Phone, priority: 1 },
  { key: 'age', label: 'Age', icon: Calendar, priority: 2 },
  { key: 'income', label: 'Income', icon: DollarSign, priority: 3 },
  { key: 'address', label: 'Address', icon: MapPin, priority: 4 },
  { key: 'email', label: 'Email', icon: Mail, priority: 5 },
  { key: 'name', label: 'Name', icon: User, priority: 6 },
  { key: 'city', label: 'City', icon: MapPin, priority: 7 },
  { key: 'state', label: 'State', icon: MapPin, priority: 8 },
  { key: 'zipcode', label: 'Zipcode', icon: MapPin, priority: 9 },
];

// Wizard steps
type WizardStep = 'waiting' | 'confirm' | 'extracting' | 'analyze' | 'complete';

interface FieldStatus {
  status: 'verified' | 'untested' | 'failed';
  selector: string;
  lastValue?: string;
  lastTested?: string;
}

interface SiteRecord {
  id: string;
  domain: string;
  name: string;
  favicon: string;
  status: 'draft' | 'mapping' | 'mapped' | 'blocked' | 'broken';
  createdAt: string;
  updatedAt: string;
  blueprint: {
    targetUrl: string;
    method: string;
    responseType: 'html' | 'json';
    headers: Record<string, string>;
    extraction: Record<string, string>;
  };
  fields: Record<string, FieldStatus>;
  lastTested?: string;
  successRate: number;
  totalTests: number;
  lastError?: string;
}

interface ExtractedField {
  fieldType: string;
  value: string;
  selector?: string;
  confidence?: number;
}

interface SiteMappingWizardProps {
  site: SiteRecord;
  requests: CapturedRequest[];
  onComplete: (updatedSite: SiteRecord) => void;
  onCancel: () => void;
}

export default function SiteMappingWizard({
  site,
  requests,
  onComplete,
  onCancel,
}: SiteMappingWizardProps) {
  const [step, setStep] = useState<WizardStep>('waiting');
  const [detectedDomain, setDetectedDomain] = useState<string | null>(null);
  const [confirmedRequests, setConfirmedRequests] = useState<CapturedRequest[]>([]);
  const [extractedFields, setExtractedFields] = useState<Map<string, ExtractedField>>(new Map());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [generatedBlueprint, setGeneratedBlueprint] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Watch for matching domain in traffic
  useEffect(() => {
    if (step !== 'waiting') return;

    // Look for requests matching the target domain
    const matchingRequests = requests.filter(req => {
      const reqDomain = req.domain?.toLowerCase() || '';
      const targetDomain = site.domain.toLowerCase();
      return reqDomain.includes(targetDomain) || targetDomain.includes(reqDomain);
    });

    if (matchingRequests.length > 0) {
      // Found matching traffic
      const firstMatch = matchingRequests[0];
      setDetectedDomain(firstMatch.domain);
      setStep('confirm');
    }
  }, [requests, site.domain, step]);

  // After confirmation, start extracting fields
  useEffect(() => {
    if (step !== 'extracting') return;

    // Filter requests for confirmed domain
    const domainRequests = requests.filter(req => {
      const reqDomain = req.domain?.toLowerCase() || '';
      return reqDomain === detectedDomain?.toLowerCase();
    });

    setConfirmedRequests(domainRequests);

    // Extract fields from all requests
    const fieldMap = new Map<string, ExtractedField>();

    for (const req of domainRequests) {
      const fields = req.extractedFields || [];
      for (const field of fields) {
        // Keep the first (or best) value for each field type
        if (!fieldMap.has(field.fieldType) || 
            (field.value && field.value.length > (fieldMap.get(field.fieldType)?.value?.length || 0))) {
          fieldMap.set(field.fieldType, {
            fieldType: field.fieldType,
            value: field.value,
            selector: '', // Will be determined by analysis
          });
        }
      }
    }

    setExtractedFields(fieldMap);
  }, [step, requests, detectedDomain]);

  // Handle domain confirmation
  const handleConfirmDomain = (confirmed: boolean) => {
    if (confirmed) {
      setStep('extracting');
    } else {
      // Reset and wait for more traffic
      setDetectedDomain(null);
      setStep('waiting');
    }
  };

  // Handle analyze - generate blueprint
  const handleAnalyze = async () => {
    if (confirmedRequests.length === 0) {
      setError('No requests captured. Browse the site to capture more data.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      // Find the best request (one with most extracted fields)
      const bestRequest = confirmedRequests.reduce((best, req) => {
        const bestCount = best.extractedFields?.length || 0;
        const reqCount = req.extractedFields?.length || 0;
        return reqCount > bestCount ? req : best;
      }, confirmedRequests[0]);

      // Call analyze API
      const response = await fetch('/api/dojo/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request: {
            id: bestRequest.id,
            url: bestRequest.url,
            method: bestRequest.method,
            status: bestRequest.status,
            domain: detectedDomain,
          },
          goal: 'Extract person data: phone, email, address, age, income',
          mode: 'blueprint',
          extractedFields: Array.from(extractedFields.values()),
        }),
      });

      const data = await response.json();

      if (data.success && data.blueprint) {
        setGeneratedBlueprint(data.blueprint);
        setStep('analyze');
      } else {
        // Generate a basic blueprint from extracted data
        const basicBlueprint = generateBasicBlueprint(bestRequest, extractedFields);
        setGeneratedBlueprint(basicBlueprint);
        setStep('analyze');
      }
    } catch (err: any) {
      console.error('Analysis failed:', err);
      // Still generate a basic blueprint
      const basicBlueprint = generateBasicBlueprint(confirmedRequests[0], extractedFields);
      setGeneratedBlueprint(basicBlueprint);
      setStep('analyze');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Generate basic blueprint from captured data
  const generateBasicBlueprint = (request: CapturedRequest, fields: Map<string, ExtractedField>) => {
    const url = new URL(request.url);
    
    // Build extraction map
    const extraction: Record<string, string> = {};
    fields.forEach((field, key) => {
      // Default CSS selectors based on field type (these are estimates)
      const defaultSelectors: Record<string, string> = {
        phone: "a[href^='tel:']::text",
        email: "a[href^='mailto:']::text",
        age: "span.age::text",
        address: "div.address::text",
        income: "span.income::text",
        name: "h1.name::text",
        city: "span.city::text",
        state: "span.state::text",
        zipcode: "span.zip::text",
      };
      extraction[key] = field.selector || defaultSelectors[key] || '';
    });

    return {
      domain: detectedDomain,
      targetUrl: `${url.protocol}//${url.hostname}${url.pathname}`,
      method: request.method,
      responseType: 'html',
      extraction,
      generatedAt: new Date().toISOString(),
    };
  };

  // Save blueprint and complete
  const handleSaveBlueprint = async () => {
    if (!generatedBlueprint) return;

    try {
      // Update site with new blueprint
      const updatedSite: SiteRecord = {
        ...site,
        status: 'mapped',
        blueprint: {
          targetUrl: generatedBlueprint.targetUrl || site.blueprint.targetUrl,
          method: generatedBlueprint.method || 'GET',
          responseType: generatedBlueprint.responseType || 'html',
          headers: site.blueprint.headers,
          extraction: generatedBlueprint.extraction || {},
        },
        fields: { ...site.fields },
      };

      // Update field statuses
      extractedFields.forEach((field, key) => {
        if (updatedSite.fields[key]) {
          updatedSite.fields[key] = {
            status: 'verified',
            selector: generatedBlueprint.extraction?.[key] || '',
            lastValue: field.value,
          };
        }
      });

      // Save to API
      await fetch('/api/dojo/site-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          site: updatedSite,
        }),
      });

      // Also save blueprint to blueprints directory
      await fetch('/api/dojo/blueprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: site.domain,
          ...updatedSite.blueprint,
        }),
      });

      setStep('complete');
      setTimeout(() => onComplete(updatedSite), 1500);
    } catch (err) {
      console.error('Failed to save blueprint:', err);
      setError('Failed to save blueprint. Please try again.');
    }
  };

  // Render step indicator
  const renderStepIndicator = () => {
    const steps = [
      { key: 'waiting', label: 'Browse Site' },
      { key: 'confirm', label: 'Confirm' },
      { key: 'extracting', label: 'Extract' },
      { key: 'analyze', label: 'Blueprint' },
      { key: 'complete', label: 'Done' },
    ];

    const currentIndex = steps.findIndex(s => s.key === step);

    return (
      <div className="flex items-center justify-center gap-2 mb-6">
        {steps.map((s, idx) => (
          <div key={s.key} className="flex items-center">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
              idx < currentIndex ? 'bg-emerald-500/20 text-emerald-400' :
              idx === currentIndex ? 'bg-purple-500/20 text-purple-400' :
              'bg-slate-800 text-slate-500'
            }`}>
              {idx < currentIndex ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : idx === currentIndex ? (
                <Circle className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Circle className="w-3.5 h-3.5" />
              )}
              {s.label}
            </div>
            {idx < steps.length - 1 && (
              <div className={`w-8 h-0.5 mx-1 ${
                idx < currentIndex ? 'bg-emerald-500/50' : 'bg-slate-700'
              }`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <img 
              src={site.favicon} 
              alt={site.name}
              className="w-8 h-8 rounded-lg bg-slate-700"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23666"><circle cx="12" cy="12" r="10"/></svg>';
              }}
            />
            <div>
              <h2 className="font-bold text-slate-200">Mapping: {site.name}</h2>
              <p className="text-xs text-slate-500">{site.domain}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-slate-400 hover:text-slate-300 hover:bg-slate-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 pt-4">
          {renderStepIndicator()}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Waiting for traffic */}
          {step === 'waiting' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                <Radio className="w-10 h-10 text-purple-400 animate-pulse" />
              </div>
              <h3 className="text-xl font-bold text-slate-200 mb-2">
                Browse {site.name}
              </h3>
              <p className="text-slate-400 mb-6 max-w-md mx-auto">
                Open <span className="text-purple-400 font-mono">{site.domain}</span> on your phone 
                through the proxy. Search for a person to capture the data endpoints.
              </p>
              
              <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Waiting for traffic from {site.domain}...
              </div>

              <div className="mt-8 p-4 bg-slate-800/50 rounded-xl text-left max-w-md mx-auto">
                <p className="text-xs text-slate-400 mb-2">📱 Quick Start:</p>
                <ol className="text-xs text-slate-500 space-y-1">
                  <li>1. Ensure your phone is connected to the proxy (port 8888)</li>
                  <li>2. Open Safari/Chrome and go to {site.domain}</li>
                  <li>3. Search for a common name like "John Smith Miami FL"</li>
                  <li>4. Traffic will appear here automatically</li>
                </ol>
              </div>
            </div>
          )}

          {/* Step 2: Confirm domain */}
          {step === 'confirm' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                <Globe className="w-10 h-10 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-200 mb-2">
                Site Detected
              </h3>
              <p className="text-slate-400 mb-6">
                Is this the correct site?
              </p>

              <div className="inline-flex items-center gap-3 px-6 py-4 bg-slate-800/50 rounded-xl mb-8">
                <img 
                  src={`https://www.google.com/s2/favicons?domain=${detectedDomain}&sz=64`}
                  alt=""
                  className="w-10 h-10 rounded-lg"
                />
                <div className="text-left">
                  <p className="font-bold text-slate-200">{detectedDomain}</p>
                  <p className="text-xs text-slate-500">
                    {requests.filter(r => r.domain === detectedDomain).length} requests captured
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => handleConfirmDomain(false)}
                  className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                  No, Try Again
                </button>
                <button
                  onClick={() => handleConfirmDomain(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors"
                >
                  <Check className="w-5 h-5" />
                  Yes, Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Extracting fields */}
          {step === 'extracting' && (
            <div>
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-slate-200 mb-2">
                  Extracting Data Fields
                </h3>
                <p className="text-slate-400">
                  {confirmedRequests.length} requests captured • 
                  {extractedFields.size} fields found
                </p>
              </div>

              {/* Field grid */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {TARGET_FIELDS.map(field => {
                  const extracted = extractedFields.get(field.key);
                  const Icon = field.icon;

                  return (
                    <div
                      key={field.key}
                      className={`p-4 rounded-xl border ${
                        extracted 
                          ? 'bg-emerald-500/10 border-emerald-500/30' 
                          : 'bg-slate-800/50 border-slate-700/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={`w-4 h-4 ${extracted ? 'text-emerald-400' : 'text-slate-500'}`} />
                        <span className={`text-sm font-medium ${extracted ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {field.label}
                        </span>
                        {extracted ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-auto" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-600 ml-auto" />
                        )}
                      </div>
                      {extracted && (
                        <p className="text-xs text-slate-300 font-mono truncate">
                          {extracted.value}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Continue browsing hint */}
              <div className="text-center text-sm text-slate-500 mb-6">
                <RefreshCw className="w-4 h-4 inline mr-1 animate-spin" />
                Keep browsing to find more fields, or click Analyze when ready
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg px-4 py-3 mb-6">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              {/* Analyze button */}
              <div className="flex justify-center">
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || extractedFields.size === 0}
                  className="flex items-center gap-2 px-8 py-3 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Analyze & Create Blueprint
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Blueprint ready */}
          {step === 'analyze' && generatedBlueprint && (
            <div>
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                  <FileCode className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-200 mb-2">
                  Blueprint Generated
                </h3>
                <p className="text-slate-400">
                  Review the extraction rules below
                </p>
              </div>

              {/* Blueprint preview */}
              <div className="bg-slate-800/50 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-300">Target URL</span>
                  <span className="text-xs text-slate-500 font-mono">{generatedBlueprint.method}</span>
                </div>
                <p className="text-sm text-slate-400 font-mono bg-slate-900/50 rounded-lg px-3 py-2 mb-4 break-all">
                  {generatedBlueprint.targetUrl}
                </p>

                <p className="text-sm font-medium text-slate-300 mb-2">Extraction Rules</p>
                <div className="space-y-2">
                  {Object.entries(generatedBlueprint.extraction || {}).map(([field, selector]) => (
                    <div key={field} className="flex items-center justify-between text-sm">
                      <span className="text-emerald-400">{field}</span>
                      <span className="text-slate-500 font-mono text-xs">{selector as string || 'auto-detect'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg px-4 py-3 mb-6">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              {/* Save button */}
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => setStep('extracting')}
                  className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back
                </button>
                <button
                  onClick={handleSaveBlueprint}
                  className="flex items-center gap-2 px-8 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors"
                >
                  <Check className="w-5 h-5" />
                  Save & Finish
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Complete */}
          {step === 'complete' && (
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-400" />
              </div>
              <h3 className="text-2xl font-bold text-slate-200 mb-2">
                Mapping Complete!
              </h3>
              <p className="text-slate-400">
                {site.name} is now ready for enrichment
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
