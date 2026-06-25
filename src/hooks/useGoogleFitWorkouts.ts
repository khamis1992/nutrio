/**
 * Google Fit Integration Hook
 * Simplified hook for fetching workouts in the StepCounter page
 */

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchAndSaveGoogleFitWorkouts, isGoogleFitConnected } from "@/lib/google-fit-workout-service";
import type { WorkoutData } from "@/lib/health-types";

// Google Fit API helper
const GOOGLE_FIT_SCOPES = [
  "https://www.googleapis.com/auth/fitness.activity.read",
  "https://www.googleapis.com/auth/fitness.body.read",
];

function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => chars[byte % chars.length]).join('');
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return crypto.subtle.digest('SHA-256', data);
}

async function base64urlEncode(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach(byte => binary += String.fromCharCode(byte));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const hash = await sha256(codeVerifier);
  return base64urlEncode(hash);
}

export function useGoogleFitWorkouts() {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check if Google Fit is connected
  const checkConnection = useCallback(async () => {
    if (!user) return false;
    
    const connected = await isGoogleFitConnected(user.id);
    setIsConnected(connected);
    return connected;
  }, [user]);

  // Refresh access token using refresh token
  const refreshToken = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    
    const { data: tokenData } = await supabase
      .from("user_integrations")
      .select("refresh_token")
      .eq("user_id", user.id)
      .eq("provider", "google_fit")
      .maybeSingle();
    
    if (!tokenData?.refresh_token) {

      return false;
    }
    
    try {
      const { data, error } = await supabase.functions.invoke("google-fit-token-refresh", {
        body: {},
      });

      if (error || !data?.success) {
        console.error("Token refresh failed:", error?.message ?? data?.error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Failed to refresh token:", error);
      return false;
    }
  }, [user]);

  // Get Google Fit OAuth URL with PKCE and state
  const getOAuthUrl = useCallback(async (clientId: string) => {
    const redirectUri = `${window.location.origin}/auth/google-fit/callback`;
    const state = generateRandomString(32);
    const codeVerifier = generateRandomString(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    sessionStorage.setItem('google_oauth_state', state);
    sessionStorage.setItem('google_code_verifier', codeVerifier);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GOOGLE_FIT_SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }, []);

  // Exchange code for token (called from callback page)
  const exchangeCode = useCallback(async (
    code: string,
    clientId: string,
    clientSecret: string
  ): Promise<boolean> => {
    if (!user) return false;
    
    const redirectUri = `${window.location.origin}/auth/google-fit/callback`;
    
    try {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      
      if (!response.ok) return false;
      
      const data = await response.json();
      
      // Store token in database
      await supabase.from("user_integrations").upsert({
        user_id: user.id,
        provider: "google_fit",
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Math.floor((Date.now() + data.expires_in * 1000) / 1000),
        created_at: new Date().toISOString(),
      });
      
      setIsConnected(true);
      return true;
    } catch (error) {
      console.error("Failed to exchange code:", error);
      return false;
    }
  }, [user]);

  // Fetch workouts from Google Fit
    
  const fetchWorkouts = useCallback(async (startDate: Date, endDate: Date): Promise<WorkoutData[]> => {
    if (!user) return [];
    
    setIsLoading(true);
    
    try {
      return await fetchAndSaveGoogleFitWorkouts(user.id, startDate, endDate);
    } catch (error) {
      console.error("Failed to fetch Google Fit workouts:", error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Disconnect Google Fit
  const disconnect = useCallback(async () => {
    if (!user) return;
    
    await supabase
      .from("user_integrations")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", "google_fit");
    
    setIsConnected(false);
  }, [user]);

  return {
    isConnected,
    isLoading,
    checkConnection,
    getOAuthUrl,
    exchangeCode,
    refreshToken,
    fetchWorkouts,
    disconnect,
  };
}
