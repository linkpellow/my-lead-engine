'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Fingerprint, 
  Phone, 
  Mail, 
  MapPin, 
  User, 
  Calendar,
  DollarSign,
  Building,
  Briefcase,
  Globe,
  Hash,
  RefreshCw,
  Save,
  Sparkles,
  TrendingUp
} from 'lucide-react';

// Field type to icon mapping
const FIELD_ICONS: Record<string, React.ReactNode> = {
  phone: <Phone className="w-3.5 h-3.5" />,
  email: <Mail className="w-3.5 h-3.5" />,
  address: <MapPin className="w-3.5 h-3.5" />,
  city: <MapPin className="w-3.5 h-3.5" />,
  state: <MapPin className="w-3.5 h-3.5" />,
  zipcode: <Hash className="w-3.5 h-3.5" />,
  age: <Calendar className="w-3.5 h-3.5" />,
  dob: <Calendar className="w-3.5 h-3.5" />,
  income: <DollarSign className="w-3.5 h-3.5" />,
  name: <User className="w-3.5 h-3.5" />,
  first_name: <User className="w-3.5 h-3.5" />,
  last_name: <User className="w-3.5 h-3.5" />,
  gender: <User className="w-3.5 h-3.5" />,
  employer: <Building className="w-3.5 h-3.5" />,
  job_title: <Briefcase className="w-3.5 h-3.5" />,
  linkedin_url: <Globe className="w-3.5 h-3.5" />,
  facebook_url: <Globe className="w-3.5 h-3.5" />,
  ssn_last4: <Fingerprint className="w-3.5 h-3.5" />,
};

// Field type to color mapping
const FIELD_COLORS: Record<string, string> = {
  phone: 'text-white bg-white/20 border-white/30',
  email: 'text-white bg-white/20 border-white/30',
  address: 'text-white bg-white/20 border-white/30',
  city: 'text-white bg-white/20 border-white/30',
  state: 'text-white bg-white/20 border-white/30',
  zipcode: 'text-white bg-white/20 border-white/30',
  age: 'text-white bg-white/20 border-white/30',
  dob: 'text-white bg-white/20 border-white/30',
  income: 'text-white bg-white/20 border-white/30',
  name: 'text-white bg-white/20 border-white/30',
  first_name: 'text-white bg-white/20 border-white/30',
  last_name: 'text-white bg-white/20 border-white/30',
  gender: 'text-white bg-white/20 border-white/30',
  employer: 'text-white bg-white/20 border-white/30',
  job_title: 'text-white bg-white/20 border-white/30',
  linkedin_url: 'text-white bg-white/20 border-white/30',
  facebook_url: 'text-white bg-white/20 border-white/30',
  ssn_last4: 'text-white bg-white/20 border-white/30',
};

interface ExtractedFieldSummary {
  fieldType: string;
  fieldName: string;
  sampleValues: string[];
  count: number;
  lastSeenAt: number;
  sources: string[];
}

interface ExtractedFieldsData {
  summary: ExtractedFieldSummary[];
  totalFields: number;
  uniqueFields: number;
}

interface ExtractedFieldsPanelProps {
  onSaveConfig?: (domain: string, fields: ExtractedFieldSummary[]) => void;
  focusDomain?: string;
}

