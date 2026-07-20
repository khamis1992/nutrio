import { isAndroid, isIOS, isNative } from "@/lib/capacitor";
import {
  fetchAndSaveGoogleFitWorkouts,
  isGoogleFitConnected,
} from "@/lib/google-fit-workout-service";
import type { HealthData, WorkoutData } from "@/lib/health-types";

export type HealthPlatform = "apple_health" | "google_fit" | "web" | "none";

export interface HealthPermissionRequest {
  steps?: boolean;
  calories?: boolean;
  workouts?: boolean;
  sleep?: boolean;
  heartRate?: boolean;
  recovery?: boolean;
}

export interface HealthPermissionResult {
  steps: boolean;
  calories: boolean;
  workouts: boolean;
  sleep: boolean;
  heartRate: boolean;
}

export function detectHealthPlatform(): HealthPlatform {
  if (isNative && isIOS) return "apple_health";
  if (isNative && isAndroid) return "google_fit";
  return "web";
}

export function toLegacyPlatform(platform: HealthPlatform): "ios" | "android" | "web" {
  if (platform === "apple_health") return "ios";
  if (platform === "google_fit") return "android";
  return "web";
}

export async function isHealthAvailable(platform = detectHealthPlatform()): Promise<boolean> {
  if (platform === "apple_health") {
    const { HealthKit } = await import("@/services/health/healthkit");
    return HealthKit.isAvailable();
  }

  if (platform === "google_fit" || platform === "web") {
    const { isAvailable } = await import("@/services/health/googleFit");
    return isAvailable();
  }

  return false;
}

export async function requestHealthPermissions(
  platform: HealthPlatform,
  requested: HealthPermissionRequest
): Promise<HealthPermissionResult | null> {
  if (platform === "apple_health") {
    const { HealthKit } = await import("@/services/health/healthkit");
    const granted = await HealthKit.requestPermissions({
      steps: requested.steps,
      heartRate: requested.heartRate,
      workouts: requested.workouts,
      energy: requested.calories,
      sleep: requested.sleep,
      recovery: requested.recovery,
    });

    if (!granted) return null;

    return {
      steps: !!requested.steps,
      calories: !!requested.calories,
      workouts: !!requested.workouts,
      sleep: !!requested.sleep,
      heartRate: !!requested.heartRate,
    };
  }

  if (platform === "google_fit") {
    const { requestPermissions } = await import("@/services/health/googleFit");
    const granted = await requestPermissions({
      activity: requested.workouts ?? requested.steps ?? false,
      body: requested.calories ?? requested.heartRate ?? requested.sleep ?? requested.recovery ?? false,
      location: false,
    });

    if (!granted) return null;

    return {
      steps: !!granted.activity,
      calories: !!granted.body,
      workouts: !!granted.activity,
      sleep: false,
      heartRate: !!granted.body,
    };
  }

  return null;
}

export async function fetchHealthData(
  userId: string,
  platform: HealthPlatform,
  dateRange: { start: Date; end: Date }
): Promise<HealthData | null> {
  if (platform === "apple_health") {
    const { HealthKit } = await import("@/services/health/healthkit");
    const data = await HealthKit.getHealthData(dateRange);
    if (!data) return null;

    return {
      steps: data.steps,
      caloriesBurned: data.activeEnergy,
      workouts: data.workouts,
      sleepMinutes: data.sleepMinutes,
      heartRate: data.heartRate,
      restingHeartRate: data.restingHeartRate,
      hrv: data.hrv,
      respiratoryRate: data.respiratoryRate,
      spo2: data.spo2,
      date: data.date,
    };
  }

  if (platform === "google_fit") {
    const { getHealthData } = await import("@/services/health/googleFit");
    return getHealthData(dateRange);
  }

  if (!await isGoogleFitConnected()) return null;

  const workouts = await fetchAndSaveGoogleFitWorkouts(userId, dateRange.start, dateRange.end);
  return {
    workouts,
    date: dateRange.start.toISOString().split("T")[0],
  };
}

export async function fetchHealthWorkouts(
  userId: string,
  platform: HealthPlatform,
  startDate: Date,
  endDate: Date
): Promise<WorkoutData[]> {
  if (platform === "apple_health") {
    const { HealthKit } = await import("@/services/health/healthkit");
    return HealthKit.getWorkouts({ start: startDate, end: endDate });
  }

  return fetchAndSaveGoogleFitWorkouts(userId, startDate, endDate);
}

export async function writeMealToHealthService(
  platform: HealthPlatform,
  mealData: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    timestamp: Date;
  }
): Promise<boolean> {
  if (platform === "apple_health") {
    const { HealthKit } = await import("@/services/health/healthkit");
    return HealthKit.writeNutritionSample(mealData);
  }

  if (platform === "google_fit") {
    const { writeNutritionData } = await import("@/services/health/googleFit");
    return writeNutritionData(mealData);
  }

  return false;
}
