'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Bug, 
  Play, 
  Clock, 
  Users, 
  FileCode,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Pause,
  ExternalLink,
  MoreVertical,
  Trash2
} from 'lucide-react';
import type { SpiderBot } from '@/app/spiders/types';
import { getStatusDisplay, formatFileSize, formatRelativeTime } from '@/app/spiders/types';

interface SpiderCardProps {
  spider: SpiderBot;
  onRun: (spiderId: string) => Promise<void>;
  onDelete?: (spiderId: string) => Promise<void>;
}

export default function SpiderCard({ spider, onRun, onDelete }: SpiderCardProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  
  const statusInfo = getStatusDisplay(spider.status);
  
  const handleRun = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsRunning(true);
    try {
      await onRun(spider.id);
    } finally {
      setIsRunning(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMenu(false);
    if (onDelete && confirm(`Archive spider "${spider.name}"? This can be restored later.`)) {
      await onDelete(spider.id);
    }
  };

  const getStatusIcon = () => {
    switch (spider.status) {
      case 'running':
        return <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Pause className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="group relative bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl overflow-hidden hover:border-[#e272db]/30 transition-all duration-300 hover:shadow-lg hover:shadow-[#e272db]/5">
      {/* Glassmorphic shine effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
      
      {/* Status indicator bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${
        spider.status === 'running' ? 'bg-yellow-400 animate-pulse' :
        spider.status === 'success' ? 'bg-green-400' :
        spider.status === 'error' ? 'bg-red-400' :
        'bg-slate-700'
      }`} />

      {/* Content */}
      <div className="p-5 relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#8055a6]/20 rounded-lg">
              <Bug className="w-5 h-5 text-[#e272db]" />
            </div>
            <div>
              <Link 
                href={`/spiders/${spider.id}`}
                className="font-bold text-slate-200 hover:text-[#e272db] transition-colors font-mono text-sm flex items-center gap-1"
              >
                {spider.name}
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                {spider.filename}
              </p>
            </div>
          </div>
          
          {/* Menu */}
          <div className="relative">
            <button
              onClick={(e) => { e.preventDefault(); setShowMenu(!showMenu); }}
              className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
            >
              <MoreVertical className="w-4 h-4 text-slate-500" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-8 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10 py-1 min-w-[120px]">
                <Link
                  href={`/spiders/${spider.id}`}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  View Source
                </Link>
                {onDelete && (
                  <button
                    onClick={handleDelete}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-slate-700 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Archive
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-slate-400 mb-4 line-clamp-2 min-h-[32px]">
          {spider.description}
        </p>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-slate-800/50 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              {getStatusIcon()}
            </div>
            <div className={`text-[10px] font-mono ${statusInfo.color}`}>
              {statusInfo.text}
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-[10px] font-mono text-slate-300">
              {spider.totalLeads.toLocaleString()}
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              {formatRelativeTime(spider.lastRunAt)}
            </div>
          </div>
        </div>

        {/* Classes Found */}
        {spider.classes.length > 0 && (
          <div className="mb-4">
            <div className="text-[10px] text-slate-500 font-mono mb-1.5">CLASSES</div>
            <div className="flex flex-wrap gap-1">
              {spider.classes.map((cls, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-[#8055a6]/20 text-[#e272db] text-[10px] font-mono rounded"
                >
                  {cls.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <FileCode className="w-3 h-3" />
            <span>{formatFileSize(spider.size)}</span>
            <span className="text-slate-700">•</span>
            <span>{formatRelativeTime(spider.lastModified)}</span>
          </div>
          
          <button
            onClick={handleRun}
            disabled={isRunning || spider.status === 'running'}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all
              ${isRunning || spider.status === 'running'
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30'
              }
            `}
          >
            {isRunning || spider.status === 'running' ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Running
              </>
            ) : (
              <>
                <Play className="w-3 h-3" />
                Run
              </>
            )}
          </button>
        </div>

        {/* Error display */}
        {spider.lastError && spider.status === 'error' && (
          <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-[10px] text-red-400 font-mono line-clamp-2">
              {spider.lastError}
            </p>
          </div>
        )}
      </div>

      {/* Click outside to close menu */}
      {showMenu && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setShowMenu(false)} 
        />
      )}
    </div>
  );
}
