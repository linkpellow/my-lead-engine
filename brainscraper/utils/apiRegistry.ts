/**
 * API Registry
 * Manages API keys and endpoint configurations
 */

export interface APIConfig {
  name: string;
  baseUrl: string;
  requiresAuth: boolean;
  rateLimit?: number;
  locked?: boolean;
  costPer1000?: number;
  dependencies?: string[];
  category?: string;
}

export const API_REGISTRY: Record<string, APIConfig> = {
  linkedin: {
    name: 'LinkedIn',
    baseUrl: 'https://api.linkedin.com',
    requiresAuth: true,
    rateLimit: 100,
  },
  facebook: {
    name: 'Facebook',
    baseUrl: 'https://graph.facebook.com',
    requiresAuth: true,
    rateLimit: 200,
  },
  usha: {
    name: 'USHA DNC',
    baseUrl: 'https://api.usha.com',
    requiresAuth: true,
    rateLimit: 50,
  },
  rapidapi: {
    name: 'RapidAPI',
    baseUrl: 'https://rapidapi.com',
    requiresAuth: true,
    rateLimit: 100,
  },
};

export function getAllAPIKeys(): Record<string, string> {
  // In production, load from environment variables or secure storage
  const keys: Record<string, string> = {};
  
  if (typeof window !== 'undefined') {
    // Client-side: keys should come from API
    return keys;
  }
  
  // Server-side: load from environment
  return {
    LINKEDIN_API_KEY: process.env.LINKEDIN_API_KEY || '',
    FACEBOOK_API_KEY: process.env.FACEBOOK_API_KEY || '',
    USHA_API_KEY: process.env.USHA_API_KEY || '',
    RAPIDAPI_KEY: process.env.RAPIDAPI_KEY || '',
  };
}

export function getAPIKey(service: string): string {
  const keys = getAllAPIKeys();
  return keys[`${service.toUpperCase()}_API_KEY`] || keys[service] || '';
}