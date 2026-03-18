/**
 * P1-001/P1-002: HealthKit & Google Fit Integration
 * Mobile health data sync hooks
 */

import { useState, useEffect, useCallback } from "react";
import { isNative, isIOS, isAndroid, isWeb } from "@/lib/capacitor";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface HealthData {
  steps?: number;
  caloriesBurned?: number;
  activeMinutes?: number;
  workouts?: WorkoutData[];
  sleepHours?: number;
  heartRate?: number;
  date: string;
}

export interface WorkoutData {
  id: string;
  type: string;
  startTime: string;
  endTime: string;
  calories: number;
  duration: number; // minutes
  confirmed?: boolean; // User confirmed this workout
  source?: 'manual' | 'google_fit' | 'apple_health' | 'garmin' | 'auto_detected';
}

interface HealthPermissions {
  steps: boolean;
  calories: boolean;
  workouts: boolean;
  sleep: boolean;
  heartRate: boolean;
}

// Import Google Fit service
import { 
  isAvailable as checkGoogleFitAvailable,
  requestPermissions as requestGoogleFitPermissions,
  getHealthData as getGoogleFitHealthData,
  writeNutritionData as writeGoogleFitNutrition,
  getAuthUrl,
  exchangeCodeForToken,
  getWorkouts as fetchGoogleFitWorkouts,
} from "@/services/health/googleFit";

export function useHealthIntegration() {
  const { user } = useAuth();
  const [isAvailable, setIsAvailable] = useState(false);
  const [permissions, setPermissions] = useState<HealthPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [platform, setPlatform] = useState<"ios" | "android" | "web">("web");

  // Check platform on mount
  useEffect(() => {
    if (isNative) {
      if (isIOS()) {
        setPlatform("ios");
      } else if (isAndroid()) {
        setPlatform("android");
      }
    } else {
      setPlatform("web");
    }
  }, []);

  // Check if health integration is available
  const checkAvailability = useCallback(async () => {
    if (platform === "ios") {
      try {
        const { HealthKit } = await import("@/services/health/healthkit");
        const available = await HealthKit.isAvailable();
        setIsAvailable(available);
        return available;
      } catch {
        setIsAvailable(false);
        return false;
      }
    } else if (platform === "android") {
      // Use our Google Fit service
      const available = await checkGoogleFitAvailable();
      setIsAvailable(available);
      return available;
    }
    
    setIsAvailable(false);
    return false;
  }, [platform]);

  // Request permissions
  const requestPermissions = useCallback(async (requested: Partial<HealthPermissions>) => {
    setIsLoading(true);
    
    try {
      if (platform === "ios") {
        const { HealthKit } = await import("@/services/health/healthkit");
        const granted = await HealthKit.requestPermissions(requested);
        setPermissions(granted);
        return granted;
      } else if (platform === "android") {
        const granted = await requestGoogleFitPermissions({
          activity: requested.workouts ?? requested.steps ?? false,
          body: requested.calories ?? false,
          location: false,
        });
        if (granted) {
          setPermissions({
            steps: granted.activity ?? false,
            calories: granted.body ?? false,
            workouts: granted.activity ?? false,
            sleep: false,
            heartRate: false,
          });
        }
        return granted;
      }
      
      return null;
    } catch (err) {
      toast.error("Failed to request health permissions");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [platform]);

  // Sync health data
  const syncHealthData = useCallback(async (dateRange: { start: Date; end: Date }) => {
    if (!user) return null;
    
    setIsLoading(true);
    
    try {
      let healthData: HealthData | null = null;
      
      if (platform === "ios") {
        const { HealthKit } = await import("@/services/health/healthkit");
        healthData = await HealthKit.getHealthData(dateRange);
      } else if (platform === "android") {
        healthData = await getGoogleFitHealthData(dateRange);
      } else {
        // Web platform - try to fetch from stored Google Fit tokens
        const { data: tokens } = await supabase
          .from("user_integrations")
          .select("access_token, expires_at")
          .eq("user_id", user.id)
          .eq("provider", "google_fit")
          .single();
        
        if (tokens?.access_token) {
          const workouts = await fetchGoogleFitWorkouts(
            { accessToken: tokens.access_token, expiresAt: tokens.expires_at },
            dateRange.start,
            dateRange.end
          );
          
          healthData = {
            workouts,
            date: dateRange.start.toISOString().split("T")[0],
          };
        }
      }
      
      if (healthData) {
        // Store in database
        await supabase.from("health_sync_data").upsert({
          user_id: user.id,
          platform,
          data: healthData,
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
  }, [platform, user]);

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
      if (platform === "ios") {
        const { HealthKit } = await import("@/services/health/healthkit");
        await HealthKit.writeNutritionSample(mealData);
      } else if (platform === "android") {
        await writeGoogleFitNutrition(mealData);
      }
      
      toast.success("Meal logged to Health app");
      return true;
    } catch (err) {
      toast.error("Failed to write to Health app");
      return false;
    }
  }, [platform]);

  // Fetch workouts specifically from Google Fit (for StepCounter)
  const fetchGoogleFitWorkouts = useCallback(async (startDate: Date, endDate: Date): Promise<WorkoutData[]> => {
    if (!user) return [];
    
    // First check for stored OAuth tokens
    const { data: tokens } = await supabase
      .from("user_integrations")
      .select("access_token, expires_at")
      .eq("user_id", user.id)
      .eq("provider", "google_fit")
      .single();
    
    if (!tokens?.access_token) {
      console.log("No Google Fit tokens found");
      return [];
    }
    
    // Check if token is expired
    if (tokens.expires_at * 1000 < Date.now()) {
      console.log("Google Fit token expired");
      // TODO: Implement refresh token flow
      return [];
    }
    
    return await fetchGoogleFitWorkouts(
      { accessToken: tokens.access_token, expiresAt: tokens.expires_at * 1000 },
      startDate,
      endDate
    );
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
export function initGoogleFitOAuth(clientId: string) {
  const redirectUri = `${window.location.origin}/auth/google-fit/callback`;
  const authUrl = getAuthUrl(clientId, redirectUri);
  window.location.href = authUrl;
}

// Handle OAuth callback
export async function handleGoogleFitCallback(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<boolean> {
  const redirectUri = `${window.location.origin}/auth/google-fit/callback`;
  const tokenData = await exchangeCodeForToken(code, clientId, clientSecret, redirectUri);
  
  if (!tokenData) {
    return false;
  }
  
  // Store token in database (would need user context)
  // This should be called from an API route
  return true;
}