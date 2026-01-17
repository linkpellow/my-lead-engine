'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Users, 
  Sparkles, 
  ListTodo, 
  Settings, 
  LogOut, 
  Activity,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Workflow,
  Sword,
  Bug
} from 'lucide-react';
import BackgroundJobs from './BackgroundJobs';
import { useState, useEffect } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavItem[];
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [pipelineExpanded, setPipelineExpanded] = useState(false);
  const [failedCount, setFailedCount] = useState(0);

  // Auto-expand pipeline section if on a pipeline page
  useEffect(() => {
    if (pathname.startsWith('/pipeline')) {
      setPipelineExpanded(true);
    }
  }, [pathname]);

  // Fetch failed count for badge
  useEffect(() => {
    const fetchFailedCount = async () => {
      try {
        const response = await fetch('/api/pipeline/status');
        const data = await response.json();
        if (data.success) {
          setFailedCount(data.queue?.failed_leads || 0);
        }
      } catch (error) {
        // Silently fail
      }
    };

    fetchFailedCount();
    const interval = setInterval(fetchFailedCount, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
      setLoggingOut(false);
    }
  };

  const navItems: NavItem[] = [
    {
      href: '/',
      label: 'Lead Generation',
      icon: Sparkles,
    },
    {
      href: '/dojo',
      label: 'The Dojo',
      icon: Sword,
    },
    {
      href: '/spiders',
      label: 'Spider Fleet',
      icon: Bug,
    },
    {
      href: '/enrichment-queue',
      label: 'Scrape History',
      icon: ListTodo,
    },
    {
      href: '/enriched',
      label: 'Enriched Leads',
      icon: Users,
    },
  ];

  const pipelineItems: NavItem[] = [
    {
      href: '/pipeline',
      label: 'Overview',
      icon: Activity,
    },
    {
      href: '/pipeline/queue',
      label: 'Queue',
      icon: Workflow,
    },
    {
      href: '/pipeline/failed',
      label: 'Failed Leads',
      icon: AlertTriangle,
    },
  ];

  const isPipelineActive = pathname.startsWith('/pipeline');

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 z-50 flex flex-col sidebar-panel">
      {/* Logo/Header */}
      <div className="p-6 border-b border-white/20">
        <div className="flex items-center gap-2">
          <img 
            src="/logo.png" 
            alt="BrainScraper Logo" 
            className="w-14 h-14 object-contain"
          />
          <h1 className="text-xl font-bold text-white">
            BrainScraper
          </h1>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {/* Main Nav Items */}
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg state-transition
                ${
                  isActive
                    ? 'nav-active text-white bg-white/10'
                    : 'nav-inactive text-gray-400 hover:text-white hover:bg-white/5'
                }
              `}
            >
              <Icon className={`w-4 h-4 state-transition ${isActive ? 'text-white' : 'text-gray-500'}`} />
              <span className={`font-medium text-sm ${isActive ? 'text-white' : ''}`}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* Pipeline Section (Collapsible) */}
        <div className="pt-2">
          <button
            onClick={() => setPipelineExpanded(!pipelineExpanded)}
            className={`
              w-full flex items-center justify-between px-4 py-3 rounded-lg state-transition
              ${isPipelineActive ? 'nav-active text-white bg-white/10' : 'nav-inactive text-gray-400 hover:text-white hover:bg-white/5'}
            `}
          >
            <div className="flex items-center gap-3">
              <Activity className={`w-4 h-4 ${isPipelineActive ? 'text-white' : 'text-gray-500'}`} />
              <span className={`font-medium text-sm ${isPipelineActive ? 'text-white' : ''}`}>
                Pipeline
              </span>
              {failedCount > 0 && (
                <span className="bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {failedCount}
                </span>
              )}
            </div>
            {pipelineExpanded ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {/* Pipeline Sub-items */}
          {pipelineExpanded && (
            <div className="mt-1 ml-4 space-y-1">
              {pipelineItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                const showBadge = item.href === '/pipeline/failed' && failedCount > 0;
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      flex items-center justify-between px-4 py-2 rounded-lg state-transition text-sm
                      ${isActive ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : ''}`} />
                      <span>{item.label}</span>
                    </div>
                    {showBadge && (
                      <span className="bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">
                        {failedCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="pt-2">
          <Link
            href="/settings"
            className={`
              flex items-center gap-3 px-4 py-3 rounded-lg state-transition
              ${pathname === '/settings' ? 'nav-active text-white bg-white/10' : 'nav-inactive text-gray-400 hover:text-white hover:bg-white/5'}
            `}
          >
            <Settings className={`w-4 h-4 state-transition ${pathname === '/settings' ? 'text-white' : 'text-gray-500'}`} />
            <span className={`font-medium text-sm ${pathname === '/settings' ? 'text-white' : ''}`}>
              Settings
            </span>
          </Link>
        </div>
      </nav>

      {/* Background Jobs Widget */}
      <div className="p-4 border-t border-white/20">
        <BackgroundJobs />
      </div>

      {/* Logout Button */}
      <div className="p-4 border-t border-white/20">
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <LogOut className="w-4 h-4" />
          <span className="font-medium text-sm">
            {loggingOut ? 'Logging out...' : 'Logout'}
          </span>
        </button>
      </div>
    </aside>
  );
}
