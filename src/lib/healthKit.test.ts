import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCachedHealthData,
  getConfig,
  saveConfig,
  setCachedHealthData,
  type HealthSyncConfig,
  type SyncedHealthData,
} from "@/lib/healthKit";

const cacheKey = (userId: string) => `nutrio_health_sync_data:${encodeURIComponent(userId)}`;
const configKey = (userId: string) => `nutrio_health_sync_config:${encodeURIComponent(userId)}`;

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
}

const healthData = (syncedAt: string): SyncedHealthData => ({
  steps: 8123,
  heartRate: 72,
  workoutCount: 1,
  activeCalories: 410,
  restingHeartRate: 61,
  hrv: 48,
  sleepMinutes: 445,
  deepSleepMinutes: 95,
  remSleepMinutes: 105,
  respiratoryRate: 15,
  spo2: 98,
  source: "apple_health",
  syncedAt,
});

describe("healthKit user-scoped cache", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    vi.stubGlobal("sessionStorage", createMemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores the owner, Qatar source date, and original sync timestamp", () => {
    const data = healthData("2026-07-11T21:30:00.000Z");

    setCachedHealthData(data, "user-a");

    expect(JSON.parse(sessionStorage.getItem(cacheKey("user-a")) ?? "null")).toMatchObject({
      version: 1,
      userId: "user-a",
      sourceDate: "2026-07-12",
      syncedAt: data.syncedAt,
      data,
    });
    expect(getCachedHealthData("user-a", "2026-07-12")).toEqual(data);
  });

  it("never reads or writes an unscoped legacy cache entry", () => {
    const data = healthData("2026-07-12T08:00:00.000Z");
    localStorage.setItem("nutrio_health_sync_data", JSON.stringify(data));

    expect(getCachedHealthData()).toBeNull();
    expect(localStorage.getItem("nutrio_health_sync_data")).toBeNull();

    setCachedHealthData(data);
    expect(localStorage.getItem("nutrio_health_sync_data")).toBeNull();
  });

  it("rejects another account even if its record is copied into the requested key", () => {
    const data = healthData("2026-07-12T08:00:00.000Z");
    setCachedHealthData(data, "user-a", "2026-07-12");

    expect(getCachedHealthData("user-b", "2026-07-12")).toBeNull();

    const userARecord = sessionStorage.getItem(cacheKey("user-a"));
    sessionStorage.setItem(cacheKey("user-b"), userARecord ?? "");

    expect(getCachedHealthData("user-b", "2026-07-12")).toBeNull();
    expect(sessionStorage.getItem(cacheKey("user-b"))).toBeNull();
    expect(getCachedHealthData("user-a", "2026-07-12")).toEqual(data);
  });

  it("keeps stale data attached to its source date instead of returning it as today", () => {
    const staleData = healthData("2026-07-11T08:00:00.000Z");
    setCachedHealthData(staleData, "user-a", "2026-07-11");

    expect(getCachedHealthData("user-a", "2026-07-12")).toBeNull();
    expect(getCachedHealthData("user-a", "2026-07-11")).toEqual(staleData);
  });

  it("rejects source dates that disagree with syncedAt in Qatar", () => {
    const data = healthData("2026-07-11T21:30:00.000Z");

    setCachedHealthData(data, "user-a", "2026-07-11");

    expect(sessionStorage.getItem(cacheKey("user-a"))).toBeNull();

    sessionStorage.setItem(cacheKey("user-a"), JSON.stringify({
      version: 1,
      userId: "user-a",
      sourceDate: "2026-07-11",
      syncedAt: data.syncedAt,
      data,
    }));
    expect(getCachedHealthData("user-a", "2026-07-11")).toBeNull();
    expect(sessionStorage.getItem(cacheKey("user-a"))).toBeNull();
  });

  it("keeps health permissions and polling state scoped to one account", () => {
    const config: HealthSyncConfig = {
      platform: "apple_health",
      enabledDataTypes: ["steps", "workouts"],
      pollIntervalMs: 900000,
      lastSyncTimestamp: 12345,
    };

    saveConfig(config, "user-a");

    expect(getConfig("user-a")).toEqual(config);
    expect(getConfig("user-b").enabledDataTypes).toEqual([]);
    expect(localStorage.getItem(configKey("user-b"))).toBeNull();
  });

  it("deletes an ownerless legacy health configuration", () => {
    localStorage.setItem("nutrio_health_sync_config", JSON.stringify({
      platform: "apple_health",
      enabledDataTypes: ["steps"],
    }));

    expect(getConfig().enabledDataTypes).toEqual([]);
    expect(localStorage.getItem("nutrio_health_sync_config")).toBeNull();
  });
});
