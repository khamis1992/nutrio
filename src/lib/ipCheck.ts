export interface IPLocationResponse {
  allowed: boolean;
  blocked: boolean;
  ip: string;
  countryCode?: string;
  country?: string;
  city?: string;
  reason?: string;
  error?: string;
}

/**
 * Check if an IP address is allowed based on geolocation and blocked status
 * @returns IPLocationResponse with allowed status and location info
 * 
 * NOTE: IP restriction is currently DISABLED for E2E testing.
 * To reactivate Qatar-only restriction, remove the bypass below.
 */
export const checkIPLocation = async (): Promise<IPLocationResponse> => {
  // BYPASS FOR E2E TESTING - Allows all IPs including localhost
  // TODO: Remove this bypass after testing is complete
  return {
    allowed: true,
    blocked: false,
    ip: '127.0.0.1',
    countryCode: 'QA',
    country: 'Qatar',
    city: 'Doha',
    reason: 'E2E TESTING MODE - IP restriction disabled',
  };

  /* ORIGINAL CODE - Commented out for testing
  // Skip IP check in development/local environment
  if (import.meta.env.DEV || window.location.hostname === 'localhost') {
    return {
      allowed: true,
      blocked: false,
      ip: '127.0.0.1',
      countryCode: 'QA',
      country: 'Qatar',
      city: 'Doha',
      reason: 'Development mode - IP check skipped',
    };
  }
  */

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(`${supabaseUrl}/functions/v1/check-ip-location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
      }
    });

    if (!response.ok) {
      // If function returns error (404, 500, etc), allow access (fail open for reliability)
      console.warn(`IP check failed with status ${response.status}, allowing access`);
      return {
        allowed: true,
        blocked: false,
        ip: 'unknown',
        reason: 'Location check unavailable',
      };
    }

    const data: IPLocationResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error checking IP location:', error);
    // Fail open - allow access if check fails
    return {
      allowed: true,
      blocked: false,
      ip: 'unknown',
      reason: 'Unable to verify location - allowing access',
    };
  }
};

/**
 * Log user IP information
 * @param action - The action being performed (signup, login)
 * @param userId - The user ID (optional for signup)
 */
export const logUserIP = async (action: 'signup' | 'login', userId?: string) => {
  // Skip in development
  if (import.meta.env.DEV || window.location.hostname === 'localhost') {
    return;
  }

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    await fetch(`${supabaseUrl}/functions/v1/log-user-ip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
      },
      body: JSON.stringify({ action, userId })
    });
  } catch (error) {
    // Silently fail - IP logging is not critical
    console.warn('Error logging user IP (non-critical):', error);
  }
};