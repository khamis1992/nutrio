/**
 * Apple HealthKit Integration Service
 *
 * Provides a Capacitor interface for Apple HealthKit through
 * @capgo/capacitor-health. Web and non-iOS environments gracefully
 * return empty values so the app can keep running in local development.
 */

import { isNative, isIOS } from "@/lib/capacitor";
import type { BloodGlucoseSample, NativeHealthCapabilities } from "@/lib/healthKit";
import type { WorkoutData } from "@/lib/health-types";
import type { HealthDataType, HealthPlugin } from "@capgo/capacitor-health";

async function getPlugin(): Promise<HealthPlugin | null> {
  if (!isNative || !isIOS) return null;
  try {
    const { Health } = await import("@capgo/capacitor-health");
    return Health;
  } catch {
    return null;
  }
}

const HEALTH_DATA_TYPES = {
  steps: "steps",
  heartRate: "heartRate",
  restingHeartRate: "restingHeartRate",
  hrv: "heartRateVariability",
  activeEnergy: "calories",
  distanceWalking: "distance",
  sleep: "sleep",
  respiratoryRate: "respiratoryRate",
  spo2: "oxygenSaturation",
  workout: "workouts",
  bloodGlucose: "bloodGlucose",
} as const;

export type HealthKitDataType = keyof typeof HEALTH_DATA_TYPES;

export interface HealthKitPermissionRequest {
  steps?: boolean;
  heartRate?: boolean;
  workouts?: boolean;
  energy?: boolean;
  sleep?: boolean;
  recovery?: boolean;
  bloodGlucose?: boolean;
}

const UNAVAILABLE_CAPABILITIES: NativeHealthCapabilities = {
  healthData: "unavailable",
  bloodGlucoseRead: "unavailable",
  incrementalSync: "unsupported",
  backgroundSync: "unsupported",
};

