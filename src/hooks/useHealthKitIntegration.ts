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
import {
  fetchAndSaveGoogleFitWorkouts,
  isGoogleFitConnected,
} from "@/lib/google-fit-workout-service";
import { getQatarDay } from "@/lib/dateUtils";
import { disconnectWearableProvider } from "@/lib/wearable-disconnect";
import { isPhaseOneFeatureEnabled } from "@/lib/phase-one-feature-flags";
import {
  getBloodGlucoseSyncWindow,
  recordWearableSyncFailure,
  syncBloodGlucoseSamples,
  syncWearableDailyAggregate,
} from "@/lib/wearable-sync";
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
  type NativeHealthCapabilities,
} from "@/lib/healthKit";
import type { HealthDailyMetrics } from "@/lib/health-readiness";

const POLL_INTERVAL = 15 * 60 * 1000; // 15 minutes
const SERVER_STALE_AFTER_MS = 45 * 60 * 1000;

export type WearableServerStatus = "connected" | "syncing" | "synced" | "stale" | "error" | "revoked";

const UNAVAILABLE_CAPABILITIES: NativeHealthCapabilities = {
  healthData: "unavailable",
  bloodGlucoseRead: "unavailable",
  incrementalSync: "unsupported",
  backgroundSync: "unsupported",
};

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
  isDisconnecting: boolean;
  capabilities: NativeHealthCapabilities;
  serverSyncStatus: WearableServerStatus | null;
  serverError: string | null;
  serverLastSuccessAt: string | null;
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
      isDisconnecting: false,
      capabilities: UNAVAILABLE_CAPABILITIES,
      serverSyncStatus: null,
      serverError: null,
      serverLastSuccessAt: null,
    };
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshServerStatus = useCallback(async () => {
    if (!user || state.platform === "none" || !isPhaseOneFeatureEnabled("wearableNormalization")) {
      setState((previous) => ({
        ...previous,
        serverSyncStatus: null,
        serverError: null,
        serverLastSuccessAt: null,
      }));
      return;
    }

    const { error: staleRefreshError } = await supabase.rpc(
      "refresh_my_wearable_sync_staleness" as never,
      {} as never,
    );
    if (staleRefreshError && staleRefreshError.code !== "42883") {
      console.error("Wearable staleness refresh failed:", staleRefreshError);
    }

    const { data, error } = await supabase
      .from("wearable_sync_sources")
      .select("status,last_success_at,last_error_message")
      .eq("user_id", user.id)
      .eq("provider", state.platform)
      .maybeSingle();
    if (error) {
      console.error("Wearable server status failed:", error);
      setState((previous) => ({ ...previous, serverSyncStatus: "error", serverError: error.message }));
      return;
    }

    const lastSuccessAt = data?.last_success_at ?? null;
    const isStale = Boolean(lastSuccessAt)
      && Date.now() - new Date(lastSuccessAt!).getTime() > SERVER_STALE_AFTER_MS;
    const status = data?.status as WearableServerStatus | undefined;
    setState((previous) => ({
      ...previous,
      serverSyncStatus: status === "synced" && isStale ? "stale" : status ?? null,
      serverError: data?.last_error_message ?? null,
      serverLastSuccessAt: lastSuccessAt,
    }));
  }, [state.platform, user]);

  const checkAvailability = useCallback(async () => {
    const platform = detectPlatform();
    if (platform === "none") {
      setState((prev) => ({
        ...prev,
        isAvailable: false,
        platform,
        capabilities: UNAVAILABLE_CAPABILITIES,
      }));
      return false;
    }

    try {
      if (platform === "apple_health") {
        const { HealthKit } = await import("@/services/health/healthkit");
        const capabilities = await HealthKit.getCapabilities();
        const available = capabilities.healthData === "available";
        setState((prev) => ({ ...prev, isAvailable: available, platform, capabilities }));
        return available;
      } else if (platform === "google_fit") {
        const { isAvailable } = await import("@/services/health/googleFit");
        const available = await isAvailable();
        setState((prev) => ({
          ...prev,
          isAvailable: available,
          platform,
          capabilities: {
            healthData: available ? "available" : "unavailable",
            bloodGlucoseRead: "unsupported",
            incrementalSync: "unsupported",
            backgroundSync: "unsupported",
          },
        }));
        return available;
      }
    } catch {
      setState((prev) => ({ ...prev, isAvailable: false }));
    }

    return false;
  }, []);

  const checkExistingGoogleFitToken = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    return isGoogleFitConnected();
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
          bloodGlucose: types.includes("blood_glucose"),
        };
        const granted = await HealthKit.requestPermissions(requested);
        if (!granted) return false;
        const allGranted = types.every((type) => {
          if (type === "steps") return granted.steps === true;
          if (type === "heart_rate") return granted.heartRate === true;
          if (type === "workouts") return granted.workouts === true;
          if (type === "sleep") return granted.sleep === true;
          if (type === "recovery") return granted.recovery === true;
          if (type === "blood_glucose") return granted.bloodGlucose === true;
          return false;
        });
        if (allGranted && types.includes("blood_glucose")) {
          setState((previous) => ({
            ...previous,
            capabilities: { ...previous.capabilities, bloodGlucoseRead: "available" },
          }));
        }
        return allGranted;
      } else if (state.platform === "google_fit") {
        if (types.includes("blood_glucose")) return false;
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
      const metricDate = getQatarDay(startOfDay);

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

        if (config.enabledDataTypes.includes("blood_glucose")) {
          const glucoseWindow = await getBloodGlucoseSyncWindow(user.id, "apple_health");
          const glucoseSamples = await HealthKit.getBloodGlucoseSamples(glucoseWindow);
          const glucoseSync = await syncBloodGlucoseSamples(
            user.id,
            "apple_health",
            glucoseSamples,
            glucoseWindow,
          );
          if (glucoseSync.status !== "synced") {
            throw new Error(glucoseSync.error ?? "Blood glucose sync was not fully accepted");
          }
        }
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

      }

      const { error: syncHistoryError } = await supabase.from("health_sync_data").upsert({
        user_id: user.id,
        platform: config.platform,
        data: syncedData as unknown as Json,
        synced_at: new Date().toISOString(),
      });
      if (syncHistoryError) throw syncHistoryError;

      const normalizationEnabled = isPhaseOneFeatureEnabled("wearableNormalization");
      const normalized = normalizationEnabled
        ? await syncWearableDailyAggregate(user.id, syncedData, {
          start: startOfDay,
          end: endOfDay,
          metricDate,
        })
        : null;
      if (!normalizationEnabled || normalized?.status !== "synced") {
        await upsertHealthDailyMetrics(user.id, syncedData);
      }
      if (normalized?.status === "partial") {
        throw new Error(normalized.error ?? "Daily wearable ingest was only partially accepted");
      }
      setCachedHealthData(syncedData, user.id, getQatarDay(new Date(syncedData.syncedAt)));

      const updatedConfig = markSynced(user.id);
      setState((prev) => ({
        ...prev,
        syncedData,
        lastSyncTimestamp: updatedConfig.lastSyncTimestamp,
        isSyncing: false,
      }));
      await refreshServerStatus();
    } catch (err) {
      console.error("Health sync failed:", err);
      const message = err instanceof Error ? err.message : "Health sync failed";
      setState((prev) => ({
        ...prev,
        isSyncing: false,
        serverSyncStatus: isPhaseOneFeatureEnabled("wearableNormalization") ? "error" : prev.serverSyncStatus,
        serverError: message,
      }));
      if (isPhaseOneFeatureEnabled("wearableNormalization") && config.platform !== "none") {
        await recordWearableSyncFailure(user.id, config.platform, message);
      }
    }
  }, [refreshServerStatus, user]);

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

  const disconnect = useCallback(async () => {
    if (!user) {
      toast.error("Sign in before disconnecting a health app.");
      return false;
    }

    setState((prev) => ({ ...prev, isDisconnecting: true }));
    try {
      await disconnectWearableProvider(state.platform);
      disconnectAll(user.id);
      setState((prev) => ({
        ...prev,
        enabledTypes: [],
        isConnected: false,
        syncedData: null,
        lastSyncTimestamp: null,
        serverSyncStatus: "revoked",
        serverError: null,
        serverLastSuccessAt: null,
      }));
      toast.success(`Disconnected from ${PLATFORM_LABELS[state.platform]}`);
      return true;
    } catch (error) {
      console.error("Wearable disconnect failed:", error);
      toast.error("Could not disconnect the health app", {
        description: "Your connection was kept so you can try again safely.",
      });
      return false;
    } finally {
      setState((prev) => ({ ...prev, isDisconnecting: false }));
    }
  }, [state.platform, user]);

  const reconnect = useCallback(async () => {
    if (state.isConnected) {
      await syncData();
      return true;
    }
    await toggleDataType("steps", true);
    return true;
  }, [state.isConnected, syncData, toggleDataType]);

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
      isDisconnecting: false,
      capabilities: previous.capabilities,
    }));
  }, [user?.id]);

  useEffect(() => {
    void refreshServerStatus();
    const statusInterval = setInterval(() => void refreshServerStatus(), 60_000);
    return () => clearInterval(statusInterval);
  }, [refreshServerStatus]);

  return {
    ...state,
    checkAvailability,
    toggleDataType,
    disconnect,
    reconnect,
    refreshServerStatus,
    syncData,
    requestPermissions,
    formatLastSync,
    isSyncing: state.isSyncing,
  };
}
