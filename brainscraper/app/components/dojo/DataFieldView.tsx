'use client';

import { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Star,
  Phone,
  Mail,
  MapPin,
  User,
  Calendar,
  DollarSign,
  Hash,
  Building,
  Briefcase,
  Link as LinkIcon,
  Eye,
  EyeOff,
  Zap,
  Database,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  AlertTriangle,
} from 'lucide-react';
import { 
  classifyRequest, 
  groupByDomain, 
  type ClassifiedRequest,
} from '@/utils/requestClassifier';
import type { CapturedRequest } from '@/app/dojo/types';

interface DataFieldViewProps {
  requests: CapturedRequest[];
  targetDomain?: string;
  onSelectField: (fieldType: string, requests: CapturedRequest[]) => void;
  selectedFieldType?: string;
}

// Field type metadata
const FIELD_METADATA: Record<string, { 
  icon: React.ReactNode;
  label: string;
  color: string;
  priority: number;
}> = {
  phone: { icon: <Phone className="w-4 h-4" />, label: 'Phone', color: 'text-emerald-400', priority: 1 },
  email: { icon: <Mail className="w-4 h-4" />, label: 'Email', color: 'text-blue-400', priority: 2 },
  address: { icon: <MapPin className="w-4 h-4" />, label: 'Address', color: 'text-purple-400', priority: 3 },
  city: { icon: <MapPin className="w-4 h-4" />, label: 'City', color: 'text-purple-300', priority: 4 },
  state: { icon: <MapPin className="w-4 h-4" />, label: 'State', color: 'text-purple-300', priority: 5 },
  zipcode: { icon: <Hash className="w-4 h-4" />, label: 'Zipcode', color: 'text-indigo-400', priority: 6 },
  name: { icon: <User className="w-4 h-4" />, label: 'Name', color: 'text-cyan-400', priority: 7 },
  first_name: { icon: <User className="w-4 h-4" />, label: 'First Name', color: 'text-cyan-300', priority: 8 },
  last_name: { icon: <User className="w-4 h-4" />, label: 'Last Name', color: 'text-cyan-300', priority: 9 },
  age: { icon: <Calendar className="w-4 h-4" />, label: 'Age', color: 'text-amber-400', priority: 10 },
  dob: { icon: <Calendar className="w-4 h-4" />, label: 'Date of Birth', color: 'text-amber-300', priority: 11 },
  income: { icon: <DollarSign className="w-4 h-4" />, label: 'Income', color: 'text-green-400', priority: 12 },
  employer: { icon: <Building className="w-4 h-4" />, label: 'Employer', color: 'text-orange-400', priority: 13 },
  job_title: { icon: <Briefcase className="w-4 h-4" />, label: 'Job Title', color: 'text-orange-300', priority: 14 },
  linkedin_url: { icon: <LinkIcon className="w-4 h-4" />, label: 'LinkedIn', color: 'text-blue-300', priority: 15 },
  facebook_url: { icon: <LinkIcon className="w-4 h-4" />, label: 'Facebook', color: 'text-blue-200', priority: 16 },
  gender: { icon: <User className="w-4 h-4" />, label: 'Gender', color: 'text-pink-400', priority: 17 },
  ssn_last4: { icon: <Hash className="w-4 h-4" />, label: 'SSN Last 4', color: 'text-red-400', priority: 18 },
};

// Quality indicator component
function QualityBadge({ quality, validated }: { quality?: 'high' | 'medium' | 'low' | 'suspect'; validated?: boolean }) {
  if (!validated && !quality) {
    return (
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400" title="Not validated">
        <ShieldQuestion className="w-3 h-3" />
        <span className="text-[9px] font-mono">?</span>
      </div>
    );
  }
  
  switch (quality) {
    case 'high':
      return (
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400" title="High confidence - validated">
          <ShieldCheck className="w-3 h-3" />
          <span className="text-[9px] font-mono">HIGH</span>
        </div>
      );
    case 'medium':
      return (
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400" title="Medium confidence">
          <ShieldCheck className="w-3 h-3" />
          <span className="text-[9px] font-mono">MED</span>
        </div>
      );
    case 'low':
      return (
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400" title="Low confidence - may be false positive">
          <ShieldAlert className="w-3 h-3" />
          <span className="text-[9px] font-mono">LOW</span>
        </div>
      );
    case 'suspect':
      return (
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/20 text-red-400" title="Suspect - likely false positive">
          <AlertTriangle className="w-3 h-3" />
          <span className="text-[9px] font-mono">SUSPECT</span>
        </div>
      );
    default:
      return null;
  }
}

