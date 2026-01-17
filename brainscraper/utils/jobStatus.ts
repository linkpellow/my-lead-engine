/**
 * Job Status Management Utilities
 * 
 * Manages background job statuses using file-based storage
 * Jobs are stored in the data directory under jobs/
 */

import * as fs from 'fs';
import * as path from 'path';
import { getDataDirectory, safeReadFile, safeWriteFile } from './dataDirectory';

export interface JobStatus {
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

const JOBS_DIR = 'jobs';

/**
 * Get the jobs directory path
 */
function getJobsDirectory(): string {
  const dataDir = getDataDirectory();
  const jobsDir = path.join(dataDir, JOBS_DIR);
  
  // Ensure directory exists
  if (!fs.existsSync(jobsDir)) {
    fs.mkdirSync(jobsDir, { recursive: true });
  }
  
  return jobsDir;
}

/**
 * Get the file path for a job
 */
function getJobFilePath(jobId: string): string {
  return path.join(getJobsDirectory(), `${jobId}.json`);
}

/**
 * Generate a unique job ID
 */
export function generateJobId(type: 'enrichment' | 'scraping'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${type}-${timestamp}-${random}`;
}

/**
 * Save job status to disk
 */
export function saveJobStatus(job: JobStatus): void {
  try {
    const filePath = getJobFilePath(job.jobId);
    safeWriteFile(filePath, JSON.stringify(job, null, 2));
  } catch (error) {
    console.error(`[jobStatus] Failed to save job ${job.jobId}:`, error);
  }
}

/**
 * Get job status by ID
 */
export function getJobStatus(jobId: string): JobStatus | null {
  try {
    const filePath = getJobFilePath(jobId);
    const content = safeReadFile(filePath);
    
    if (!content) {
      return null;
    }
    
    return JSON.parse(content) as JobStatus;
  } catch (error) {
    console.error(`[jobStatus] Failed to read job ${jobId}:`, error);
    return null;
  }
}

/**
 * Get all job statuses
 */
export function getAllJobStatuses(): JobStatus[] {
  try {
    const jobsDir = getJobsDirectory();
    
    if (!fs.existsSync(jobsDir)) {
      return [];
    }
    
    const jobs = fs.readdirSync(jobsDir)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(jobsDir, file);
        const content = safeReadFile(filePath);
        if (!content) return null;
        try {
          return JSON.parse(content) as JobStatus;
        } catch {
          return null;
        }
      })
      .filter((job): job is JobStatus => job !== null);
    
    return jobs;
  } catch (error) {
    console.error('[jobStatus] Failed to read all jobs:', error);
    return [];
  }
}

/**
 * Clean up old jobs
 */
export function cleanupOldJobs(daysToKeep: number = 30): { deleted: number; errors: string[] } {
  const errors: string[] = [];
  let deleted = 0;
  
  try {
    const jobsDir = getJobsDirectory();
    
    if (!fs.existsSync(jobsDir)) {
      return { deleted: 0, errors: [] };
    }
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffTime = cutoffDate.getTime();
    
    const files = fs.readdirSync(jobsDir)
      .filter(file => file.endsWith('.json'));
    
    for (const file of files) {
      try {
        const filePath = path.join(jobsDir, file);
        const stats = fs.statSync(filePath);
        const content = safeReadFile(filePath);
        
        if (!content) {
          // Delete empty or unreadable files
          fs.unlinkSync(filePath);
          deleted++;
          continue;
        }
        
        let job: JobStatus;
        try {
          job = JSON.parse(content);
        } catch {
          // Delete invalid JSON files
          fs.unlinkSync(filePath);
          deleted++;
          continue;
        }
        
        // Check if job is old and completed/failed
        const jobDate = new Date(job.completedAt || job.startedAt).getTime();
        const isOld = jobDate < cutoffTime;
        const isFinished = job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled';
        
        if (isOld && isFinished) {
          fs.unlinkSync(filePath);
          deleted++;
        }
      } catch (error) {
        const errorMsg = `Failed to process ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(`[jobStatus] ${errorMsg}`);
      }
    }
  } catch (error) {
    const errorMsg = `Failed to cleanup jobs: ${error instanceof Error ? error.message : 'Unknown error'}`;
    errors.push(errorMsg);
    console.error(`[jobStatus] ${errorMsg}`);
  }
  
  return { deleted, errors };
}
