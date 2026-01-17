/**
 * LinkedIn Location Cache
 * Initializes the location cache on module load
 */

import { preloadCommonLocations } from './linkedinLocationDiscovery';

// Initialize cache on module load
try {
  preloadCommonLocations();
  console.log('[LINKEDIN_CACHE] Location cache initialized');
} catch (error) {
  console.warn('[LINKEDIN_CACHE] Failed to initialize cache:', error);
}

export { preloadCommonLocations };
