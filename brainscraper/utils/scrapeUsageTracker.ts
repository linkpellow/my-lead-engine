/**
 * Scrape Usage Tracker
 * Tracks scraping usage for rate limiting and quota management
 */

import * as fs from 'fs';
import * as path from 'path';

interface UsageRecord {
  date: string; // YYYY-MM-DD
  count: number;
}

interface UsageData {
  daily: Record<string, number>; // date -> count
  monthly: Record<string, number>; // YYYY-MM -> count
  lastUpdated: string;
}

const USAGE_FILE = path.join(process.cwd(), 'data', 'scrape-usage.json');

function ensureDataDirectory(): void {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function loadUsageData(): UsageData {
  ensureDataDirectory();
  
  if (fs.existsSync(USAGE_FILE)) {
    try {
      const data = fs.readFileSync(USAGE_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading usage data:', error);
    }
  }
  
  return {
    daily: {},
    monthly: {},
    lastUpdated: new Date().toISOString(),
  };
}

function saveUsageData(data: UsageData): void {
  ensureDataDirectory();
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(USAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Increment scrape count for a service
 */
export async function incrementScrapeCount(service: string, count: number = 1): Promise<void> {
  const data = loadUsageData();
  const today = getTodayKey();
  const month = getCurrentMonthKey();
  
  // Increment daily count
  data.daily[today] = (data.daily[today] || 0) + count;
  
  // Increment monthly count
  data.monthly[month] = (data.monthly[month] || 0) + count;
  
  saveUsageData(data);
}

/**
 * Get daily usage for a service
 */
export async function getDailyUsage(service: string): Promise<number> {
  const data = loadUsageData();
  const today = getTodayKey();
  return data.daily[today] || 0;
}

/**
 * Get monthly usage for a service
 */
export async function getMonthlyUsage(service: string): Promise<number> {
  const data = loadUsageData();
  const month = getCurrentMonthKey();
  return data.monthly[month] || 0;
}

/**
 * Check if scrape limit is reached
 */
export async function checkScrapeLimit(
  service: string,
  dailyLimit: number,
  monthlyLimit: number
): Promise<{
  allowed: boolean;
  limitType?: 'daily' | 'monthly';
  currentCount: number;
  limit: number;
}> {
  const daily = await getDailyUsage(service);
  const monthly = await getMonthlyUsage(service);
  
  if (dailyLimit !== Infinity && daily >= dailyLimit) {
    return {
      allowed: false,
      limitType: 'daily',
      currentCount: daily,
      limit: dailyLimit,
    };
  }
  
  if (monthlyLimit !== Infinity && monthly >= monthlyLimit) {
    return {
      allowed: false,
      limitType: 'monthly',
      currentCount: monthly,
      limit: monthlyLimit,
    };
  }
  
  return {
    allowed: true,
    currentCount: Math.max(daily, monthly),
    limit: Math.min(dailyLimit, monthlyLimit),
  };
}

/**
 * Get usage statistics for all services
 */
export async function getUsageStats(
  dailyLimits: Record<string, number>,
  monthlyLimits: Record<string, number>
): Promise<{
  daily: Record<string, { current: number; limit: number; remaining: number }>;
  monthly: Record<string, { current: number; limit: number; remaining: number }>;
  lastUpdated: string;
}> {
  const data = loadUsageData();
  const today = getTodayKey();
  const month = getCurrentMonthKey();
  
  const daily: Record<string, { current: number; limit: number; remaining: number }> = {};
  const monthly: Record<string, { current: number; limit: number; remaining: number }> = {};
  
  // Get stats for each service
  for (const service of Object.keys(dailyLimits)) {
    const dailyCurrent = data.daily[today] || 0;
    const dailyLimit = dailyLimits[service] || Infinity;
    
    daily[service] = {
      current: dailyCurrent,
      limit: dailyLimit,
      remaining: dailyLimit === Infinity ? Infinity : Math.max(0, dailyLimit - dailyCurrent),
    };
    
    const monthlyCurrent = data.monthly[month] || 0;
    const monthlyLimit = monthlyLimits[service] || Infinity;
    
    monthly[service] = {
      current: monthlyCurrent,
      limit: monthlyLimit,
      remaining: monthlyLimit === Infinity ? Infinity : Math.max(0, monthlyLimit - monthlyCurrent),
    };
  }
  
  return {
    daily,
    monthly,
    lastUpdated: data.lastUpdated,
  };
}