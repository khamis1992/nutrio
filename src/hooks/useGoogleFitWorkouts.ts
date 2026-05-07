/**
 * Google Fit Integration Hook
 * Simplified hook for fetching workouts in the StepCounter page
 */

import { useState, useCallback } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { WorkoutData } from "./useHealthIntegration";

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

const WORKOUT_TYPE_MAP: Record<number, string> = {
  0: "Unknown",
  1: "Running",
  2: "Cycling",
  3: "Walking",
  4: "Hiking",
  5: "Swimming",
  7: "Yoga",
  8: "Pilates",
  9: "Strength Training",
  10: "CrossFit",
  11: "HIIT",
  12: "Dance",
  17: "Boxing",
  18: "Rowing",
  19: "Elliptical",
  20: "Stair Climb",
};

interface GoogleFitAuth {
  accessToken: string;
  expiresAt: number;
}

export function useGoogleFitWorkouts() {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check if Google Fit is connected
  const checkConnection = useCallback(async () => {
    if (!user) return false;
    
    const { data } = await supabase
      .from("user_integrations")
      .select("provider, access_token, expires_at")
      .eq("user_id", user.id)
      .eq("provider", "google_fit")
      .maybeSingle();
    
    if (data?.access_token) {
      // Check if token is valid
      const isValid = (data.expires_at * 1000) > Date.now();
      setIsConnected(isValid);
      return isValid;
    }
    
    setIsConnected(false);
    return false;
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
      console.log("No refresh token found");
      return false;
    }
    
    const clientId = import.meta.env.VITE_GOOGLE_FIT_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_GOOGLE_FIT_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      console.error("Google Fit credentials not configured");
      return false;
    }
    
    try {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: tokenData.refresh_token,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
      
      if (!response.ok) {
        console.error("Token refresh failed:", await response.text());
        return false;
      }
      
      const data = await response.json();
      
      // Update stored token
      await supabase
        .from("user_integrations")
        .update({
          access_token: data.access_token,
          expires_at: Math.floor((Date.now() + data.expires_in * 1000) / 1000),
        })
        .eq("user_id", user.id)
        .eq("provider", "google_fit");
      
      console.log("Token refreshed successfully");
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
      // Get stored token
      const { data: tokenData } = await supabase
        .from("user_integrations")
        .select("access_token, expires_at")
        .eq("user_id", user.id)
        .eq("provider", "google_fit")
        .maybeSingle();
      
      if (!tokenData?.access_token) {
        console.log("No Google Fit token found");
        return [];
      }
      
      // Check if token is expired and try to refresh
      if (tokenData.expires_at * 1000 < Date.now()) {
        console.log("Token expired, attempting refresh...");
        const refreshed = await refreshToken();
        if (!refreshed) {
          console.log("Token refresh failed");
          return [];
        }
        // Re-fetch the new token
        const { data: newTokenData } = await supabase
          .from("user_integrations")
          .select("access_token, expires_at")
          .eq("user_id", user.id)
          .eq("provider", "google_fit")
          .maybeSingle();
        
        if (!newTokenData?.access_token) return [];
        
        tokenData.access_token = newTokenData.access_token;
        tokenData.expires_at = newTokenData.expires_at;
      }
      
      const auth: GoogleFitAuth = {
        accessToken: tokenData.access_token,
        expiresAt: tokenData.expires_at * 1000,
      };
      
      const startMillis = startDate.getTime();
      const endMillis = endDate.getTime();
      
      // Call Google Fit API
      const response = await fetch(
        "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            aggregateBy: [
              { dataTypeName: "com.google.activity.segment" },
              { dataTypeName: "com.google.calories.expended" },
              { dataTypeName: "com.google.duration" },
            ],
            startTimeMillis: startMillis,
            endTimeMillis: endMillis,
            bucketByActivityType: { activityType: 1 },
          }),
        }
      );
      
      if (!response.ok) {
        console.error("Google Fit API error:", await response.text());
        return [];
      }
      
      const data = await response.json();
      const workouts: WorkoutData[] = [];
      
      if (data.bucket) {
        for (const bucket of data.bucket) {
          if (!bucket.dataset) continue;
          
          const activityDataset = bucket.dataset.find(
            (d: any) => d.point && d.point.length > 0 && d.dataSourceId?.includes("activity")
          );
          
          if (!activityDataset?.point?.[0]) continue;
          
          const point = activityDataset.point[0];
          const activityType = point.value?.[0]?.intVal || 0;
          
          // Skip unknown/empty activities
          if (activityType === 0) continue;
          
          // Get duration
          const durationDataset = bucket.dataset.find(
            (d: any) => d.dataSourceId?.includes("duration")
          );
          const duration = durationDataset?.point?.[0]?.value?.[0]?.intVal || 0;
          
          // Get calories
          const caloriesDataset = bucket.dataset.find(
            (d: any) => d.dataSourceId?.includes("calories")
          );
          const calories = caloriesDataset?.point?.[0]?.value?.[0]?.fpVal || 0;
          
          const startTimeDate = new Date(bucket.startTimeMillis);
          const endTimeDate = new Date(bucket.endTimeMillis);
          
          const workout: WorkoutData = {
            id: `google-fit-${bucket.startTimeMillis}`,
            type: WORKOUT_TYPE_MAP[activityType] || "Workout",
            startTime: startTimeDate.toISOString(),
            endTime: endTimeDate.toISOString(),
            calories: Math.round(calories),
            duration: Math.round(duration / 60000),
            source: 'google_fit',
          };
          
          workouts.push(workout);
          
          // Also save to workout_sessions table
          try {
            await supabase.from("workout_sessions").upsert({
              user_id: user!.id,
              session_date: format(startTimeDate, "yyyy-MM-dd"),
              workout_type: workout.type,
              duration_minutes: workout.duration,
              calories_burned: workout.calories,
              source: 'google_fit',
              created_at: startTimeDate.toISOString(),
            }, {
              onConflict: 'user_id, session_date, workout_type',
            });
          } catch (saveError) {
            console.warn("Failed to save Google Fit workout to DB:", saveError);
          }
        }
      }
      
      return workouts;
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