'use client';

import AppLayout from '../../components/AppLayout';
import QueueMonitor from '../../components/QueueMonitor';
import { Workflow, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function QueuePage() {
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
              <Workflow className="w-6 h-6 text-[#e272db]" />
              Queue Monitor
            </h1>
            <p className="text-slate-400 mt-1">
              Real-time view of the enrichment queue
            </p>
          </div>
        </div>

        {/* Queue Monitor - Full Width */}
        <div className="max-w-2xl">
          <QueueMonitor />
        </div>

        {/* Info Panel */}
        <div className="panel-inactive rounded-xl p-6 max-w-2xl">
          <h3 className="text-lg font-semibold text-slate-200 mb-4">How the Queue Works</h3>
          <div className="space-y-3 text-sm text-slate-400">
            <p>
              <span className="text-[#e272db] font-medium">1. Discovery:</span>{' '}
              Leads are scraped from LinkedIn/Facebook and added to the queue.
            </p>
            <p>
              <span className="text-[#e272db] font-medium">2. Enrichment:</span>{' '}
              Workers pull leads from the queue and enrich them with phone, email, and demographic data.
            </p>
            <p>
              <span className="text-[#e272db] font-medium">3. Validation:</span>{' '}
              Each lead is validated (phone type, DNC status) before being saved.
            </p>
            <p>
              <span className="text-[#e272db] font-medium">4. Storage:</span>{' '}
              Successfully enriched leads are saved to the database and appear in "Enriched Leads".
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
