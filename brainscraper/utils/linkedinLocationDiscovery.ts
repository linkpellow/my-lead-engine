/**
 * LinkedIn Location ID Discovery Service
 * 
 * Production-ready solution for discovering LinkedIn location IDs dynamically.
 * Uses multiple APIs in priority order for maximum accuracy.
 * 
 * Strategy:
 * 1. Check cache first (fastest)
 * 2. Try location suggestions API (most accurate)
 * 3. Try HarvestAPI (reliable fallback)
 * 4. Try json_to_url endpoint (last resort)
 * 5. Fallback to keywords (always works but less accurate)
 */

import { findLocationId, LocationMapping } from './linkedinLocationIds';

export interface DiscoveryResult {
  locationId: string | null;
  fullId: string | null; // urn:li:fs_geo:<id>
  source: 'cache' | 'static' | 'suggestions' | 'harvest' | 'json_to_url' | 'failed';
  url?: string; // The generated Sales Navigator URL
}

// In-memory cache for discovered locations
const locationCache = new Map<string, DiscoveryResult>();

/**
 * Discovers LinkedIn location ID using filter_geography_location_region_suggestions
 * This is the fastest and most accurate method
 */
async function discoverLocationIdViaSuggestions(
  locationText: string,
  rapidApiKey: string
): Promise<DiscoveryResult | null> {
  try {
    const { findLocationByExactMatch } = await import('./linkedinLocationSuggestions');
    const suggestion = await findLocationByExactMatch(locationText, rapidApiKey);
    
    if (suggestion && suggestion.fullId) {
      const idMatch = suggestion.fullId.match(/urn:li:fs_geo:(\d+)/);
      if (idMatch) {
        return {
          locationId: idMatch[1],
          fullId: suggestion.fullId,
          source: 'suggestions',
        };
      }
    }
  } catch (error) {
    console.log(`Location suggestions API failed for "${locationText}":`, error);
  }
  
  return null;
}

/**
 * Discovers LinkedIn location ID using HarvestAPI
 */
async function discoverLocationIdViaHarvest(
  locationText: string,
  rapidApiKey: string
): Promise<DiscoveryResult | null> {
  try {
    const harvestResponse = await fetch(
      `https://harvest-api.p.rapidapi.com/linkedin/geo-id/search?location=${encodeURIComponent(locationText)}`,
      {
        method: 'GET',
        headers: {
          'x-rapidapi-key': rapidApiKey,
          'x-rapidapi-host': 'harvest-api.p.rapidapi.com',
        },
      }
    );

    if (harvestResponse.ok) {
      const data = await harvestResponse.json();
      let locationId: string | null = null;
      
      if (data.geoId) {
        locationId = String(data.geoId);
      } else if (data.id) {
        locationId = String(data.id);
      } else if (data.data?.geoId) {
        locationId = String(data.data.geoId);
      } else if (data.data?.id) {
        locationId = String(data.data.id);
      } else if (Array.isArray(data) && data.length > 0) {
        locationId = String(data[0].geoId || data[0].id || '');
      }

      if (locationId && /^\d+$/.test(locationId)) {
        return {
          locationId,
          fullId: `urn:li:fs_geo:${locationId}`,
          source: 'harvest',
        };
      }
    }
  } catch (error) {
    console.log(`HarvestAPI location search failed for "${locationText}":`, error);
  }

  return null;
}

/**
 * Discovers LinkedIn location ID using json_to_url endpoint
 */
