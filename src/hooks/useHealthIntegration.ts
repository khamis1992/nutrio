/**
 * P1-001/P1-002: HealthKit & Google Fit Integration
 * Mobile health data sync hooks
 */

import { useState, useEffect, useCallback } from "react";
import { Platform } from "@/lib/capacitor";
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
}

interface HealthPermissions {
  steps: boolean;
  calories: boolean;
  workouts: boolean;
  sleep: boolean;
  heartRate: boolean;
}

export function useHealthIntegration() {
  const { user } = useAuth();
  const [isAvailable, setIsAvailable] = useState(false);
  const [permissions, setPermissions] = useState<HealthPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [platform, setPlatform] = useState<"ios" | "android" | "web">("web");

  // Check platform on mount
  useEffect(() => {
    const checkPlatform = async () => {
      try {
        const { isNative, isIOS, isAndroid } = await import("@/lib/capacitor");
        
        if (isNative()) {
          if (isIOS()) {
            setPlatform("ios");
          } else if (isAndroid()) {
            setPlatform("android");
          }
        }
      } catch {
        // Web platform
        setPlatform("web");
      }
    };

    checkPlatform();
  }, []);

  // Check if health integration is available
  const checkAvailability = useCallback(async () => {
    if (platform === "ios") {
      // Check HealthKit availability
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
      // Check Google Fit availability
      try {
        const { GoogleFit } = await import("@/services/health/googleFit");
        const available = await GoogleFit.isAvailable();
        setIsAvailable(available);
        return available;
      } catch {
        setIsAvailable(false);
        return false;
      }
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
        const { GoogleFit } = await import("@/services/health/googleFit");
        const granted = await GoogleFit.requestPermissions(requested);
        setPermissions(granted);
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
        const { GoogleFit } = await import("@/services/health/googleFit");
        healthData = await GoogleFit.getHealthData(dateRange);
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
        const { GoogleFit } = await import("@/services/health/googleFit");
        await GoogleFit.writeNutritionData(mealData);
      }
      
      toast.success("Meal logged to Health app");
      return true;
    } catch (err) {
      toast.error("Failed to write to Health app");
      return false;
    }
  }, [platform]);

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
  };
}

// Service modules would be in separate files for iOS/Android
// Stub implementations for compilation
export const HealthKitService = {
  isAvailable: async () => false,
  requestPermissions: async () => null,
  getHealthData: async () => null,
  writeNutritionSample: async () => false,
};

export const GoogleFitService = {
  isAvailable: async () => false,
  requestPermissions: async () => null,
  getHealthData: async () => null,
  writeNutritionData: async () => false,
};
