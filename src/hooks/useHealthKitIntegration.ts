/**
 * useHealthKitIntegration Hook
 *
 * Manages fitness wearable integration lifecycle:
 * - Detect platform (Apple Health / Google Fit)
 * - Request permissions
 * - Poll/sync data every 15 minutes
 * - Cache synced data in localStorage + Supabase
 * - Track last sync time and connection state
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { fetchAndSaveGoogleFitWorkouts } from "@/lib/google-fit-workout-service";
import { getQatarDay } from "@/lib/dateUtils";
import {
  getConfig,
  saveConfig,
  shouldSync,
  markSynced,
  getCachedHealthData,
  setCachedHealthData,
  disconnectAll,
  HealthPlatform,
  SyncDataType,
  SyncedHealthData,
  PLATFORM_LABELS,
  detectPlatform,
} from "@/lib/healthKit";
import type { HealthDailyMetrics } from "@/lib/health-readiness";

const POLL_INTERVAL = 15 * 60 * 1000; // 15 minutes

async function upsertHealthDailyMetrics(userId: string, syncedData: SyncedHealthData) {
  const metricDate = getQatarDay(new Date(syncedData.syncedAt));
  const payload: Partial<HealthDailyMetrics> & { user_id: string; metric_date: string } = {
    user_id: userId,
    metric_date: metricDate,
    steps: syncedData.steps ?? 0,
    workouts_count: syncedData.workoutCount ?? 0,
    active_calories: syncedData.activeCalories ?? 0,
    resting_heart_rate: syncedData.restingHeartRate,
    average_heart_rate: syncedData.heartRate,
    hrv: syncedData.hrv,
    sleep_minutes: syncedData.sleepMinutes,
    deep_sleep_minutes: syncedData.deepSleepMinutes,
    rem_sleep_minutes: syncedData.remSleepMinutes,
    respiratory_rate: syncedData.respiratoryRate,
    spo2: syncedData.spo2,
    source: syncedData.source,
    synced_at: syncedData.syncedAt,
  };

  const { error } = await supabase
    .from("health_daily_metrics" as never)
    .upsert(payload as never, { onConflict: "user_id,metric_date" });

  if (error) {
    throw error;
  }
}

export interface HealthKitState {
  platform: HealthPlatform;
  isAvailable: boolean;
  isConnected: boolean;
  enabledTypes: SyncDataType[];
  lastSyncTimestamp: number | null;
  syncedData: SyncedHealthData | null;
  isSyncing: boolean;
}

export function useHealthKitIntegration() {
  const { user } = useAuth();
  const [state, setState] = useState<HealthKitState>(() => {
    const config = getConfig(user?.id);
    return {
      platform: config.platform,
      isAvailable: false,
      isConnected: config.enabledDataTypes.length > 0,
      enabledTypes: config.enabledDataTypes,
      lastSyncTimestamp: config.lastSyncTimestamp,
      syncedData: getCachedHealthData(user?.id, getQatarDay()),
      isSyncing: false,
    };
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkAvailability = useCallback(async () => {
    const platform = detectPlatform();
    if (platform === "none") {
      setState((prev) => ({ ...prev, isAvailable: false, platform }));
      return false;
    }

    try {
      if (platform === "apple_health") {
        const { HealthKit } = await import("@/services/health/healthkit");
        const available = await HealthKit.isAvailable();
        setState((prev) => ({ ...prev, isAvailable: available, platform }));
        return available;
      } else if (platform === "google_fit") {
        const { isAvailable } = await import("@/services/health/googleFit");
        const available = await isAvailable();
        setState((prev) => ({ ...prev, isAvailable: available, platform }));
        return available;
      }
    } catch {
      setState((prev) => ({ ...prev, isAvailable: false }));
    }

    return false;
  }, []);

  const checkExistingGoogleFitToken = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    const { data } = await supabase
      .from("user_integrations")
      .select("access_token, expires_at")
      .eq("user_id", user.id)
      .eq("provider", "google_fit")
      .maybeSingle();

    if (data?.access_token) {
      const isValid = data.expires_at * 1000 > Date.now();
      return isValid;
    }
    return false;
  }, [user]);

  const requestPermissions = useCallback(async (types: SyncDataType[]): Promise<boolean> => {
    if (!user) return false;

    try {
      if (state.platform === "apple_health") {
        const { HealthKit } = await import("@/services/health/healthkit");
        const requested = {
          steps: types.includes("steps"),
          heartRate: types.includes("heart_rate"),
          workouts: types.includes("workouts"),
          energy: types.includes("workouts"),
          sleep: types.includes("sleep"),
          recovery: types.includes("recovery"),
        };
        const granted = await HealthKit.requestPermissions(requested);
        return !!granted;
      } else if (state.platform === "google_fit") {
        const { requestPermissions: requestGFit } = await import("@/services/health/googleFit");
        const needsActivity = types.includes("steps") || types.includes("workouts") || types.includes("sleep");
        const needsBody = types.includes("heart_rate") || types.includes("recovery");
        const granted = await requestGFit({
          activity: needsActivity,
          body: needsBody,
          location: false,
        });
        if (granted && (granted.activity || granted.body)) {
          return true;
        }
        const hasOAuthToken = await checkExistingGoogleFitToken();
        return hasOAuthToken;
      }
    } catch {
      toast.error("Failed to request health permissions");
    }

    return false;
  }, [user, state.platform, checkExistingGoogleFitToken]);

  const syncData = useCallback(async (): Promise<void> => {
    if (!user) return;
    const config = getConfig(user.id);
    if (config.enabledDataTypes.length === 0) return;

    setState((prev) => ({ ...prev, isSyncing: true }));

    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      const syncedData: SyncedHealthData = {
        steps: null,
        heartRate: null,
        workoutCount: null,
        activeCalories: null,
        restingHeartRate: null,
        hrv: null,
        sleepMinutes: null,
        deepSleepMinutes: null,
        remSleepMinutes: null,
        respiratoryRate: null,
        spo2: null,
        source: config.platform,
        syncedAt: new Date().toISOString(),
      };

      if (config.platform === "apple_health") {
        const { HealthKit } = await import("@/services/health/healthkit");
        const [steps, healthData, workouts] = await Promise.all([
          config.enabledDataTypes.includes("steps")
            ? HealthKit.getStepCount({ start: startOfDay, end: endOfDay })
            : null,
          config.enabledDataTypes.some((type) => ["heart_rate", "sleep", "recovery", "workouts"].includes(type))
            ? HealthKit.getHealthData({ start: startOfDay, end: endOfDay })
            : null,
          config.enabledDataTypes.includes("workouts")
            ? HealthKit.getWorkouts({ start: startOfDay, end: endOfDay })
            : null,
        ]);
        if (steps !== null) syncedData.steps = steps;
        if (healthData?.heartRate) syncedData.heartRate = healthData.heartRate;
        if (healthData?.restingHeartRate) syncedData.restingHeartRate = healthData.restingHeartRate;
        if (healthData?.hrv) syncedData.hrv = healthData.hrv;
        if (healthData?.activeEnergy) syncedData.activeCalories = healthData.activeEnergy;
        if (healthData?.sleepMinutes) syncedData.sleepMinutes = healthData.sleepMinutes;
        if (healthData?.respiratoryRate) syncedData.respiratoryRate = healthData.respiratoryRate;
        if (healthData?.spo2) syncedData.spo2 = healthData.spo2;
        if (workouts) syncedData.workoutCount = workouts.length;
      } else if (config.platform === "google_fit") {
        const { getHealthData } = await import("@/services/health/googleFit");
        const healthData = await getHealthData({ start: startOfDay, end: endOfDay });

        if (healthData) {
          if (typeof healthData.steps === "number") syncedData.steps = healthData.steps;
          if (typeof healthData.caloriesBurned === "number") syncedData.activeCalories = healthData.caloriesBurned;
          if (healthData.heartRate) syncedData.heartRate = healthData.heartRate;
          if (healthData.restingHeartRate) syncedData.restingHeartRate = healthData.restingHeartRate;
          if (healthData.hrv) syncedData.hrv = healthData.hrv;
          if (healthData.sleepMinutes) syncedData.sleepMinutes = healthData.sleepMinutes;
          if (healthData.respiratoryRate) syncedData.respiratoryRate = healthData.respiratoryRate;
          if (healthData.spo2) syncedData.spo2 = healthData.spo2;
          if (healthData.workouts) syncedData.workoutCount = healthData.workouts.length;
        }

        if (config.enabledDataTypes.includes("workouts") && syncedData.workoutCount === null) {
          const workouts = await fetchAndSaveGoogleFitWorkouts(user.id, startOfDay, endOfDay);
          syncedData.workoutCount = workouts.length;
        }

        if (!healthData) {
          const { data: tokens } = await supabase
            .from("user_integrations")
            .select("access_token, expires_at")
            .eq("user_id", user.id)
            .eq("provider", "google_fit")
            .maybeSingle();

          if (tokens?.access_token) {
            const legacyHealthData = await getHealthData(
              { start: startOfDay, end: endOfDay },
              { accessToken: tokens.access_token, expiresAt: tokens.expires_at * 1000 }
            );
            if (legacyHealthData?.steps && syncedData.steps === null) syncedData.steps = legacyHealthData.steps;
            if (legacyHealthData?.caloriesBurned) syncedData.activeCalories = legacyHealthData.caloriesBurned;
            if (legacyHealthData?.heartRate) syncedData.heartRate = legacyHealthData.heartRate;
            if (legacyHealthData?.sleepMinutes) syncedData.sleepMinutes = legacyHealthData.sleepMinutes;
          }
        }
      }

      const { error: syncHistoryError } = await supabase.from("health_sync_data").upsert({
        user_id: user.id,
        platform: config.platform,
        data: syncedData as unknown as Json,
        synced_at: new Date().toISOString(),
      });
      if (syncHistoryError) throw syncHistoryError;

      await upsertHealthDailyMetrics(user.id, syncedData);
      setCachedHealthData(syncedData, user.id, getQatarDay(new Date(syncedData.syncedAt)));

      const updatedConfig = markSynced(user.id);
      setState((prev) => ({
        ...prev,
        syncedData,
        lastSyncTimestamp: updatedConfig.lastSyncTimestamp,
        isSyncing: false,
      }));
    } catch (err) {
      console.error("Health sync failed:", err);
      setState((prev) => ({ ...prev, isSyncing: false }));
    }
  }, [user]);

  const toggleDataType = useCallback(
    async (dataType: SyncDataType, enabled: boolean) => {
      if (!user) return;

      if (enabled) {
        const success = await requestPermissions([dataType]);
        if (!success) {
          toast.error(`Could not enable ${dataType} sync`);
          return;
        }
      }

      const config = getConfig(user.id);
      if (enabled && !config.enabledDataTypes.includes(dataType)) {
        config.enabledDataTypes.push(dataType);
      } else if (!enabled) {
        config.enabledDataTypes = config.enabledDataTypes.filter((d) => d !== dataType);
      }
      saveConfig(config, user.id);

      const hasAny = config.enabledDataTypes.length > 0;
      setState((prev) => ({
        ...prev,
        enabledTypes: config.enabledDataTypes,
        isConnected: hasAny,
      }));

      if (enabled && hasAny) {
        toast.success(`Connected to ${PLATFORM_LABELS[config.platform]} - ${dataType}`);
        // Perform initial sync
        await syncData();
      } else if (!hasAny) {
        toast.success(`Disconnected from ${PLATFORM_LABELS[config.platform]}`);
      }
    },
    [user, requestPermissions, syncData]
  );

  const disconnect = useCallback(() => {
    disconnectAll(user?.id);
    setState((prev) => ({
      ...prev,
      enabledTypes: [],
      isConnected: false,
      syncedData: null,
      lastSyncTimestamp: null,
    }));
    toast.success(`Disconnected from ${PLATFORM_LABELS[state.platform]}`);
  }, [state.platform, user?.id]);

  const formatLastSync = useCallback((): string => {
    if (!state.lastSyncTimestamp) return "Never";
    const diff = Date.now() - state.lastSyncTimestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }, [state.lastSyncTimestamp]);

  // Start polling when connected
  useEffect(() => {
    if (state.enabledTypes.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const doSync = async () => {
      if (user && shouldSync(getConfig(user.id))) {
        await syncData();
      }
    };

    // Initial sync
    doSync();

    // Periodic sync
    intervalRef.current = setInterval(doSync, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state.enabledTypes, syncData, user]);

  // Check availability on mount
  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  useEffect(() => {
    const config = getConfig(user?.id);
    setState((previous) => ({
      ...previous,
      platform: config.platform,
      isConnected: config.enabledDataTypes.length > 0,
      enabledTypes: config.enabledDataTypes,
      lastSyncTimestamp: config.lastSyncTimestamp,
      syncedData: getCachedHealthData(user?.id, getQatarDay()),
      isSyncing: false,
    }));
  }, [user?.id]);

  return {
    ...state,
    checkAvailability,
    toggleDataType,
    disconnect,
    syncData,
    requestPermissions,
    formatLastSync,
    isSyncing: state.isSyncing,
  };
}
