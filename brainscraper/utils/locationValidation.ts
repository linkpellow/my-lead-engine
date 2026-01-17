/**
 * Location Validation Utilities
 * Validates and filters leads by location
 */

export interface LocationFilter {
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export interface FilterResult {
  filtered: any[];
  stats: {
    total: number;
    kept: number;
    removed: number;
    removalRate: number;
  };
}

export function filterLeadsByLocation(
  leads: any[],
  filter: LocationFilter | string
): FilterResult {
  // Handle string filter (location string like "Naples, Florida")
  let locationFilter: LocationFilter = {};
  if (typeof filter === 'string') {
    const parts = filter.split(',').map(p => p.trim());
    if (parts.length >= 1) locationFilter.city = parts[0];
    if (parts.length >= 2) locationFilter.state = parts[1];
    if (parts.length >= 3) locationFilter.country = parts[2];
  } else {
    locationFilter = filter || {};
  }
  
  if (!locationFilter || (!locationFilter.city && !locationFilter.state && !locationFilter.zipCode && !locationFilter.country)) {
    return {
      filtered: leads,
      stats: {
        total: leads.length,
        kept: leads.length,
        removed: 0,
        removalRate: 0
      }
    };
  }
  
  const filtered = leads.filter(lead => {
    const location = lead.location || lead.Location || '';
    const city = lead.city || lead.City || '';
    const state = lead.state || lead.State || '';
    
    // Check if location string contains the filter
    if (locationFilter.city) {
      const filterCity = locationFilter.city.toLowerCase();
      if (city && !city.toLowerCase().includes(filterCity) && 
          !location.toLowerCase().includes(filterCity)) {
        return false;
      }
    }
    if (locationFilter.state) {
      const filterState = locationFilter.state.toLowerCase();
      if (state && !state.toLowerCase().includes(filterState) && 
          !location.toLowerCase().includes(filterState)) {
        return false;
      }
    }
    if (locationFilter.zipCode && lead.zipCode && lead.zipCode !== locationFilter.zipCode) {
      return false;
    }
    if (locationFilter.country && lead.country && !lead.country.toLowerCase().includes(locationFilter.country.toLowerCase())) {
      return false;
    }
    return true;
  });
  
  const removed = leads.length - filtered.length;
  const removalRate = leads.length > 0 ? removed / leads.length : 0;
  
  return {
    filtered,
    stats: {
      total: leads.length,
      kept: filtered.length,
      removed: removed,
      removalRate: removalRate
    }
  };
}

export function validateLocation(location: string): boolean {
  if (!location || location.trim().length === 0) return false;
  // Basic validation - location should have at least city or state
  const parts = location.split(',').map(p => p.trim());
  return parts.length >= 1 && parts[0].length > 0;
}