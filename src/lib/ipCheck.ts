import { supabase } from '@/integrations/supabase/client';

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
 */
export const checkIPLocation = async (): Promise<IPLocationResponse> => {
  if (import.meta.env.DEV) {
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

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !publishableKey) {
      return {
        allowed: false,
        blocked: false,
        ip: 'unknown',
        reason: 'Location verification is not configured',
      };
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/check-ip-location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': publishableKey,
      }
    });

    if (!response.ok) {
      console.warn(`IP check failed with status ${response.status}`);
      return {
        allowed: false,
        blocked: false,
        ip: 'unknown',
        reason: 'Location verification is temporarily unavailable',
      };
    }

    const data = await response.json() as Partial<IPLocationResponse>;
    if (typeof data.allowed !== 'boolean' || typeof data.blocked !== 'boolean') {
      return {
        allowed: false,
        blocked: false,
        ip: 'unknown',
        reason: 'Location verification returned an invalid response',
      };
    }

    return { ...data, ip: data.ip || 'unknown' } as IPLocationResponse;
  } catch (error) {
    console.error('Error checking IP location:', error);
    return {
      allowed: false,
      blocked: false,
      ip: 'unknown',
      reason: 'Unable to verify location',
    };
  }
};

/**
 * Log user IP information
 * @param action - The action being performed (signup, login)
 * @param userId - The user ID (optional for signup)
 */
export const logUserIP = async (action: 'signup' | 'login') => {
  // Skip in development
  if (import.meta.env.DEV) {
    return;
  }

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const { data: { session } } = await supabase.auth.getSession();
    if (!supabaseUrl || !publishableKey || !session?.access_token) return;

    await fetch(`${supabaseUrl}/functions/v1/log-user-ip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': publishableKey,
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action }),
    });
  } catch (error) {
    // Silently fail - IP logging is not critical
    console.warn('Error logging user IP (non-critical):', error);
  }
};
