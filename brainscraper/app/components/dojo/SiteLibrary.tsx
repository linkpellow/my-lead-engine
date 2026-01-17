'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, 
  RefreshCw, 
  ExternalLink, 
  Play,
  Settings,
  Trash2,
  Check,
  X,
  AlertTriangle,
  HelpCircle,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  User,
  Loader2,
  Globe,
  Shield,
  Zap,
  Crosshair,
} from 'lucide-react';
import SiteMappingWizard from './SiteMappingWizard';
import type { CapturedRequest } from '../../dojo/types';

// Field icons
const FIELD_ICONS: Record<string, React.ReactNode> = {
  phone: <Phone className="w-3 h-3" />,
  email: <Mail className="w-3 h-3" />,
  address: <MapPin className="w-3 h-3" />,
  age: <Calendar className="w-3 h-3" />,
  income: <DollarSign className="w-3 h-3" />,
  name: <User className="w-3 h-3" />,
  city: <MapPin className="w-3 h-3" />,
  state: <MapPin className="w-3 h-3" />,
  zipcode: <MapPin className="w-3 h-3" />,
};

// Priority fields to show in card
const PRIORITY_FIELDS = ['phone', 'age', 'income', 'address', 'email'];

// Status colors and icons
const STATUS_CONFIG = {
  draft: { color: 'text-slate-400', bg: 'bg-slate-500/20', icon: <HelpCircle className="w-3 h-3" /> },
  mapping: { color: 'text-blue-400', bg: 'bg-blue-500/20', icon: <RefreshCw className="w-3 h-3 animate-spin" /> },
  mapped: { color: 'text-emerald-400', bg: 'bg-emerald-500/20', icon: <Check className="w-3 h-3" /> },
  blocked: { color: 'text-amber-400', bg: 'bg-amber-500/20', icon: <Shield className="w-3 h-3" /> },
  broken: { color: 'text-red-400', bg: 'bg-red-500/20', icon: <X className="w-3 h-3" /> },
};

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

interface SiteLibraryProps {
  onSelectSite?: (site: SiteRecord) => void;
  requests?: CapturedRequest[];
}

