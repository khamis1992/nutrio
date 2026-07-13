/**
 * P1-001/P1-002: HealthKit & Google Fit Integration
 * Mobile health data sync hooks
 */

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { WorkoutData } from "@/lib/health-types";
import type { Json } from "@/integrations/supabase/types";
import {
  detectHealthPlatform,
  fetchHealthData,
  fetchHealthWorkouts,
  isHealthAvailable,
  requestHealthPermissions,
  toLegacyPlatform,
  writeMealToHealthService,
} from "@/lib/health-service";

export type { HealthData, WorkoutData } from "@/lib/health-types";

interface HealthPermissions {
  steps: boolean;
  calories: boolean;
  workouts: boolean;
  sleep: boolean;
  heartRate: boolean;
}

import { getAuthUrl } from "@/services/health/googleFit";

export function useHealthIntegration() {
  const { user } = useAuth();
  const [isAvailable, setIsAvailable] = useState(false);
  const [permissions, setPermissions] = useState<HealthPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [platform, setPlatform] = useState<"ios" | "android" | "web">("web");

  // Check platform on mount
  useEffect(() => {
    setPlatform(toLegacyPlatform(detectHealthPlatform()));
  }, []);

  // Check if health integration is available
  const checkAvailability = useCallback(async () => {
    const available = await isHealthAvailable(detectHealthPlatform());
    setIsAvailable(available);
    return available;
  }, []);

  // Request permissions
  const requestPermissions = useCallback(async (requested: Partial<HealthPermissions>) => {
    setIsLoading(true);
    
    try {
      const granted = await requestHealthPermissions(detectHealthPlatform(), requested);
      setPermissions(granted);
      return granted;
    } catch (err) {
      toast.error("Failed to request health permissions");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sync health data
   
  const syncHealthData = useCallback(async (dateRange: { start: Date; end: Date }) => {
    if (!user) return null;
    
    setIsLoading(true);
    
    try {
      const currentPlatform = detectHealthPlatform();
      const healthData = await fetchHealthData(user.id, currentPlatform, dateRange);
      
      if (healthData) {
        // Store in database
        await supabase.from("health_sync_data").upsert({
          user_id: user.id,
          platform: currentPlatform,
          data: JSON.parse(JSON.stringify(healthData)) as Json,
          synced_at: new Date().toISOString(),
        });
        
        setLastSync(new Date());
        toast.success("Health data synced successfully");
      }
      
      return healthData;
    } catch (err) {
      toast.error("Failed to sync health data");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Write meal data to health platform
  const writeMealToHealth = useCallback(async (mealData: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    timestamp: Date;
  }) => {
    try {
      const success = await writeMealToHealthService(detectHealthPlatform(), mealData);
      if (!success) return false;
      
      toast.success("Meal logged to Health app");
      return true;
    } catch (err) {
      toast.error("Failed to write to Health app");
      return false;
    }
  }, []);

  // Fetch workouts specifically from Google Fit (for StepCounter)
  const fetchGoogleFitWorkouts = useCallback(async (startDate: Date, endDate: Date): Promise<WorkoutData[]> => {
    if (!user) return [];
    
    return fetchHealthWorkouts(user.id, "google_fit", startDate, endDate);
  }, [user]);

  return {
    isAvailable,
    permissions,
    isLoading,
    lastSync,
    platform,
    checkAvailability,
    requestPermissions,
    syncHealthData,
    writeMealToHealth,
    fetchGoogleFitWorkouts,
  };
}

// Helper to initiate Google Fit OAuth flow (for web)
export async function initGoogleFitOAuth(clientId: string) {
  const redirectUri = `${window.location.origin}/auth/google-fit/callback`;
  const authUrl = await getAuthUrl(clientId, redirectUri);
  window.location.href = authUrl;
}

// Handle OAuth callback - uses edge function for secure token exchange
export async function handleGoogleFitCallback(
  code: string,
  codeVerifier: string
): Promise<boolean> {
  try {
    const redirectUri = `${window.location.origin}/auth/google-fit/callback`;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.error("No authenticated user");
      return false;
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-fit-token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          codeVerifier,
          redirectUri,
          userId: user.id,
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error("Google Fit callback error:", error);
    return false;
  }
}
