'use client';

import AppLayout from '../../components/AppLayout';
import DLQViewer from '../../components/DLQViewer';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function FailedLeadsPage() {
  return (
    <AppLayout>
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href="/pipeline"
            className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#e272db] via-[#8055a6] to-[#54317d] bg-clip-text text-transparent flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              Failed Leads
            </h1>
            <p className="text-slate-400 mt-1">
              Manage leads that failed during enrichment
            </p>
          </div>
        </div>

        {/* DLQ Viewer - Full Width */}
        <DLQViewer />

        {/* Info Panel */}
        <div className="panel-inactive rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-200 mb-4">About Failed Leads</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-slate-400">
            <div>
              <h4 className="text-[#e272db] font-medium mb-2">Common Failure Reasons</h4>
              <ul className="space-y-1 list-disc list-inside">
                <li>API rate limits exceeded</li>
                <li>Invalid or incomplete lead data</li>
                <li>Skip-tracing service unavailable</li>
                <li>Network timeout during enrichment</li>
                <li>DNC check service error</li>
              </ul>
            </div>
            <div>
              <h4 className="text-[#e272db] font-medium mb-2">Retry Strategy</h4>
              <ul className="space-y-1 list-disc list-inside">
                <li>Leads are automatically retried up to 3 times</li>
                <li>Use "Retry" to manually re-queue a single lead</li>
                <li>Use "Retry All" to re-queue all failed leads</li>
                <li>Leads will go back to the main queue for processing</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