export default function SiteLibrary({ onSelectSite, requests = [] }: SiteLibraryProps) {
  const [sites, setSites] = useState<SiteRecord[]>([]);
  const [stats, setStats] = useState({ total: 0, mapped: 0, blocked: 0, draft: 0 });
  const [loading, setLoading] = useState(true);
  const [testingSite, setTestingSite] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSiteDomain, setNewSiteDomain] = useState('');
  const [newSiteName, setNewSiteName] = useState('');
  const [mappingSite, setMappingSite] = useState<SiteRecord | null>(null);
  
  // Load sites
  const loadSites = async () => {
    try {
      const response = await fetch('/api/dojo/site-library');
      const data = await response.json();
      
      if (data.success) {
        setSites(data.sites);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load sites:', error);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadSites();
  }, []);
  
  // Add new site
  const handleAddSite = async () => {
    if (!newSiteDomain.trim()) return;
    
    try {
      const response = await fetch('/api/dojo/site-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          domain: newSiteDomain.trim(),
          name: newSiteName.trim() || undefined,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSites(prev => [...prev, data.site]);
        setShowAddModal(false);
        setNewSiteDomain('');
        setNewSiteName('');
      }
    } catch (error) {
      console.error('Failed to add site:', error);
    }
  };
  
  // Test a site
  const handleTestSite = async (site: SiteRecord) => {
    setTestingSite(site.id);
    
    try {
      // Call the scrapegoat test endpoint
      const response = await fetch('/api/dojo/test-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: site.id,
          domain: site.domain,
          blueprint: site.blueprint,
          testIdentity: {
            firstName: 'John',
            lastName: 'Smith',
            city: 'Miami',
            state: 'FL',
          },
        }),
      });
      
      const data = await response.json();
      
      // Record the test result
      await fetch('/api/dojo/site-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'recordTest',
          testResult: {
            siteId: site.id,
            success: data.success,
            extractedFields: data.extractedFields,
            error: data.error,
          },
        }),
      });
      
      // Reload sites
      await loadSites();
    } catch (error) {
      console.error('Test failed:', error);
    } finally {
      setTestingSite(null);
    }
  };
  
  // Delete a site
  const handleDeleteSite = async (siteId: string) => {
    if (!confirm('Delete this site and its blueprint?')) return;
    
    try {
      await fetch('/api/dojo/site-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          siteId,
        }),
      });
      
      setSites(prev => prev.filter(s => s.id !== siteId));
    } catch (error) {
      console.error('Failed to delete site:', error);
    }
  };
  
  // Begin mapping a site
  const handleBeginMapping = (site: SiteRecord) => {
    setMappingSite(site);
  };
  
  // Handle mapping complete
  const handleMappingComplete = (updatedSite: SiteRecord) => {
    setSites(prev => prev.map(s => s.id === updatedSite.id ? updatedSite : s));
    setMappingSite(null);
    loadSites(); // Refresh stats
  };
  
  // Render field status indicator
  const renderFieldStatus = (field: string, status: FieldStatus) => {
    const icon = FIELD_ICONS[field] || <HelpCircle className="w-3 h-3" />;
    
    let statusIcon;
    let statusColor;
    
    switch (status.status) {
      case 'verified':
        statusIcon = <Check className="w-2.5 h-2.5" />;
        statusColor = 'text-emerald-400';
        break;
      case 'failed':
        statusIcon = <X className="w-2.5 h-2.5" />;
        statusColor = 'text-red-400';
        break;
      default:
        statusIcon = <HelpCircle className="w-2.5 h-2.5" />;
        statusColor = 'text-slate-500';
    }
    
    return (
      <div 
        key={field}
        className={`flex items-center gap-1 px-2 py-1 rounded-md ${
          status.status === 'verified' ? 'bg-emerald-500/10' :
          status.status === 'failed' ? 'bg-red-500/10' :
          'bg-slate-800/50'
        }`}
        title={status.lastValue ? `Last: ${status.lastValue}` : 'Not tested'}
      >
        <span className={statusColor}>{icon}</span>
        <span className="text-xs text-slate-400 capitalize">{field}</span>
        <span className={statusColor}>{statusIcon}</span>
      </div>
    );
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-200">Site Library</h2>
          <p className="text-sm text-slate-500">
            {stats.total} sites • {stats.mapped} mapped • {stats.blocked} blocked
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={loadSites}
            className="p-2 text-slate-400 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Site
          </button>
        </div>
      </div>
      
      {/* Site Grid */}
      <div className="flex-1 overflow-y-auto">
        {sites.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Globe className="w-12 h-12 text-slate-600 mb-4" />
            <p className="text-slate-400 mb-2">No sites in your library</p>
            <p className="text-sm text-slate-600 mb-4">Add people search sites to start mapping</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30"
            >
              <Plus className="w-4 h-4" />
              Add Your First Site
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sites.map(site => {
              const statusConfig = STATUS_CONFIG[site.status];
              const isTesting = testingSite === site.id;
              
              return (
                <div
                  key={site.id}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 hover:border-purple-500/30 transition-all group"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
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
                        <h3 className="font-semibold text-slate-200">{site.name}</h3>
                        <p className="text-xs text-slate-500">{site.domain}</p>
                      </div>
                    </div>
                    
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${statusConfig.bg} ${statusConfig.color}`}>
                      {statusConfig.icon}
                      <span className="capitalize">{site.status}</span>
                    </div>
                  </div>
                  
                  {/* Fields */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {PRIORITY_FIELDS.map(field => 
                      site.fields[field] && renderFieldStatus(field, site.fields[field])
                    )}
                  </div>
                  
                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                    {site.totalTests > 0 && (
                      <>
                        <span>{Math.round(site.successRate)}% success</span>
                        <span>{site.totalTests} tests</span>
                      </>
                    )}
                    {site.lastTested && (
                      <span>Last: {new Date(site.lastTested).toLocaleDateString()}</span>
                    )}
                  </div>
                  
                  {/* Error message */}
                  {site.lastError && (
                    <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg px-2 py-1.5 mb-3">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{site.lastError}</span>
                    </div>
                  )}
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-700/50">
                    {/* Primary action: Begin Mapping or Test */}
                    {site.status === 'draft' || site.status === 'blocked' || site.status === 'broken' ? (
                      <button
                        onClick={() => handleBeginMapping(site)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors"
                      >
                        <Crosshair className="w-4 h-4" />
                        Begin Mapping
                      </button>
                    ) : (
                      <button
                        onClick={() => handleTestSite(site)}
                        disabled={isTesting}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                      >
                        {isTesting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                        {isTesting ? 'Testing...' : 'Test'}
                      </button>
                    )}
                    
                    <button
                      onClick={() => onSelectSite?.(site)}
                      className="p-2 text-slate-400 hover:text-slate-300 hover:bg-slate-700/50 rounded-lg transition-colors"
                      title="Edit blueprint"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    
                    <a
                      href={`https://${site.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-slate-400 hover:text-slate-300 hover:bg-slate-700/50 rounded-lg transition-colors"
                      title="Open site"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    
                    <button
                      onClick={() => handleDeleteSite(site.id)}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete site"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Add Site Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-slate-200 mb-4">Add New Site</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Domain *</label>
                <input
                  type="text"
                  value={newSiteDomain}
                  onChange={(e) => setNewSiteDomain(e.target.value)}
                  placeholder="fastpeoplesearch.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Display Name (optional)</label>
                <input
                  type="text"
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                  placeholder="Fast People Search"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-slate-400 hover:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSite}
                disabled={!newSiteDomain.trim()}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
              >
                Add Site
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Mapping Wizard */}
      {mappingSite && (
        <SiteMappingWizard
          site={mappingSite}
          requests={requests}
          onComplete={handleMappingComplete}
          onCancel={() => setMappingSite(null)}
        />
      )}
    </div>
  );
}
