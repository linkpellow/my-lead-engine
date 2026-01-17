/**
 * Geocoding Utilities
 * Provides city/state to zipcode lookup using multiple providers
 * 
 * Provider priority:
 * 1. Geocodio (if API key provided)
 * 2. Nominatim (OpenStreetMap, free but rate limited)
 * 3. Local US city/zip lookup fallback
 */

/**
 * Common US cities with their zipcodes for fallback
 */
const COMMON_US_CITIES: Record<string, string> = {
  'new york, ny': '10001',
  'los angeles, ca': '90001',
  'chicago, il': '60601',
  'houston, tx': '77001',
  'phoenix, az': '85001',
  'philadelphia, pa': '19101',
  'san antonio, tx': '78201',
  'san diego, ca': '92101',
  'dallas, tx': '75201',
  'san jose, ca': '95101',
  'austin, tx': '78701',
  'jacksonville, fl': '32099',
  'fort worth, tx': '76101',
  'columbus, oh': '43085',
  'charlotte, nc': '28201',
  'san francisco, ca': '94102',
  'indianapolis, in': '46201',
  'seattle, wa': '98101',
  'denver, co': '80201',
  'washington, dc': '20001',
  'boston, ma': '02101',
  'nashville, tn': '37201',
  'baltimore, md': '21201',
  'oklahoma city, ok': '73101',
  'louisville, ky': '40201',
  'portland, or': '97201',
  'las vegas, nv': '89101',
  'milwaukee, wi': '53201',
  'albuquerque, nm': '87101',
  'tucson, az': '85701',
  'fresno, ca': '93701',
  'sacramento, ca': '95814',
  'kansas city, mo': '64101',
  'mesa, az': '85201',
  'atlanta, ga': '30301',
  'omaha, ne': '68101',
  'colorado springs, co': '80901',
  'raleigh, nc': '27601',
  'miami, fl': '33101',
  'long beach, ca': '90801',
  'virginia beach, va': '23450',
  'oakland, ca': '94601',
  'minneapolis, mn': '55401',
  'tampa, fl': '33601',
  'tulsa, ok': '74101',
  'arlington, tx': '76001',
  'new orleans, la': '70112',
  'naples, fl': '34101',
  'fort lauderdale, fl': '33301',
  'west palm beach, fl': '33401',
  'boca raton, fl': '33427',
  'orlando, fl': '32801',
  'sarasota, fl': '34230',
  'clearwater, fl': '33755',
  'st. petersburg, fl': '33701',
  'palm beach, fl': '33480',
  'jupiter, fl': '33458',
  'delray beach, fl': '33444',
  'bonita springs, fl': '34134',
  'estero, fl': '33928',
  'cape coral, fl': '33904',
  'fort myers, fl': '33901',
  'marco island, fl': '34145',
};

/**
 * State name to abbreviation mapping
 */
const STATE_ABBREVIATIONS: Record<string, string> = {
  'alabama': 'al', 'alaska': 'ak', 'arizona': 'az', 'arkansas': 'ar',
  'california': 'ca', 'colorado': 'co', 'connecticut': 'ct', 'delaware': 'de',
  'florida': 'fl', 'georgia': 'ga', 'hawaii': 'hi', 'idaho': 'id',
  'illinois': 'il', 'indiana': 'in', 'iowa': 'ia', 'kansas': 'ks',
  'kentucky': 'ky', 'louisiana': 'la', 'maine': 'me', 'maryland': 'md',
  'massachusetts': 'ma', 'michigan': 'mi', 'minnesota': 'mn', 'mississippi': 'ms',
  'missouri': 'mo', 'montana': 'mt', 'nebraska': 'ne', 'nevada': 'nv',
  'new hampshire': 'nh', 'new jersey': 'nj', 'new mexico': 'nm', 'new york': 'ny',
  'north carolina': 'nc', 'north dakota': 'nd', 'ohio': 'oh', 'oklahoma': 'ok',
  'oregon': 'or', 'pennsylvania': 'pa', 'rhode island': 'ri', 'south carolina': 'sc',
  'south dakota': 'sd', 'tennessee': 'tn', 'texas': 'tx', 'utah': 'ut',
  'vermont': 'vt', 'virginia': 'va', 'washington': 'wa', 'west virginia': 'wv',
  'wisconsin': 'wi', 'wyoming': 'wy', 'district of columbia': 'dc',
};

/**
 * Normalize state name to abbreviation
 */
