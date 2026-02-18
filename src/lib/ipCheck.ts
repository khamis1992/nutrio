import { supabase } from "@/integrations/supabase/client";

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
  try {
    // In a real implementation, this would call your Edge Function
    // For now, we'll simulate the check
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch('/functions/v1/check-ip-location', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to check IP location');
    }

    const data: IPLocationResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error checking IP location:', error);
    return {
      allowed: false,
      blocked: false,
      ip: 'unknown',
      reason: 'Unable to verify location',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Log user IP information
 * @param action - The action being performed (signup, login)
 * @param userId - The user ID (optional for signup)
 */
export const logUserIP = async (action: 'signup' | 'login', userId?: string) => {
  try {
    // In a real implementation, this would call your Edge Function
    // For now, we'll simulate the logging
    const { data: { session } } = await supabase.auth.getSession();
    
    await fetch('/functions/v1/log-user-ip', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`
      },
      body: JSON.stringify({ action, userId })
    });
  } catch (error) {
    console.error('Error logging user IP:', error);
  }
};