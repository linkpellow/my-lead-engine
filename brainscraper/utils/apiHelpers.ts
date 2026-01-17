/**
 * API Helper Utilities
 * Production-ready utilities for API calls
 */

/**
 * Creates a fetch request with timeout
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 30000 // 30 seconds default
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableStatusCodes?: number[];
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableStatusCodes: [429, 500, 502, 503, 504],
};

/**
 * Retries a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const {
    maxRetries,
    initialDelayMs,
    maxDelayMs,
    backoffMultiplier,
    retryableStatusCodes,
  } = { ...DEFAULT_RETRY_CONFIG, ...config };

  let lastError: Error | null = null;
  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      const isRetryable = 
        attempt < maxRetries &&
        (
          // Network errors
          (error instanceof TypeError && error.message.includes('fetch')) ||
          // Timeout errors
          (error instanceof Error && error.message.includes('timeout')) ||
          // HTTP status codes (if available)
          (error && typeof error === 'object' && 'status' in error &&
            retryableStatusCodes.includes(error.status as number))
        );

      if (!isRetryable) {
        throw lastError;
      }

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * backoffMultiplier, maxDelayMs);
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Production-safe logger
 * Only logs in development or when explicitly enabled
 */
export const logger = {
  log: (message: string, data?: unknown) => {
    if (process.env.NODE_ENV === 'development' || process.env.ENABLE_API_LOGGING === 'true') {
      console.log(`[API] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  },
  
  error: (message: string, error?: unknown) => {
    // Always log errors, but sanitize sensitive data
    const sanitizedError = error instanceof Error 
      ? { message: error.message, stack: error.stack }
      : error;
    console.error(`[API Error] ${message}`, sanitizedError);
  },
  
  warn: (message: string, data?: unknown) => {
    if (process.env.NODE_ENV === 'development' || process.env.ENABLE_API_LOGGING === 'true') {
      console.warn(`[API Warning] ${message}`, data);
    }
  },
};

/**
 * Rate limiter using simple in-memory tracking
 * For production, consider using Redis or a dedicated rate limiting service
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check if request is allowed
   * @param key - Unique identifier for the rate limit (e.g., API endpoint)
   * @returns true if allowed, false if rate limited
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    // Remove old requests outside the window
    const recentRequests = requests.filter(timestamp => now - timestamp < this.windowMs);
    
    if (recentRequests.length >= this.maxRequests) {
      return false;
    }
    
    // Add current request
    recentRequests.push(now);
    this.requests.set(key, recentRequests);
    
    return true;
  }

  /**
   * Get time until next request is allowed (in ms)
   */
  getTimeUntilNext(key: string): number {
    const requests = this.requests.get(key) || [];
    if (requests.length === 0) return 0;
    
    const oldestRequest = Math.min(...requests);
    const timeSinceOldest = Date.now() - oldestRequest;
    const timeUntilWindow = this.windowMs - timeSinceOldest;
    
    return Math.max(0, timeUntilWindow);
  }

  /**
   * Clear rate limit for a key
   */
  clear(key: string): void {
    this.requests.delete(key);
  }

  /**
   * Clear all rate limits
   */
  clearAll(): void {
    this.requests.clear();
  }
}

// Singleton rate limiter instance
// Default: 5 requests per minute (conservative for RapidAPI)
const maxRequests = parseInt(process.env.RAPIDAPI_RATE_LIMIT_MAX || '5', 10);
const windowMs = parseInt(process.env.RAPIDAPI_RATE_LIMIT_WINDOW_MS || '60000', 10);
export const rateLimiter = new RateLimiter(maxRequests, windowMs);

/**
 * Validates request body size
 * @param body - Request body to validate
 * @param maxSizeBytes - Maximum allowed size in bytes
 */
export function validateRequestSize(body: unknown, maxSizeBytes: number = 1024 * 1024): boolean {
  if (!body) return true;
  
  const size = JSON.stringify(body).length;
  if (size > maxSizeBytes) {
    throw new Error(`Request body too large: ${size} bytes (max: ${maxSizeBytes})`);
  }
  
  return true;
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
