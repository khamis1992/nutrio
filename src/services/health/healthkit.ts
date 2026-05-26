/**
 * Apple HealthKit Integration Service
 *
 * Provides a Capacitor plugin interface for Apple HealthKit.
 * Since @capacitor-community/health is not yet installed,
 * this defines the full plugin contract with graceful fallbacks.
 */

import { isNative, isIOS } from "@/lib/capacitor";
import { WorkoutData } from "@/hooks/useHealthIntegration";

interface HealthKitPlugin {
  isAvailable(): Promise<{ value: boolean }>;
  requestAuthorization(options: {
    read: string[];
    write: string[];
  }): Promise<{ value: boolean }>;
  querySampleType(options: {
    startDate: string;
    endDate: string;
    sampleType: string;
    unit: string;
    limit?: number;
  }): Promise<{ value: { startDate: string; endDate: string; value: number }[] }>;
  queryWorkouts(options: {
    startDate: string;
    endDate: string;
  }): Promise<{
    value: {
      uuid: string;
      activityType: string;
      startDate: string;
      endDate: string;
      totalEnergyBurned: number;
      totalDistance: number;
      duration: number;
    }[];
  }>;
  saveQuantitySample(options: {
    startDate: string;
    endDate: string;
    sampleType: string;
    unit: string;
    amount: number;
  }): Promise<{ value: boolean }>;
}

async function getPlugin(): Promise<HealthKitPlugin | null> {
  if (!isNative || !isIOS) return null;
  try {
    const { CapacitorHealthKit } = await import("@perfood/capacitor-healthkit");
    // @ts-expect-error - plugin may not have types installed
    return CapacitorHealthKit as HealthKitPlugin;
  } catch {
    return null;
  }
}

const HEALTH_DATA_TYPES = {
  steps: "HKQuantityTypeIdentifierStepCount",
  heartRate: "HKQuantityTypeIdentifierHeartRate",
  activeEnergy: "HKQuantityTypeIdentifierActiveEnergyBurned",
  distanceWalking: "HKQuantityTypeIdentifierDistanceWalkingRunning",
  sleep: "HKCategoryTypeIdentifierSleepAnalysis",
  workout: "HKWorkoutTypeIdentifier",
} as const;

export type HealthKitDataType = keyof typeof HEALTH_DATA_TYPES;

export interface HealthKitPermissionRequest {
  steps?: boolean;
  heartRate?: boolean;
  workouts?: boolean;
  energy?: boolean;
  sleep?: boolean;
}

export const HealthKit = {
  async isAvailable(): Promise<boolean> {
    const plugin = await getPlugin();
    if (!plugin) return false;
    try {
      const result = await plugin.isAvailable();
      return result.value;
    } catch {
      return false;
    }
  },

  async requestPermissions(requested: HealthKitPermissionRequest): Promise<HealthKitPermissionRequest | null> {
    const plugin = await getPlugin();
    if (!plugin) return null;

    const readTypes: string[] = [];
    if (requested.steps) readTypes.push(HEALTH_DATA_TYPES.steps);
    if (requested.heartRate) readTypes.push(HEALTH_DATA_TYPES.heartRate);
    if (requested.energy) readTypes.push(HEALTH_DATA_TYPES.activeEnergy);
    if (requested.workouts) readTypes.push(HEALTH_DATA_TYPES.workout);
    if (requested.sleep) readTypes.push(HEALTH_DATA_TYPES.sleep);

    try {
      const result = await plugin.requestAuthorization({
        read: readTypes,
        write: [],
      });
      if (result.value) return requested;
      return null;
    } catch {
      return null;
    }
  },

  async getStepCount(dateRange: { start: Date; end: Date }): Promise<number> {
    const plugin = await getPlugin();
    if (!plugin) return 0;

    try {
      const results = await plugin.querySampleType({
        startDate: dateRange.start.toISOString(),
        endDate: dateRange.end.toISOString(),
        sampleType: HEALTH_DATA_TYPES.steps,
        unit: "count",
        limit: 1000,
      });
      return results.value.reduce((sum, sample) => sum + sample.value, 0);
    } catch {
      return 0;
    }
  },

  async getHeartRate(dateRange: { start: Date; end: Date }): Promise<number | null> {
    const plugin = await getPlugin();
    if (!plugin) return null;

    try {
      const results = await plugin.querySampleType({
        startDate: dateRange.start.toISOString(),
        endDate: dateRange.end.toISOString(),
        sampleType: HEALTH_DATA_TYPES.heartRate,
        unit: "count/min",
        limit: 100,
      });
      if (results.value.length === 0) return null;
      const avg = results.value.reduce((sum, s) => sum + s.value, 0) / results.value.length;
      return Math.round(avg);
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
      });
      return result.value.map((w) => ({
        id: `healthkit-${w.uuid}`,
        type: w.activityType,
        startTime: w.startDate,
        endTime: w.endDate,
        calories: Math.round(w.totalEnergyBurned || 0),
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
    activeEnergy?: number;
    workouts?: WorkoutData[];
    date: string;
  } | null> {
    const plugin = await getPlugin();
    if (!plugin) return null;

    try {
      const [steps, heartRate, workouts] = await Promise.all([
        this.getStepCount(dateRange),
        this.getHeartRate(dateRange),
        this.getWorkouts(dateRange),
      ]);

      return {
        steps,
        heartRate: heartRate ?? undefined,
        workouts,
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
      await plugin.saveQuantitySample({
        startDate: _data.timestamp.toISOString(),
        endDate: _data.timestamp.toISOString(),
        sampleType: "HKQuantityTypeIdentifierDietaryEnergyConsumed",
        unit: "kcal",
        amount: _data.calories,
      });
      return true;
    } catch {
      return false;
    }
  },
};
