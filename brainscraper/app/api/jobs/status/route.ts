/**
 * Background Jobs Status API Route
 * Returns list of active/completed background jobs
 * 
 * Note: This is a stub implementation. When a real job queue is implemented
 * (e.g., Redis-based or database-backed), this should query actual job status.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// In-memory job store (temporary - should be Redis or DB in production)
// This prevents 404 errors while providing a foundation for future implementation
const jobStore: Map<string, JobStatus> = new Map();

interface JobStatus {
  jobId: string;
  type: 'enrichment' | 'scraping';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  startedAt: string;
  completedAt?: string;
  error?: string;
  metadata?: {
    leadCount?: number;
    searchParams?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

/**
 * GET /api/jobs/status
 * Query params:
 *   - jobId: Get specific job status
 *   - activeOnly: Only return pending/running jobs (default: false)
 *   - limit: Maximum number of jobs to return (default: 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const activeOnly = searchParams.get('activeOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // If specific jobId requested
    if (jobId) {
      const job = jobStore.get(jobId);
      if (!job) {
        return NextResponse.json({
          success: false,
          error: 'Job not found',
          job: null,
        }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        job,
      });
    }

    // Get all jobs
    let jobs = Array.from(jobStore.values());

    // Filter to active only if requested
    if (activeOnly) {
      jobs = jobs.filter(j => j.status === 'pending' || j.status === 'running');
    }

    // Sort by startedAt descending (most recent first)
    jobs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    // Apply limit
    jobs = jobs.slice(0, limit);

    return NextResponse.json({
      success: true,
      jobs,
      total: jobs.length,
    });
  } catch (error) {
    console.error('Jobs status error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch job status',
      jobs: [],
    }, { status: 500 });
  }
}

/**
 * POST /api/jobs/status
 * Create or update a job status
 * Body: JobStatus object
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, type, status, progress, metadata, error: jobError } = body;

    if (!jobId) {
      return NextResponse.json({
        success: false,
        error: 'jobId is required',
      }, { status: 400 });
    }

    // Get existing job or create new one
    const existingJob = jobStore.get(jobId);
    const now = new Date().toISOString();

    const job: JobStatus = {
      jobId,
      type: type || existingJob?.type || 'enrichment',
      status: status || existingJob?.status || 'pending',
      progress: progress || existingJob?.progress || { current: 0, total: 0, percentage: 0 },
      startedAt: existingJob?.startedAt || now,
      metadata: { ...existingJob?.metadata, ...metadata },
      error: jobError,
    };

    // Set completedAt if job is finished
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      job.completedAt = now;
    }

    jobStore.set(jobId, job);

    // Clean up old completed jobs (keep last 100)
    const allJobs = Array.from(jobStore.entries());
    if (allJobs.length > 100) {
      const completedJobs = allJobs
        .filter(([, j]) => j.status === 'completed' || j.status === 'failed')
        .sort((a, b) => new Date(a[1].startedAt).getTime() - new Date(b[1].startedAt).getTime());
      
      // Remove oldest completed jobs
      const toRemove = completedJobs.slice(0, allJobs.length - 100);
      toRemove.forEach(([id]) => jobStore.delete(id));
    }

    return NextResponse.json({
      success: true,
      job,
    });
  } catch (error) {
    console.error('Job update error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update job status',
    }, { status: 500 });
  }
}

/**
 * DELETE /api/jobs/status
 * Cancel a job
 * Query params: jobId
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({
        success: false,
        error: 'jobId is required',
      }, { status: 400 });
    }

    const job = jobStore.get(jobId);
    if (!job) {
      return NextResponse.json({
        success: false,
        error: 'Job not found',
      }, { status: 404 });
    }

    // Mark as cancelled
    job.status = 'cancelled';
    job.completedAt = new Date().toISOString();
    jobStore.set(jobId, job);

    return NextResponse.json({
      success: true,
      job,
    });
  } catch (error) {
    console.error('Job cancel error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel job',
    }, { status: 500 });
  }
}
