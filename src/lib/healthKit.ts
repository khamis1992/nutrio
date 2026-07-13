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
import { getQatarDay } from "@/lib/dateUtils";

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
const CONFIG_STORAGE_PREFIX = `${CONFIG_STORAGE_KEY}:`;
const DATA_CACHE_VERSION = 1;
const DATA_STORAGE_PREFIX = `${DATA_STORAGE_KEY}:`;
const DEFAULT_POLL_INTERVAL = 15 * 60 * 1000; // 15 minutes

interface CachedHealthDataRecord {
  version: typeof DATA_CACHE_VERSION;
  userId: string;
  sourceDate: string;
  syncedAt: string;
  data: SyncedHealthData;
}

interface CachedHealthConfigRecord {
  version: typeof DATA_CACHE_VERSION;
  userId: string;
  config: HealthSyncConfig;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidUserId(userId: string | undefined): userId is string {
  return typeof userId === "string" && userId.trim().length > 0;
}

function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function qatarDateFromSyncedAt(syncedAt: string): string | null {
  if (typeof syncedAt !== "string" || syncedAt.trim().length === 0) return null;

  const parsed = new Date(syncedAt);
  if (Number.isNaN(parsed.getTime())) return null;
  return getQatarDay(parsed);
}

function getDataStorageKey(userId: string): string {
  return `${DATA_STORAGE_PREFIX}${encodeURIComponent(userId)}`;
}

function getConfigStorageKey(userId: string): string {
  return `${CONFIG_STORAGE_PREFIX}${encodeURIComponent(userId)}`;
}

function defaultConfig(): HealthSyncConfig {
  return {
    platform: detectPlatform(),
    enabledDataTypes: [],
    pollIntervalMs: DEFAULT_POLL_INTERVAL,
    lastSyncTimestamp: null,
  };
}

function removeInvalidCachedRecord(storageKey: string): null {
  localStorage.removeItem(storageKey);
  return null;
}

export function detectPlatform(): HealthPlatform {
  if (isNative) {
    if (isIOS) return "apple_health";
    if (isAndroid) return "google_fit";
  }
  return "none";
}

export function getConfig(userId?: string): HealthSyncConfig {
  localStorage.removeItem(CONFIG_STORAGE_KEY);
  if (!isValidUserId(userId)) return defaultConfig();

  const storageKey = getConfigStorageKey(userId);
  const stored = localStorage.getItem(storageKey);
  if (!stored) return defaultConfig();

  try {
    const parsed: unknown = JSON.parse(stored);
    if (
      !isRecord(parsed)
      || parsed.version !== DATA_CACHE_VERSION
      || parsed.userId !== userId
      || !isRecord(parsed.config)
      || !Array.isArray(parsed.config.enabledDataTypes)
    ) {
      localStorage.removeItem(storageKey);
      return defaultConfig();
    }
    return parsed.config as unknown as HealthSyncConfig;
  } catch {
    localStorage.removeItem(storageKey);
    return defaultConfig();
  }
}

export function saveConfig(config: HealthSyncConfig, userId?: string): void {
  localStorage.removeItem(CONFIG_STORAGE_KEY);
  if (!isValidUserId(userId)) return;

  const record: CachedHealthConfigRecord = {
    version: DATA_CACHE_VERSION,
    userId,
    config,
  };
  localStorage.setItem(getConfigStorageKey(userId), JSON.stringify(record));
}

export function updateConfigToggle(dataType: SyncDataType, enabled: boolean, userId?: string): HealthSyncConfig {
  const config = getConfig(userId);
  if (enabled && !config.enabledDataTypes.includes(dataType)) {
    config.enabledDataTypes.push(dataType);
  } else if (!enabled) {
    config.enabledDataTypes = config.enabledDataTypes.filter((d) => d !== dataType);
  }
  saveConfig(config, userId);
  return config;
}

export function getCachedHealthData(userId?: string, sourceDate?: string): SyncedHealthData | null {
  // An unscoped legacy record has no provable owner and must never be reused.
  localStorage.removeItem(DATA_STORAGE_KEY);
  if (!isValidUserId(userId)) return null;

  const storageKey = getDataStorageKey(userId);
  const stored = localStorage.getItem(storageKey);
  if (!stored) return null;

  try {
    const parsed: unknown = JSON.parse(stored);
    if (
      !isRecord(parsed)
      || parsed.version !== DATA_CACHE_VERSION
      || parsed.userId !== userId
      || typeof parsed.sourceDate !== "string"
      || typeof parsed.syncedAt !== "string"
      || !isRecord(parsed.data)
      || typeof parsed.data.syncedAt !== "string"
    ) {
      return removeInvalidCachedRecord(storageKey);
    }

    const syncedQatarDate = qatarDateFromSyncedAt(parsed.syncedAt);
    if (
      !isValidDateKey(parsed.sourceDate)
      || syncedQatarDate !== parsed.sourceDate
      || parsed.data.syncedAt !== parsed.syncedAt
    ) {
      return removeInvalidCachedRecord(storageKey);
    }

    if (sourceDate !== undefined) {
      if (!isValidDateKey(sourceDate) || parsed.sourceDate !== sourceDate) return null;
    }

    return parsed.data as unknown as SyncedHealthData;
  } catch {
    return removeInvalidCachedRecord(storageKey);
  }
}

export function setCachedHealthData(data: SyncedHealthData, userId?: string, sourceDate?: string): void {
  // Clear the old shared slot, but never guess which user an unscoped write belongs to.
  localStorage.removeItem(DATA_STORAGE_KEY);
  if (!isValidUserId(userId)) return;

  const syncedQatarDate = qatarDateFromSyncedAt(data.syncedAt);
  if (syncedQatarDate === null) return;

  const resolvedSourceDate = sourceDate ?? syncedQatarDate;
  if (
    !isValidDateKey(resolvedSourceDate)
    || resolvedSourceDate !== syncedQatarDate
  ) {
    return;
  }

  const record: CachedHealthDataRecord = {
    version: DATA_CACHE_VERSION,
    userId,
    sourceDate: resolvedSourceDate,
    syncedAt: data.syncedAt,
    data,
  };
  localStorage.setItem(getDataStorageKey(userId), JSON.stringify(record));
}

export function shouldSync(config: HealthSyncConfig): boolean {
  const cfg = config;
  if (cfg.enabledDataTypes.length === 0) return false;
  if (!cfg.lastSyncTimestamp) return true;
  return Date.now() - cfg.lastSyncTimestamp >= cfg.pollIntervalMs;
}

export function markSynced(userId: string): HealthSyncConfig {
  const config = getConfig(userId);
  config.lastSyncTimestamp = Date.now();
  saveConfig(config, userId);
  return config;
}

export function disconnectAll(userId?: string): void {
  const config = getConfig(userId);
  config.enabledDataTypes = [];
  config.lastSyncTimestamp = null;
  saveConfig(config, userId);
  localStorage.removeItem(DATA_STORAGE_KEY);

  if (isValidUserId(userId)) {
    localStorage.removeItem(getDataStorageKey(userId));
    return;
  }

  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(DATA_STORAGE_PREFIX) || key?.startsWith(CONFIG_STORAGE_PREFIX)) {
      localStorage.removeItem(key);
    }
  }
}

export const PLATFORM_LABELS: Record<HealthPlatform, string> = {
  apple_health: "Apple Health",
  google_fit: "Google Fit / Health Connect",
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