function normalizeState(state: string): string {
  const cleaned = state.toLowerCase().trim();
  
  // Already an abbreviation
  if (cleaned.length === 2) {
    return cleaned;
  }
  
  // Look up full name
  return STATE_ABBREVIATIONS[cleaned] || cleaned;
}

/**
 * Geocode city/state to zipcode using Geocodio
 */
async function geocodeWithGeocodio(
  city: string,
  state: string,
  apiKey: string
): Promise<string | null> {
  try {
    const query = encodeURIComponent(`${city}, ${state}`);
    const url = `https://api.geocod.io/v1.7/geocode?q=${query}&api_key=${apiKey}&fields=zip4`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`Geocodio API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      const zipcode = result.address_components?.zip || 
                      result.fields?.zip4?.zip5;
      
      if (zipcode) {
        return zipcode;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Geocodio error:', error);
    return null;
  }
}

/**
 * Geocode city/state to zipcode using Nominatim (OpenStreetMap)
 */
async function geocodeWithNominatim(
  city: string,
  state: string
): Promise<string | null> {
  try {
    const query = encodeURIComponent(`${city}, ${state}, USA`);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&addressdetails=1&limit=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'BrainScraper/1.0 (lead-enrichment)',
      },
    });
    
    if (!response.ok) {
      console.warn(`Nominatim API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      const result = data[0];
      const zipcode = result.address?.postcode;
      
      if (zipcode) {
        // Extract first 5 digits of zipcode
        const zip5 = zipcode.match(/\d{5}/)?.[0];
        return zip5 || null;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Nominatim error:', error);
    return null;
  }
}

/**
 * Local fallback using common US cities
 */
function geocodeLocal(city: string, state: string): string | null {
  const stateAbbr = normalizeState(state);
  const key = `${city.toLowerCase().trim()}, ${stateAbbr}`;
  
  return COMMON_US_CITIES[key] || null;
}

/**
 * Geocode city/state to zipcode using multiple providers
 * 
 * @param city - City name
 * @param state - State name or abbreviation
 * @param geocodioApiKey - Optional Geocodio API key
 * @returns Zipcode or null if not found
 */
export async function geocodeCityStateToZip(
  city: string,
  state: string,
  geocodioApiKey?: string
): Promise<string | null> {
  if (!city || !state) {
    return null;
  }
  
  const normalizedState = normalizeState(state);
  
  // Try Geocodio first if API key is provided
  if (geocodioApiKey) {
    const result = await geocodeWithGeocodio(city, normalizedState, geocodioApiKey);
    if (result) {
      console.log(`[GEOCODING] Found via Geocodio: ${city}, ${state} → ${result}`);
      return result;
    }
  }
  
  // Try Nominatim (free, but rate limited)
  const nominatimResult = await geocodeWithNominatim(city, normalizedState);
  if (nominatimResult) {
    console.log(`[GEOCODING] Found via Nominatim: ${city}, ${state} → ${nominatimResult}`);
    return nominatimResult;
  }
  
  // Fall back to local lookup
  const localResult = geocodeLocal(city, state);
  if (localResult) {
    console.log(`[GEOCODING] Found via local lookup: ${city}, ${state} → ${localResult}`);
    return localResult;
  }
  
  console.warn(`[GEOCODING] Could not find zipcode for: ${city}, ${state}`);
  return null;
}

/**
 * Reverse geocode zipcode to city/state
 * 
 * @param zipcode - US zipcode
 * @param geocodioApiKey - Optional Geocodio API key
 * @returns Object with city and state, or null if not found
 */
export async function reverseGeocodeZip(
  zipcode: string,
  geocodioApiKey?: string
): Promise<{ city: string; state: string } | null> {
  if (!zipcode || zipcode.length < 5) {
    return null;
  }
  
  // Try Geocodio
  if (geocodioApiKey) {
    try {
      const url = `https://api.geocod.io/v1.7/geocode?q=${zipcode}&api_key=${geocodioApiKey}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          const addr = data.results[0].address_components;
          if (addr?.city && addr?.state) {
            return { city: addr.city, state: addr.state };
          }
        }
      }
    } catch {
      // Fall through to Nominatim
    }
  }
  
  // Try Nominatim
  try {
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${zipcode}&country=US&format=json&addressdetails=1&limit=1`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'BrainScraper/1.0' },
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0) {
        const addr = data[0].address;
        const city = addr?.city || addr?.town || addr?.village;
        const state = addr?.state;
        
        if (city && state) {
          return { city, state };
        }
      }
    }
  } catch {
    // Return null
  }
  
  return null;
}
