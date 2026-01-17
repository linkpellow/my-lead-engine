/**
 * File Locking Utilities
 * Provides mutex-style locking for file operations to prevent race conditions
 * 
 * CRITICAL: Use this when reading + modifying + writing data files
 * to ensure no concurrent writes corrupt the data
 */

// In-memory lock store (per-process only)
// For multi-process scenarios, use proper file-based locking
const locks = new Map<string, Promise<void>>();
const lockWaiters = new Map<string, Array<() => void>>();

/**
 * Acquire a lock for a specific resource (file path)
 * Returns a release function that must be called when done
 * 
 * @param resource - The resource identifier (usually file path)
 * @returns Promise that resolves to a release function
 */
export async function acquireLock(resource: string): Promise<() => void> {
  // Wait for any existing lock to be released
  while (locks.has(resource)) {
    await locks.get(resource);
  }
  
  // Create a new lock
  let releaseFn: () => void = () => {};
  const lockPromise = new Promise<void>((resolve) => {
    releaseFn = () => {
      locks.delete(resource);
      resolve();
      
      // Wake up any waiters
      const waiters = lockWaiters.get(resource) || [];
      if (waiters.length > 0) {
        const nextWaiter = waiters.shift();
        if (nextWaiter) {
          nextWaiter();
        }
        if (waiters.length === 0) {
          lockWaiters.delete(resource);
        }
      }
    };
  });
  
  locks.set(resource, lockPromise);
  
  return releaseFn;
}

/**
 * Execute a function with exclusive access to a resource
 * Automatically acquires and releases the lock
 * 
 * @param resource - The resource identifier (usually file path)
 * @param fn - The async function to execute with the lock held
 * @returns The result of the function
 * 
 * @example
 * ```typescript
 * await withLock('/path/to/file.json', async () => {
 *   const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
 *   data.push(newItem);
 *   fs.writeFileSync(filePath, JSON.stringify(data));
 * });
 * ```
 */
export async function withLock<T>(
  resource: string,
  fn: () => Promise<T> | T
): Promise<T> {
  const release = await acquireLock(resource);
  
  try {
    const result = await fn();
    return result;
  } finally {
    release();
  }
}

/**
 * Check if a resource is currently locked
 * Note: This is informational only and may be stale by the time you use it
 * 
 * @param resource - The resource identifier
 * @returns True if locked
 */
export function isLocked(resource: string): boolean {
  return locks.has(resource);
}

/**
 * Get the number of active locks
 * Useful for debugging
 */
export function getActiveLockCount(): number {
  return locks.size;
}

/**
 * Clear all locks (use with caution, mainly for testing)
 */
export function clearAllLocks(): void {
  locks.clear();
  lockWaiters.clear();
}

/**
 * Timeout wrapper for lock operations
 * Throws if lock cannot be acquired within timeout
 * 
 * @param resource - The resource identifier
 * @param fn - The function to execute
 * @param timeoutMs - Timeout in milliseconds
 * @returns The result of the function
 */
export async function withLockTimeout<T>(
  resource: string,
  fn: () => Promise<T> | T,
  timeoutMs: number = 30000
): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Lock timeout after ${timeoutMs}ms for resource: ${resource}`));
    }, timeoutMs);
  });
  
  try {
    const result = await Promise.race([
      withLock(resource, fn),
      timeoutPromise,
    ]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}
