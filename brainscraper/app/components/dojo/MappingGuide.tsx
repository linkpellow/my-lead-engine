'use client';

import { useState, useEffect } from 'react';
import {
  Target,
  Search,
  CheckCircle,
  Circle,
  ArrowRight,
  Smartphone,
  MousePointer,
  Database,
  Wand2,
  Rocket,
  Shield,
  AlertTriangle,
  Bot,
} from 'lucide-react';

export type MappingStep = 
  | 'set_target'      // Define target fields
  | 'start_capture'   // Start mitmproxy and connect device
  | 'browse_site'     // Browse the target site on mobile
  | 'identify_routes' // Identify data-containing routes
  | 'verify_fields'   // Verify field extraction works
  | 'generate_spider' // Generate spider blueprint
  | 'deploy'          // Deploy to GitHub
  | 'complete';       // All done, monitoring

export interface MappingProgress {
  currentStep: MappingStep;
  completedSteps: MappingStep[];
  targetFields: string[];
  discoveredFields: string[];
  goldenRoutes: number;
  totalRoutes: number;
  siteStatus: 'mapping' | 'verifying' | 'complete' | 'broken';
}

interface MappingGuideProps {
  domain?: string;
  progress: MappingProgress;
  onStepAction: (step: MappingStep, action: string) => void;
}

const STEPS: Array<{
  id: MappingStep;
  title: string;
  description: string;
  icon: React.ReactNode;
  instructions: string[];
}> = [
  {
    id: 'set_target',
    title: 'Set Target Fields',
    description: 'Tell me what data you want to extract',
    icon: <Target className="w-4 h-4" />,
    instructions: [
      'Type the fields you need: phone, email, address, age, income, etc.',
      'I\'ll help you find endpoints that contain this data.',
    ],
  },
  {
    id: 'start_capture',
    title: 'Connect Device',
    description: 'Set up mobile proxy connection',
    icon: <Smartphone className="w-4 h-4" />,
    instructions: [
      'Run: DOJO_API_URL=https://brainscraper.io ./start_dojo_proxy.sh',
      'Configure phone proxy to your Mac\'s IP:8888',
      'Install CA certificate from http://mitm.it',
    ],
  },
  {
    id: 'browse_site',
    title: 'Browse Target Site',
    description: 'Navigate the site on your phone',
    icon: <MousePointer className="w-4 h-4" />,
    instructions: [
      'Open the target site on your phone (e.g., FastPeopleSearch)',
      'Perform a search that returns the data you need',
      'Navigate through results to capture all API calls',
    ],
  },
  {
    id: 'identify_routes',
    title: 'Identify Routes',
    description: 'Find endpoints with your target data',
    icon: <Search className="w-4 h-4" />,
    instructions: [
      'Look for routes that return JSON data',
      'Check the Extracted Fields panel for matches',
      'Click Analyze on promising routes',
    ],
  },
  {
    id: 'verify_fields',
    title: 'Verify Extraction',
    description: 'Confirm field extraction works correctly',
    icon: <Shield className="w-4 h-4" />,
    instructions: [
      'Ensure all target fields are detected',
      'Check sample values are correct',
      'I\'ll mark the site as verified once confirmed',
    ],
  },
  {
    id: 'generate_spider',
    title: 'Generate Spider',
    description: 'Create spider blueprint from golden routes',
    icon: <Wand2 className="w-4 h-4" />,
    instructions: [
      'Click Generate Blueprint on golden routes',
      'Review the generated Pydantic models',
      'Adjust extraction logic if needed',
    ],
  },
  {
    id: 'deploy',
    title: 'Deploy Spider',
    description: 'Push spider to GitHub for execution',
    icon: <Rocket className="w-4 h-4" />,
    instructions: [
      'Click Deploy to push spider to GitHub',
      'Spider will be auto-added to scrapegoat/spiders/',
      'Monitoring will begin automatically',
    ],
  },
  {
    id: 'complete',
    title: 'Complete',
    description: 'Site fully mapped and monitored',
    icon: <CheckCircle className="w-4 h-4" />,
    instructions: [
      'Spider is deployed and running',
      'Health monitoring is active',
      'I\'ll alert you if endpoints break',
    ],
  },
];

function getStepIndex(step: MappingStep): number {
  return STEPS.findIndex(s => s.id === step);
}

