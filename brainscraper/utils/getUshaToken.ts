/**
 * USHA Token Management
 * Handles authentication tokens for the USHA DNC API
 * 
 * Token sources (in priority order):
 * 1. Cached token (if still valid)
 * 2. USHA_JWT_TOKEN environment variable (static token)
 * 3. Refresh using COGNITO_REFRESH_TOKEN (dynamic refresh)
 */

// Token cache
let cachedToken: string | null = null;
let tokenExpiry: Date | null = null;

// Token refresh lock to prevent concurrent refreshes
let refreshPromise: Promise<string | null> | null = null;

/**
 * Get a valid USHA authentication token
 * Uses caching and automatic refresh when possible
 * 
 * @param refreshToken - Optional refresh token override
 * @param forceRefresh - Force a token refresh even if cached token is valid
 * @returns The JWT token or null if unavailable
 */
export async function getUshaToken(
  refreshToken?: string | null,
  forceRefresh: boolean = false
): Promise<string | null> {
  // Return cached token if valid and not forcing refresh
  if (!forceRefresh && cachedToken && tokenExpiry && tokenExpiry > new Date()) {
    return cachedToken;
  }
  
  // If a refresh is already in progress, wait for it
  if (refreshPromise) {
    return refreshPromise;
  }
  
  // Start a new refresh
  refreshPromise = refreshTokenInternal(refreshToken);
  
  try {
    const token = await refreshPromise;
    return token;
  } finally {
    refreshPromise = null;
  }
}

/**
 * Internal token refresh logic
 */
async function refreshTokenInternal(
  refreshToken?: string | null
): Promise<string | null> {
  try {
    // Try 1: Use static JWT token from environment
    const staticToken = process.env.USHA_JWT_TOKEN;
    if (staticToken) {
      // Static tokens typically have long expiry, cache for 1 hour
      cachedToken = staticToken;
      tokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      return staticToken;
    }
    
    // Try 2: Refresh using Cognito refresh token
    const cognitoRefreshToken = refreshToken || process.env.COGNITO_REFRESH_TOKEN;
    if (cognitoRefreshToken) {
      const newToken = await refreshViaCognito(cognitoRefreshToken);
      if (newToken) {
        cachedToken = newToken;
        // Cognito tokens typically expire in 1 hour, cache for 55 minutes
        tokenExpiry = new Date(Date.now() + 55 * 60 * 1000);
        return newToken;
      }
    }
    
    console.warn('⚠️ No USHA token source available. Set USHA_JWT_TOKEN or COGNITO_REFRESH_TOKEN');
    return null;
  } catch (error) {
    console.error('❌ Error refreshing USHA token:', error);
    return null;
  }
}

/**
 * Refresh token using AWS Cognito
 * 
 * @param refreshToken - The Cognito refresh token
 * @returns New access token or null
 */
async function refreshViaCognito(refreshToken: string): Promise<string | null> {
  try {
    // Cognito User Pool details (USHA uses Cognito)
    const cognitoEndpoint = process.env.COGNITO_ENDPOINT || 
      'https://cognito-idp.us-east-1.amazonaws.com';
    const clientId = process.env.COGNITO_CLIENT_ID || 
      '2qv84q5c7nmhkr5c8n9b7k1jm'; // Default USHA client ID
    
    const response = await fetch(cognitoEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
      },
      body: JSON.stringify({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: clientId,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Cognito refresh failed:', response.status, errorText);
      return null;
    }
    
    const data = await response.json();
    const accessToken = data.AuthenticationResult?.AccessToken || 
                        data.AuthenticationResult?.IdToken;
    
    if (!accessToken) {
      console.error('❌ No access token in Cognito response');
      return null;
    }
    
    console.log('✅ USHA token refreshed via Cognito');
    return accessToken;
  } catch (error) {
    console.error('❌ Cognito refresh error:', error);
    return null;
  }
}

/**
 * Clear the token cache
 * Use this when you know the token is invalid (e.g., 401 response)
 */
export function clearTokenCache(): void {
  cachedToken = null;
  tokenExpiry = null;
  console.log('🔄 USHA token cache cleared');
}

/**
 * Check if we have a cached token (doesn't validate it)
 */
export function hasCachedToken(): boolean {
  return !!cachedToken && !!tokenExpiry && tokenExpiry > new Date();
}

/**
 * Get token expiry time
 */
export function getTokenExpiry(): Date | null {
  return tokenExpiry;
}

/**
 * Validate a USHA token by making a lightweight API call
 * 
 * @param token - The token to validate
 * @returns True if token is valid
 */
export async function validateUshaToken(token: string): Promise<boolean> {
  try {
    // Use a lightweight endpoint for validation
    const response = await fetch(
      'https://api-business-agent.ushadvisors.com/Leads/api/leads/health',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );
    
    return response.ok || response.status !== 401;
  } catch {
    return false;
  }
}