async function discoverLocationIdViaJsonToUrl(
  locationText: string,
  rapidApiKey: string
): Promise<DiscoveryResult | null> {
  try {
    const response = await fetch(
      'https://realtime-linkedin-sales-navigator-data.p.rapidapi.com/json_to_url',
      {
        method: 'POST',
        headers: {
          'x-rapidapi-key': rapidApiKey,
          'x-rapidapi-host': 'realtime-linkedin-sales-navigator-data.p.rapidapi.com',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filters: [{
            type: 'REGION',
            values: [{
              text: locationText,
              selectionType: 'INCLUDED',
            }],
          }],
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      const url = data.url || data.result?.url || '';
      
      // Extract location ID from generated URL
      const locationId = extractLocationIdFromUrl(url);
      
      if (locationId) {
        return {
          locationId,
          fullId: `urn:li:fs_geo:${locationId}`,
          source: 'json_to_url',
          url,
        };
      }
    }
  } catch (error) {
    console.log(`json_to_url failed for "${locationText}":`, error);
  }

  return null;
}

/**
 * Extracts location ID from Sales Navigator URL
 */
export function extractLocationIdFromUrl(url: string): string | null {
  if (!url || typeof url !== 'string') return null;

  try {
    // Strategy 1: Check for geo URN in URL
    const geoUrnMatch = url.match(/urn:li:fs_geo:(\d+)/);
    if (geoUrnMatch) {
      return geoUrnMatch[1];
    }

    // Strategy 2: Check for geoUrn parameter
    const urlObj = new URL(url);
    const geoUrn = urlObj.searchParams.get('geoUrn');
    if (geoUrn) {
      const idMatch = geoUrn.match(/(\d+)/);
      if (idMatch) return idMatch[1];
    }

    // Strategy 3: Check encoded filters
    const filtersParam = urlObj.searchParams.get('filters');
    if (filtersParam) {
      try {
        const decoded = decodeURIComponent(filtersParam);
        const filters = JSON.parse(decoded);
        if (Array.isArray(filters)) {
          for (const filter of filters) {
            if ((filter.type === 'LOCATION' || filter.type === 'REGION') && filter.values) {
              for (const value of filter.values) {
                if (value.id) {
                  const idMatch = value.id.match(/urn:li:fs_geo:(\d+)|(\d{8,})/);
                  if (idMatch) {
                    return idMatch[1] || idMatch[2];
                  }
                }
              }
            }
          }
        }
      } catch {
        // Not JSON, continue
      }
    }

    // Strategy 4: Search for any 8+ digit number (location IDs are typically 9 digits)
    const globalMatch = url.match(/(\d{8,})/);
    if (globalMatch) {
      return globalMatch[1];
    }

    return null;
  } catch (error) {
    console.error('Error parsing URL for location ID:', error);
    return null;
  }
}

/**
 * Main discovery function - tries multiple sources
 * 
 * @param locationText - Location string (e.g., "Florida", "Naples, FL")
 * @param rapidApiKey - RapidAPI key for API calls
 * @param useCache - Whether to use cache (default: true)
 * @returns DiscoveryResult with location ID and source
 */
export async function getLocationId(
  locationText: string,
  rapidApiKey?: string,
  useCache: boolean = true
): Promise<DiscoveryResult> {
  if (!locationText) {
    return { locationId: null, fullId: null, source: 'failed' };
  }

  const cacheKey = locationText.toLowerCase().trim();

  // Check cache first
  if (useCache && locationCache.has(cacheKey)) {
    const cached = locationCache.get(cacheKey)!;
    return { ...cached, source: 'cache' };
  }

  // Try static lookup
  const staticResult = findLocationId(locationText);
  if (staticResult) {
    const result: DiscoveryResult = {
      locationId: staticResult.id,
      fullId: staticResult.fullId,
      source: 'static',
    };
    locationCache.set(cacheKey, result);
    return result;
  }

  // Need API key for dynamic discovery
  if (!rapidApiKey) {
    return { locationId: null, fullId: null, source: 'failed' };
  }

  // Try location suggestions API (fastest and most accurate)
  const suggestionsResult = await discoverLocationIdViaSuggestions(locationText, rapidApiKey);
  if (suggestionsResult) {
    locationCache.set(cacheKey, suggestionsResult);
    return suggestionsResult;
  }

  // Try HarvestAPI
  const harvestResult = await discoverLocationIdViaHarvest(locationText, rapidApiKey);
  if (harvestResult) {
    locationCache.set(cacheKey, harvestResult);
    return harvestResult;
  }

  // Try json_to_url as last resort
  const jsonToUrlResult = await discoverLocationIdViaJsonToUrl(locationText, rapidApiKey);
  if (jsonToUrlResult) {
    locationCache.set(cacheKey, jsonToUrlResult);
    return jsonToUrlResult;
  }

  // All methods failed
  const failedResult: DiscoveryResult = { locationId: null, fullId: null, source: 'failed' };
  return failedResult;
}

/**
 * Clear the location cache
 */
export function clearLocationCache(): void {
  locationCache.clear();
}

/**
 * Get cache size
 */
export function getLocationCacheSize(): number {
  return locationCache.size;
}

/**
 * Preload common locations into cache
 */
export function preloadCommonLocations(): void {
  // Static mappings are already fast, no need to preload
  console.log('[LOCATION_DISCOVERY] Cache ready for dynamic discovery');
}
