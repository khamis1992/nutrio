/**
 * HealthKit Abstraction Layer
 *
 * Provides a unified interface for fitness wearable integrations:
 * - Apple HealthKit (iOS via Capacitor plugin)
 * - Google Fit (Android native + web OAuth)
 *
 * Capabilities supported:
 * - Sync Steps
 * - Sync Heart Rate
 * - Sync Workouts
 * - Poll/sync at configurable intervals
 * - Store synced data in Supabase + localStorage
 */

import { isNative, isIOS, isAndroid } from "@/lib/capacitor";

export type HealthPlatform = "apple_health" | "google_fit" | "none";

export type SyncDataType = "steps" | "heart_rate" | "workouts" | "sleep" | "recovery";

export interface HealthSyncConfig {
  platform: HealthPlatform;
  enabledDataTypes: SyncDataType[];
  pollIntervalMs: number;
  lastSyncTimestamp: number | null;
}

export interface SyncedHealthData {
  steps: number | null;
  heartRate: number | null;
  workoutCount: number | null;
  activeCalories: number | null;
  restingHeartRate: number | null;
  hrv: number | null;
  sleepMinutes: number | null;
  deepSleepMinutes: number | null;
  remSleepMinutes: number | null;
  respiratoryRate: number | null;
  spo2: number | null;
  source: HealthPlatform;
  syncedAt: string;
}

const CONFIG_STORAGE_KEY = "nutrio_health_sync_config";
const DATA_STORAGE_KEY = "nutrio_health_sync_data";
const DEFAULT_POLL_INTERVAL = 15 * 60 * 1000; // 15 minutes

export function detectPlatform(): HealthPlatform {
  if (isNative) {
    if (isIOS) return "apple_health";
    if (isAndroid) return "google_fit";
  }
  return "none";
}

export function getConfig(): HealthSyncConfig {
  const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // fall through to default
    }
  }
  return {
    platform: detectPlatform(),
    enabledDataTypes: [],
    pollIntervalMs: DEFAULT_POLL_INTERVAL,
    lastSyncTimestamp: null,
  };
}

export function saveConfig(config: HealthSyncConfig): void {
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
}

export function updateConfigToggle(dataType: SyncDataType, enabled: boolean): HealthSyncConfig {
  const config = getConfig();
  if (enabled && !config.enabledDataTypes.includes(dataType)) {
    config.enabledDataTypes.push(dataType);
  } else if (!enabled) {
    config.enabledDataTypes = config.enabledDataTypes.filter((d) => d !== dataType);
  }
  saveConfig(config);
  return config;
}

export function getCachedHealthData(): SyncedHealthData | null {
  const stored = localStorage.getItem(DATA_STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function setCachedHealthData(data: SyncedHealthData): void {
  localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify(data));
}

export function shouldSync(config?: HealthSyncConfig): boolean {
  const cfg = config || getConfig();
  if (cfg.enabledDataTypes.length === 0) return false;
  if (!cfg.lastSyncTimestamp) return true;
  return Date.now() - cfg.lastSyncTimestamp >= cfg.pollIntervalMs;
}

export function markSynced(): HealthSyncConfig {
  const config = getConfig();
  config.lastSyncTimestamp = Date.now();
  saveConfig(config);
  return config;
}

export function disconnectAll(): void {
  const config = getConfig();
  config.enabledDataTypes = [];
  config.lastSyncTimestamp = null;
  saveConfig(config);
  localStorage.removeItem(DATA_STORAGE_KEY);
}

export const PLATFORM_LABELS: Record<HealthPlatform, string> = {
  apple_health: "Apple Health",
  google_fit: "Google Fit",
  none: "None",
};

export const DATA_TYPE_LABELS: Record<SyncDataType, string> = {
  steps: "Sync Steps",
  heart_rate: "Sync Heart Rate",
  workouts: "Sync Workouts",
  sleep: "Sync Sleep",
  recovery: "Sync Recovery",
};

export const DATA_TYPE_ICONS: Record<SyncDataType, string> = {
  steps: "footprints",
  heart_rate: "heart-pulse",
  workouts: "dumbbell",
  sleep: "moon",
  recovery: "activity",
};
