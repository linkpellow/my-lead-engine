/**
 * Cooldown Manager
 * Prevents system overload by implementing cooldown periods after error spikes
 */

const COOLDOWN_DURATION = 5 * 60 * 1000; // 5 minutes
const ERROR_THRESHOLD = 5; // Number of errors before cooldown
const ERROR_WINDOW = 60 * 1000; // 1 minute window

interface ErrorRecord {
  timestamp: number;
}

let errorHistory: ErrorRecord[] = [];
let cooldownUntil: number | null = null;

/**
 * Record an error for cooldown tracking
 */
export async function recordError(): Promise<void> {
  const now = Date.now();
  
  // Clean old errors outside the window
  errorHistory = errorHistory.filter(err => now - err.timestamp < ERROR_WINDOW);
  
  // Add new error
  errorHistory.push({ timestamp: now });
  
  // Check if we've hit the threshold
  if (errorHistory.length >= ERROR_THRESHOLD) {
    cooldownUntil = now + COOLDOWN_DURATION;
    console.warn(`[COOLDOWN] Error threshold reached. Cooldown active until ${new Date(cooldownUntil).toISOString()}`);
  }
}

/**
 * Check if system is currently in cooldown
 */
export async function isInCooldown(): Promise<boolean> {
  if (cooldownUntil === null) {
    return false;
  }
  
  const now = Date.now();
  
  if (now >= cooldownUntil) {
    // Cooldown expired, reset
    cooldownUntil = null;
    errorHistory = [];
    return false;
  }
  
  return true;
}

/**
 * Get remaining cooldown time in milliseconds
 */
export async function getCooldownRemaining(): Promise<number> {
  if (cooldownUntil === null) {
    return 0;
  }
  
  const now = Date.now();
  return Math.max(0, cooldownUntil - now);
}

/**
 * Clear cooldown (for manual override)
 */
export async function clearCooldown(): Promise<void> {
  cooldownUntil = null;
  errorHistory = [];
}