function FieldCard({ 
  fieldType,
  sampleValues,
  sourceCount,
  requestCount,
  isExpanded,
  onToggle,
  onSelect,
  isSelected,
  domains,
  avgQuality,
  highConfidenceCount,
}: {
  fieldType: string;
  sampleValues: string[];
  sourceCount: number;
  requestCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
  isSelected: boolean;
  domains: string[];
  avgQuality?: 'high' | 'medium' | 'low' | 'suspect';
  highConfidenceCount?: number;
}) {
  const meta = FIELD_METADATA[fieldType] || {
    icon: <Database className="w-4 h-4" />,
    label: fieldType,
    color: 'text-slate-400',
    priority: 99,
  };

  // Truncate sample values for display
  const displayValues = sampleValues.slice(0, 3);
  const hasMore = sampleValues.length > 3;

  return (
    <div className={`rounded-xl border transition-all ${
      isSelected
        ? 'border-purple-500/50 bg-purple-500/10'
        : avgQuality === 'suspect' 
          ? 'border-red-500/30 bg-red-500/5 hover:border-red-500/50'
          : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600/50'
    }`}>
      {/* Field Header - Click to select */}
      <button
        onClick={onSelect}
        className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors rounded-t-xl"
      >
        <div className={`${meta.color} flex-shrink-0`}>
          {meta.icon}
        </div>
        
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-slate-200">{meta.label}</span>
            <span className="text-[10px] text-slate-500 font-mono">
              {fieldType}
            </span>
            {/* Quality Badge */}
            <QualityBadge quality={avgQuality} validated={highConfidenceCount !== undefined} />
          </div>
          
          {/* Sample values preview */}
          <div className="flex flex-wrap gap-1.5 items-center">
            {displayValues.map((value, idx) => (
              <span 
                key={idx}
                className="text-[11px] px-2 py-0.5 bg-slate-700/50 text-slate-300 rounded font-mono truncate max-w-[200px]"
                title={value}
              >
                {value.length > 20 ? value.substring(0, 20) + '...' : value}
              </span>
            ))}
            {hasMore && (
              <span className="text-[11px] text-slate-500 font-mono">
                +{sampleValues.length - 3} more
              </span>
            )}
          </div>
        </div>
        
        {/* Stats */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-slate-500 font-mono">
            {requestCount} req{requestCount !== 1 ? 's' : ''}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="text-slate-500 hover:text-slate-400 transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </div>
      </button>
      
      {/* Expanded: Source details */}
      {isExpanded && (
        <div className="border-t border-slate-700/30 px-3 py-2 bg-slate-900/30">
          <div className="text-xs text-slate-500 mb-2">
            Found in {domains.length} domain{domains.length !== 1 ? 's' : ''}:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {domains.map(domain => (
              <span
                key={domain}
                className="text-[10px] px-2 py-1 bg-slate-700/30 text-slate-400 rounded font-mono"
              >
                {domain}
              </span>
            ))}
          </div>
          
          {/* All sample values */}
          {sampleValues.length > 3 && (
            <div className="mt-3">
              <div className="text-xs text-slate-500 mb-2">
                All {sampleValues.length} samples:
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {sampleValues.map((value, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] px-2 py-1 bg-slate-800/50 text-slate-300 rounded font-mono"
                  >
                    {value}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DataFieldView({
  requests,
  targetDomain,
  onSelectField,
  selectedFieldType,
}: DataFieldViewProps) {
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [showEmpty, setShowEmpty] = useState(false);

  // Group requests by extracted field type with quality scoring
  const fieldGroups = useMemo(() => {
    const fieldMap = new Map<string, {
      fieldType: string;
      sampleValues: string[];
      sourceCount: number;
      requestCount: number;
      domains: Set<string>;
      requests: CapturedRequest[];
      qualityScores: Array<'high' | 'medium' | 'low' | 'suspect'>;
      highConfidenceCount: number;
    }>();

    // Process all requests
    for (const req of requests) {
      const fields = req.extractedFields || [];
      
      for (const field of fields) {
        const fieldType = field.fieldType;
        
        if (!fieldMap.has(fieldType)) {
          fieldMap.set(fieldType, {
            fieldType,
            sampleValues: [],
            sourceCount: 0,
            requestCount: 0,
            domains: new Set(),
            requests: [],
            qualityScores: [],
            highConfidenceCount: 0,
          });
        }
        
        const group = fieldMap.get(fieldType)!;
        group.requests.push(req);
        group.requestCount++;
        group.domains.add(req.domain);
        
        // Track quality scores
        if (field.qualityScore) {
          group.qualityScores.push(field.qualityScore);
          if (field.qualityScore === 'high') {
            group.highConfidenceCount++;
          }
        }
        
        // Add sample value if unique and not empty
        const value = field.value?.trim();
        if (value && !group.sampleValues.includes(value)) {
          group.sampleValues.push(value);
          
          // Keep top 10 samples
          if (group.sampleValues.length > 10) {
            group.sampleValues = group.sampleValues.slice(0, 10);
          }
        }
      }
    }

    // Calculate average quality for each field group
    const calculateAvgQuality = (scores: Array<'high' | 'medium' | 'low' | 'suspect'>): 'high' | 'medium' | 'low' | 'suspect' | undefined => {
      if (scores.length === 0) return undefined;
      
      const scoreValues = { high: 3, medium: 2, low: 1, suspect: 0 };
      const avg = scores.reduce((sum, s) => sum + scoreValues[s], 0) / scores.length;
      
      if (avg >= 2.5) return 'high';
      if (avg >= 1.5) return 'medium';
      if (avg >= 0.5) return 'low';
      return 'suspect';
    };

    // Convert to array and sort by priority
    const fields = Array.from(fieldMap.values()).map(f => ({
      ...f,
      sourceCount: f.domains.size,
      domains: Array.from(f.domains),
      avgQuality: calculateAvgQuality(f.qualityScores),
    }));

    // Sort by priority (common fields first), then by request count
    // Also deprioritize suspect quality fields
    return fields.sort((a, b) => {
      // Suspect fields go to bottom
      if (a.avgQuality === 'suspect' && b.avgQuality !== 'suspect') return 1;
      if (b.avgQuality === 'suspect' && a.avgQuality !== 'suspect') return -1;
      
      const aPriority = FIELD_METADATA[a.fieldType]?.priority || 99;
      const bPriority = FIELD_METADATA[b.fieldType]?.priority || 99;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return b.requestCount - a.requestCount;
    });
  }, [requests]);

  // Stats
  const stats = useMemo(() => {
    const totalFields = fieldGroups.length;
    const totalSamples = fieldGroups.reduce((sum, f) => sum + f.sampleValues.length, 0);
    const totalDomains = new Set(fieldGroups.flatMap(f => f.domains)).size;
    
    return { totalFields, totalSamples, totalDomains };
  }, [fieldGroups]);

  const toggleField = (fieldType: string) => {
    setExpandedFields(prev => {
      const next = new Set(prev);
      if (next.has(fieldType)) {
        next.delete(fieldType);
      } else {
        next.add(fieldType);
      }
      return next;
    });
  };

  // Auto-expand selected field
  useMemo(() => {
    if (selectedFieldType && !expandedFields.has(selectedFieldType)) {
      setExpandedFields(prev => new Set([...prev, selectedFieldType]));
    }
  }, [selectedFieldType]);

  const visibleFields = showEmpty || fieldGroups.length > 0
    ? fieldGroups
    : [];

  return (
    <div className="h-full flex flex-col bg-slate-900/50 rounded-2xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-800/30">
        <div className="flex items-center gap-3">
          <Database className="w-4 h-4 text-purple-400" />
          <span className="font-semibold text-slate-200">Extracted Data</span>
          
          {/* Quick stats */}
          {stats.totalFields > 0 && (
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="text-purple-400">{stats.totalFields} fields</span>
              <span className="text-slate-500">{stats.totalSamples} samples</span>
              <span className="text-slate-500">{stats.totalDomains} sites</span>
            </div>
          )}
        </div>
        
        {/* Toggle empty state */}
        <button
          onClick={() => setShowEmpty(!showEmpty)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-mono transition-colors ${
            showEmpty 
              ? 'bg-slate-700 text-slate-300' 
              : 'bg-slate-800/50 text-slate-500'
          }`}
        >
          {showEmpty ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
        </button>
      </div>

      {/* Field List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {visibleFields.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 p-6">
            <Database className="w-8 h-8 mb-3 opacity-50" />
            <p className="text-sm">No data fields extracted yet</p>
            <p className="text-xs mt-1">Browse your target site to capture data</p>
          </div>
        ) : (
          visibleFields.map((group) => (
            <FieldCard
              key={group.fieldType}
              fieldType={group.fieldType}
              sampleValues={group.sampleValues}
              sourceCount={group.sourceCount}
              requestCount={group.requestCount}
              isExpanded={expandedFields.has(group.fieldType)}
              onToggle={() => toggleField(group.fieldType)}
              onSelect={() => onSelectField(group.fieldType, group.requests)}
              isSelected={selectedFieldType === group.fieldType}
              domains={group.domains}
              avgQuality={group.avgQuality}
              highConfidenceCount={group.highConfidenceCount}
            />
          ))
        )}
      </div>

      {/* Footer - Field count */}
      {fieldGroups.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-700/30 bg-slate-800/20">
          <div className="text-[11px] text-slate-500 text-center">
            {fieldGroups.length} data field{fieldGroups.length !== 1 ? 's' : ''} extracted from traffic
          </div>
        </div>
      )}
    </div>
  );
}