export default function MappingGuide({ 
  domain, 
  progress, 
  onStepAction 
}: MappingGuideProps) {
  const currentStepIndex = getStepIndex(progress.currentStep);
  const currentStepInfo = STEPS.find(s => s.id === progress.currentStep);
  
  // Calculate completion percentage
  const completionPercent = Math.round(
    (progress.completedSteps.length / (STEPS.length - 1)) * 100
  );
  
  // Check if target fields are being found
  const targetFieldsFound = progress.targetFields.filter(
    tf => progress.discoveredFields.some(df => df.toLowerCase().includes(tf.toLowerCase()))
  );
  const fieldMatchPercent = progress.targetFields.length > 0
    ? Math.round((targetFieldsFound.length / progress.targetFields.length) * 100)
    : 0;

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-700/50 bg-slate-800/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-[#e272db]" />
            <span className="text-xs font-bold text-slate-200 font-mono">MAPPING GUIDE</span>
            {domain && (
              <span className="text-[10px] text-slate-500">• {domain}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className={`text-[10px] font-mono px-2 py-0.5 rounded ${
              progress.siteStatus === 'complete' 
                ? 'bg-green-500/20 text-green-400' 
                : progress.siteStatus === 'broken'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {progress.siteStatus.toUpperCase()}
            </div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-500">Progress</span>
            <span className="text-[10px] text-slate-400">{completionPercent}%</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#e272db] to-[#8055a6] transition-all duration-500"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Step Progress */}
      <div className="px-3 py-2 border-b border-slate-700/30">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1">
          {STEPS.slice(0, -1).map((step, idx) => {
            const isCompleted = progress.completedSteps.includes(step.id);
            const isCurrent = progress.currentStep === step.id;
            
            return (
              <div key={step.id} className="flex items-center">
                <div 
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                    isCompleted 
                      ? 'bg-green-500/20 text-green-400' 
                      : isCurrent
                      ? 'bg-[#8055a6]/30 text-[#e272db]'
                      : 'bg-slate-700/50 text-slate-500'
                  }`}
                  title={step.title}
                >
                  {isCompleted ? (
                    <CheckCircle className="w-3.5 h-3.5" />
                  ) : isCurrent ? (
                    step.icon
                  ) : (
                    <Circle className="w-3.5 h-3.5" />
                  )}
                </div>
                {idx < STEPS.length - 2 && (
                  <div className={`w-4 h-0.5 ${
                    isCompleted ? 'bg-green-500/50' : 'bg-slate-700'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Step Instructions */}
      {currentStepInfo && progress.currentStep !== 'complete' && (
        <div className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#8055a6]/20 rounded text-[#e272db]">
              {currentStepInfo.icon}
            </div>
            <div>
              <div className="text-sm font-bold text-slate-200">{currentStepInfo.title}</div>
              <div className="text-[10px] text-slate-500">{currentStepInfo.description}</div>
            </div>
          </div>
          
          <div className="space-y-1.5 mt-2">
            {currentStepInfo.instructions.map((instruction, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs text-slate-400">
                <ArrowRight className="w-3 h-3 mt-0.5 text-[#e272db] flex-shrink-0" />
                <span>{instruction}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Field Match Status */}
      {progress.targetFields.length > 0 && progress.currentStep !== 'set_target' && (
        <div className="px-3 py-2 border-t border-slate-700/30 bg-slate-900/30">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-slate-500">Target Fields</span>
            <span className={`text-[10px] font-mono ${
              fieldMatchPercent >= 100 ? 'text-green-400' :
              fieldMatchPercent >= 50 ? 'text-yellow-400' :
              'text-slate-500'
            }`}>
              {targetFieldsFound.length}/{progress.targetFields.length} found
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {progress.targetFields.map(field => {
              const found = progress.discoveredFields.some(
                df => df.toLowerCase().includes(field.toLowerCase())
              );
              return (
                <span
                  key={field}
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                    found 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-slate-700/50 text-slate-500'
                  }`}
                >
                  {found && <CheckCircle className="w-2 h-2 inline mr-0.5" />}
                  {field}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Golden Routes Indicator */}
      {progress.goldenRoutes > 0 && (
        <div className="px-3 py-2 border-t border-slate-700/30 bg-yellow-500/5">
          <div className="flex items-center gap-2">
            <Database className="w-3 h-3 text-yellow-400" />
            <span className="text-[10px] text-yellow-400 font-mono">
              {progress.goldenRoutes} GOLDEN ROUTE{progress.goldenRoutes > 1 ? 'S' : ''} IDENTIFIED
            </span>
          </div>
        </div>
      )}

      {/* Complete State */}
      {progress.currentStep === 'complete' && (
        <div className="p-3 bg-green-500/10 border-t border-green-500/20">
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-bold">Site Mapping Complete!</span>
          </div>
          <p className="text-xs text-green-400/70 mt-1">
            Spider deployed and monitoring is active.
          </p>
        </div>
      )}
    </div>
  );
}