export const HealthKit = {
  async isAvailable(): Promise<boolean> {
    const plugin = await getPlugin();
    if (!plugin) return false;
    try {
      const result = await plugin.isAvailable();
      return result.available;
    } catch {
      return false;
    }
  },

  async getCapabilities(): Promise<NativeHealthCapabilities> {
    const plugin = await getPlugin();
    if (!plugin) return UNAVAILABLE_CAPABILITIES;

    try {
      const availability = await plugin.isAvailable();
      if (!availability.available) return UNAVAILABLE_CAPABILITIES;

      const authorization = await plugin.checkAuthorization({
        read: [HEALTH_DATA_TYPES.bloodGlucose],
        write: [],
      });
      const bloodGlucoseRead = authorization.readAuthorized.includes(HEALTH_DATA_TYPES.bloodGlucose)
        ? "available"
        : authorization.readDenied.includes(HEALTH_DATA_TYPES.bloodGlucose)
          ? "unavailable"
          : "unknown";

      return {
        healthData: "available",
        bloodGlucoseRead,
        incrementalSync: "overlapping_window",
        backgroundSync: "unsupported",
      };
    } catch {
      return {
        ...UNAVAILABLE_CAPABILITIES,
        healthData: "unknown",
        bloodGlucoseRead: "unknown",
      };
    }
  },

  async requestPermissions(requested: HealthKitPermissionRequest): Promise<HealthKitPermissionRequest | null> {
    const plugin = await getPlugin();
    if (!plugin) return null;

    const readTypes: HealthDataType[] = [];
    if (requested.steps) readTypes.push(HEALTH_DATA_TYPES.steps);
    if (requested.heartRate) readTypes.push(HEALTH_DATA_TYPES.heartRate);
    if (requested.recovery) {
      readTypes.push(HEALTH_DATA_TYPES.restingHeartRate, HEALTH_DATA_TYPES.hrv);
    }
    if (requested.energy || requested.workouts) readTypes.push(HEALTH_DATA_TYPES.activeEnergy);
    if (requested.workouts) readTypes.push(HEALTH_DATA_TYPES.workout);
    if (requested.sleep) readTypes.push(HEALTH_DATA_TYPES.sleep);
    if (requested.bloodGlucose) readTypes.push(HEALTH_DATA_TYPES.bloodGlucose);

    try {
      const result = await plugin.requestAuthorization({ read: readTypes, write: [] });
      if (readTypes.length > 0 && result.readAuthorized.length === 0) return null;
      return {
        ...requested,
        steps: requested.steps && result.readAuthorized.includes(HEALTH_DATA_TYPES.steps),
        heartRate: requested.heartRate && result.readAuthorized.includes(HEALTH_DATA_TYPES.heartRate),
        workouts: requested.workouts && result.readAuthorized.includes(HEALTH_DATA_TYPES.workout),
        energy: requested.energy && result.readAuthorized.includes(HEALTH_DATA_TYPES.activeEnergy),
        sleep: requested.sleep && result.readAuthorized.includes(HEALTH_DATA_TYPES.sleep),
        recovery: requested.recovery
          && result.readAuthorized.includes(HEALTH_DATA_TYPES.restingHeartRate)
          && result.readAuthorized.includes(HEALTH_DATA_TYPES.hrv),
        bloodGlucose: requested.bloodGlucose
          && result.readAuthorized.includes(HEALTH_DATA_TYPES.bloodGlucose),
      };
    } catch {
      return null;
    }
  },

  async getBloodGlucoseSamples(
    dateRange: { start: Date; end: Date },
    limit = 500,
  ): Promise<BloodGlucoseSample[]> {
    const plugin = await getPlugin();
    if (!plugin) return [];

    // The plugin has a per-query limit but no sample pagination cursor. Small
    // windows avoid truncating high-frequency CGM records during initial sync.
    const windowMs = 12 * 60 * 60 * 1000;
    const minimumWindowMs = 15 * 60 * 1000;
    const samples: BloodGlucoseSample[] = [];
    const windows: Array<{ start: number; end: number }> = [];
    for (let start = dateRange.start.getTime(); start < dateRange.end.getTime(); start += windowMs) {
      windows.push({ start, end: Math.min(start + windowMs, dateRange.end.getTime()) });
    }

    while (windows.length > 0) {
      const window = windows.shift();
      if (!window) break;
      const result = await plugin.readSamples({
        dataType: HEALTH_DATA_TYPES.bloodGlucose,
        startDate: new Date(window.start).toISOString(),
        endDate: new Date(window.end).toISOString(),
        limit,
        ascending: true,
      });

      if (result.samples.length >= limit && window.end - window.start > minimumWindowMs) {
        const midpoint = window.start + Math.floor((window.end - window.start) / 2);
        windows.unshift({ start: midpoint, end: window.end });
        windows.unshift({ start: window.start, end: midpoint });
        continue;
      }

      samples.push(...result.samples.map((sample) => ({
        value: sample.value,
        unit: sample.unit,
        startDate: sample.startDate,
        endDate: sample.endDate,
        sourceName: sample.sourceName,
        sourceId: sample.sourceId,
        platformId: sample.platformId,
      })));
    }

    return samples;
  },

  async getStepCount(dateRange: { start: Date; end: Date }): Promise<number> {
    const plugin = await getPlugin();
    if (!plugin) return 0;

    try {
      const results = await plugin.queryAggregated({
        dataType: HEALTH_DATA_TYPES.steps,
        startDate: dateRange.start.toISOString(),
        endDate: dateRange.end.toISOString(),
        bucket: "day",
        aggregation: "sum",
      });
      return Math.round(results.samples.reduce((sum, sample) => sum + sample.value, 0));
    } catch {
      return 0;
    }
  },

  async getHeartRate(dateRange: { start: Date; end: Date }): Promise<number | null> {
    const plugin = await getPlugin();
    if (!plugin) return null;

    try {
      const results = await plugin.readSamples({
        dataType: HEALTH_DATA_TYPES.heartRate,
        startDate: dateRange.start.toISOString(),
        endDate: dateRange.end.toISOString(),
        limit: 100,
        ascending: true,
      });
      if (results.samples.length === 0) return null;
      const avg = results.samples.reduce((sum, s) => sum + s.value, 0) / results.samples.length;
      return Math.round(avg);
    } catch {
      return null;
    }
  },

  async getQuantityAverage(
    dateRange: { start: Date; end: Date },
    sampleType: HealthDataType,
    _unit: string,
    limit = 100
  ): Promise<number | null> {
    const plugin = await getPlugin();
    if (!plugin) return null;

    try {
      const results = await plugin.readSamples({
        dataType: sampleType,
        startDate: dateRange.start.toISOString(),
        endDate: dateRange.end.toISOString(),
        limit,
        ascending: true,
      });
      if (results.samples.length === 0) return null;
      return Math.round(results.samples.reduce((sum, s) => sum + s.value, 0) / results.samples.length);
    } catch {
      return null;
    }
  },

  async getQuantitySum(
    dateRange: { start: Date; end: Date },
    sampleType: HealthDataType,
    _unit: string,
    limit = 1000
  ): Promise<number> {
    const plugin = await getPlugin();
    if (!plugin) return 0;

    try {
      if (["steps", "calories", "distance"].includes(sampleType)) {
        const results = await plugin.queryAggregated({
          dataType: sampleType,
          startDate: dateRange.start.toISOString(),
          endDate: dateRange.end.toISOString(),
          bucket: "day",
          aggregation: "sum",
        });
        return Math.round(results.samples.reduce((sum, sample) => sum + sample.value, 0));
      }

      const results = await plugin.readSamples({
        dataType: sampleType,
        startDate: dateRange.start.toISOString(),
        endDate: dateRange.end.toISOString(),
        limit,
      });
      return Math.round(results.samples.reduce((sum, sample) => sum + sample.value, 0));
    } catch {
      return 0;
    }
  },

  async getSleepMinutes(dateRange: { start: Date; end: Date }): Promise<number | null> {
    const plugin = await getPlugin();
    if (!plugin) return null;

    try {
      const results = await plugin.readSamples({
        dataType: HEALTH_DATA_TYPES.sleep,
        startDate: dateRange.start.toISOString(),
        endDate: dateRange.end.toISOString(),
        limit: 100,
      });
      if (results.samples.length === 0) return null;
      const minutes = results.samples.reduce((sum, sample) => {
        if (sample.value > 0 && sample.sleepState !== "awake") return sum + sample.value;
        if (sample.sleepState === "awake") return sum;
        const start = new Date(sample.startDate).getTime();
        const end = new Date(sample.endDate).getTime();
        return sum + Math.max(0, Math.round((end - start) / 60000));
      }, 0);
      return Math.round(minutes);
    } catch {
      return null;
    }
  },

  async getWorkouts(dateRange: { start: Date; end: Date }): Promise<WorkoutData[]> {
    const plugin = await getPlugin();
    if (!plugin) return [];

    try {
      const result = await plugin.queryWorkouts({
        startDate: dateRange.start.toISOString(),
        endDate: dateRange.end.toISOString(),
        limit: 100,
        ascending: true,
      });
      return result.workouts.map((w) => ({
        id: `healthkit-${w.platformId ?? `${w.workoutType}-${w.startDate}`}`,
        type: w.workoutType,
        startTime: w.startDate,
        endTime: w.endDate,
        calories: Math.round(w.totalEnergyBurned ?? 0),
        duration: Math.round(w.duration / 60),
        source: "apple_health" as const,
      }));
    } catch {
      return [];
    }
  },

  async getHealthData(dateRange: { start: Date; end: Date }): Promise<{
    steps?: number;
    heartRate?: number;
    restingHeartRate?: number;
    hrv?: number;
    activeEnergy?: number;
    sleepMinutes?: number;
    workouts?: WorkoutData[];
    respiratoryRate?: number;
    spo2?: number;
    date: string;
  } | null> {
    const plugin = await getPlugin();
    if (!plugin) return null;

    try {
      const [steps, heartRate, restingHeartRate, hrv, activeEnergy, sleepMinutes, workouts, respiratoryRate, spo2] = await Promise.all([
        this.getStepCount(dateRange),
        this.getHeartRate(dateRange),
        this.getQuantityAverage(dateRange, HEALTH_DATA_TYPES.restingHeartRate, "bpm"),
        this.getQuantityAverage(dateRange, HEALTH_DATA_TYPES.hrv, "ms"),
        this.getQuantitySum(dateRange, HEALTH_DATA_TYPES.activeEnergy, "kcal"),
        this.getSleepMinutes(dateRange),
        this.getWorkouts(dateRange),
        this.getQuantityAverage(dateRange, HEALTH_DATA_TYPES.respiratoryRate, "bpm"),
        this.getQuantityAverage(dateRange, HEALTH_DATA_TYPES.spo2, "percent"),
      ]);

      return {
        steps,
        heartRate: heartRate ?? undefined,
        restingHeartRate: restingHeartRate ?? undefined,
        hrv: hrv ?? undefined,
        activeEnergy: activeEnergy || undefined,
        sleepMinutes: sleepMinutes ?? undefined,
        workouts,
        respiratoryRate: respiratoryRate ?? undefined,
        spo2: spo2 ?? undefined,
        date: dateRange.start.toISOString().split("T")[0],
      };
    } catch {
      return null;
    }
  },

  async writeNutritionSample(_data: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    timestamp: Date;
  }): Promise<boolean> {
    const plugin = await getPlugin();
    if (!plugin) {
      console.warn("HealthKit write requires native plugin installation");
      return false;
    }
    try {
      await plugin.saveSample({
        dataType: "calories",
        startDate: _data.timestamp.toISOString(),
        endDate: _data.timestamp.toISOString(),
        unit: "kilocalorie",
        value: _data.calories,
        metadata: {
          source: "nutrio",
          meal: _data.name,
          protein_g: String(_data.protein),
          carbs_g: String(_data.carbs),
          fat_g: String(_data.fat),
        },
      });
      return true;
    } catch {
      return false;
    }
  },
};