export default function ExtractedFieldsPanel({ 
  onSaveConfig,
  focusDomain 
}: ExtractedFieldsPanelProps) {
  const [fieldsData, setFieldsData] = useState<ExtractedFieldsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const [expandedField, setExpandedField] = useState<string | null>(null);

  // Fetch extracted fields from API
  const fetchFields = useCallback(async () => {
    try {
      const response = await fetch('/api/dojo/ingest');
      const data = await response.json();
      
      if (data.success && data.extractedFields) {
        setFieldsData(data.extractedFields);
        setLastUpdate(Date.now());
      }
    } catch (error) {
      console.error('[ExtractedFieldsPanel] Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Poll every 3 seconds
  useEffect(() => {
    fetchFields();
    const interval = setInterval(fetchFields, 3000);
    return () => clearInterval(interval);
  }, [fetchFields]);

  // Group fields by type for display
  const groupedFields = fieldsData?.summary.reduce((acc, field) => {
    if (!acc[field.fieldType]) {
      acc[field.fieldType] = [];
    }
    acc[field.fieldType].push(field);
    return acc;
  }, {} as Record<string, ExtractedFieldSummary[]>) || {};

  // Priority order for lead-related fields
  const priorityOrder = [
    'phone', 'email', 'address', 'zipcode', 'age', 'income',
    'name', 'first_name', 'last_name', 'city', 'state',
    'dob', 'employer', 'job_title', 'gender'
  ];

  const sortedFieldTypes = Object.keys(groupedFields).sort((a, b) => {
    const aIdx = priorityOrder.indexOf(a);
    const bIdx = priorityOrder.indexOf(b);
    if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });

  const handleSaveConfig = () => {
    if (onSaveConfig && focusDomain && fieldsData) {
      onSaveConfig(focusDomain, fieldsData.summary);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col bg-black/80 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
        <div className="flex items-center justify-center h-full">
          <RefreshCw className="w-5 h-5 text-gray-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-black/80 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/20 bg-black/50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-white" />
          <span className="text-sm font-semibold text-white font-mono">EXTRACTED FIELDS</span>
          {fieldsData && (
            <span className="text-xs text-gray-500 font-mono">
              ({fieldsData.uniqueFields} types, {fieldsData.totalFields} total)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Live indicator */}
          <div className="flex items-center gap-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            <span className="text-[10px] text-white font-mono">LIVE</span>
          </div>
          
          {/* Save Config Button */}
          {onSaveConfig && focusDomain && (
            <button
              onClick={handleSaveConfig}
              className="flex items-center gap-1 px-2 py-1 text-xs font-mono bg-white/20 text-white rounded border border-white/30 hover:bg-white/30 transition-colors"
            >
              <Save className="w-3 h-3" />
              SAVE
            </button>
          )}
        </div>
      </div>

      {/* Fields List */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-700">
        {sortedFieldTypes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
            <Fingerprint className="w-10 h-10 mb-3 opacity-50" />
            <p className="text-sm font-mono">No fields extracted yet</p>
            <p className="text-xs mt-1 text-center">
              Browse sites with lead data to see<br/>extracted fields appear here
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedFieldTypes.map((fieldType) => {
              const fields = groupedFields[fieldType];
              const totalCount = fields.reduce((sum, f) => sum + f.count, 0);
              const colorClass = FIELD_COLORS[fieldType] || 'text-gray-400 bg-white/20 border-white/30';
              const icon = FIELD_ICONS[fieldType] || <Hash className="w-3.5 h-3.5" />;
              const isExpanded = expandedField === fieldType;
              
              return (
                <div 
                  key={fieldType}
                  className={`border rounded-lg overflow-hidden ${colorClass.split(' ').slice(1).join(' ')}`}
                >
                  {/* Field Type Header */}
                  <button
                    onClick={() => setExpandedField(isExpanded ? null : fieldType)}
                    className="w-full flex items-center gap-2 p-2.5 hover:bg-white/5 transition-colors"
                  >
                    <span className={colorClass.split(' ')[0]}>
                      {icon}
                    </span>
                    <span className={`font-mono text-sm font-bold uppercase ${colorClass.split(' ')[0]}`}>
                      {fieldType.replace(/_/g, ' ')}
                    </span>
                    <span className="flex-1" />
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 font-mono">
                        {fields.length} keys
                      </span>
                      <span className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${colorClass}`}>
                        {totalCount}x
                      </span>
                      <TrendingUp className={`w-3 h-3 ${totalCount > 5 ? 'text-white' : 'text-gray-500'}`} />
                    </div>
                  </button>
                  
                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-white/20 bg-black/50 p-2 space-y-2">
                      {fields.map((field, idx) => (
                        <div key={idx} className="text-xs font-mono">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-gray-300">{field.fieldName}</span>
                            <span className="text-gray-500">{field.count}x</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {field.sampleValues.slice(0, 3).map((val, i) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 bg-black text-gray-300 rounded text-[10px] truncate max-w-[150px]"
                                title={val}
                              >
                                {val}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      {fieldsData && fieldsData.totalFields > 0 && (
        <div className="border-t border-white/20 p-2 bg-black/30">
          <div className="flex items-center justify-between text-[10px] font-mono text-gray-500">
            <span>
              Last update: {new Date(lastUpdate).toLocaleTimeString()}
            </span>
            <span className="text-white">
              {fieldsData.totalFields} extractions
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
