import { supabase } from "@/integrations/supabase/client";
import type { OutdoorActivityImport } from "@/lib/outdoor-activity-import";
import { createOutdoorFingerprint } from "@/lib/outdoor-activity-import";
import type { OutdoorActivityState } from "@/lib/outdoor-activity";
import { estimateOutdoorCalories, getActiveElapsedMs, getAveragePaceSecondsPerKm } from "@/lib/outdoor-activity";

interface CompleteOutdoorActivityResult {
  success: boolean;
  deduplicated: boolean;
  outdoor_session_id: string;
  workout_session_id: string;
}

type OutdoorRpcClient = {
  rpc: (
    name: "complete_outdoor_activity",
    parameters: { p_activity: Record<string, unknown>; p_points: Record<string, unknown>[] },
  ) => Promise<{ data: CompleteOutdoorActivityResult | null; error: { message: string } | null }>;
};

function routePoints(state: OutdoorActivityState) {
  return state.points.map((point) => ({
    latitude: point.latitude,
    longitude: point.longitude,
    accuracy: point.accuracy,
    altitude: point.altitude ?? null,
    speed: point.speed ?? null,
    heading: point.heading ?? null,
    heart_rate: point.heartRate ?? null,
    recorded_at: new Date(point.timestamp).toISOString(),
  }));
}

function calculateHeartRateZones(
  points: Array<{ heartRate?: number | null; timestamp: number }>,
  estimatedMaxHeartRate: number,
) {
  const seconds = [0, 0, 0, 0, 0];
  for (let index = 0; index < points.length - 1; index += 1) {
    const bpm = points[index].heartRate;
    if (!bpm) continue;
    const ratio = bpm / estimatedMaxHeartRate;
    const zone = ratio < 0.6 ? 0 : ratio < 0.7 ? 1 : ratio < 0.8 ? 2 : ratio < 0.9 ? 3 : 4;
    seconds[zone] += Math.min(30, Math.max(0, (points[index + 1].timestamp - points[index].timestamp) / 1000));
  }
  return {
    estimated_max_bpm: estimatedMaxHeartRate,
    zone_1_seconds: Math.round(seconds[0]),
    zone_2_seconds: Math.round(seconds[1]),
    zone_3_seconds: Math.round(seconds[2]),
    zone_4_seconds: Math.round(seconds[3]),
    zone_5_seconds: Math.round(seconds[4]),
  };
}

export async function completeRecordedOutdoorActivity(
  state: OutdoorActivityState,
  weightKg: number,
  age?: number | null,
): Promise<CompleteOutdoorActivityResult> {
  if (!state.startedAt || !state.completedAt || state.points.length < 2) {
    throw new Error("This activity does not have enough route data to save.");
  }
  const elapsedSeconds = Math.max(1, Math.round((state.completedAt - state.startedAt) / 1000));
  const movingSeconds = Math.max(1, Math.round(getActiveElapsedMs(state, state.completedAt) / 1000));
  const fingerprint = createOutdoorFingerprint({
    source: "gps",
    externalId: state.localSessionId,
    startedAt: new Date(state.startedAt).toISOString(),
    durationSeconds: movingSeconds,
    distanceM: state.distanceM,
  });
  const heartRates = state.points.flatMap((point) => point.heartRate == null ? [] : [point.heartRate]);
  const averageHeartRate = heartRates.length
    ? Math.round(heartRates.reduce((sum, value) => sum + value, 0) / heartRates.length)
    : null;
  const heartRateZones = heartRates.length
    ? calculateHeartRateZones(state.points, Math.max(120, 220 - (age ?? 30)))
    : {};

  const { data, error } = await (supabase as unknown as OutdoorRpcClient).rpc("complete_outdoor_activity", {
    p_activity: {
      local_session_id: state.localSessionId,
      source: "gps",
      source_fingerprint: fingerprint,
      activity_type: state.activityType,
      started_at: new Date(state.startedAt).toISOString(),
      ended_at: new Date(state.completedAt).toISOString(),
      duration_seconds: elapsedSeconds,
      moving_seconds: movingSeconds,
      distance_m: Number(state.distanceM.toFixed(2)),
      elevation_gain_m: Number(state.elevationGainM.toFixed(2)),
      average_pace_seconds_per_km: getAveragePaceSecondsPerKm(state, state.completedAt),
      calories_burned: estimateOutdoorCalories(state, weightKg, state.completedAt),
      calorie_source: state.calorieSource,
      average_heart_rate: averageHeartRate,
      max_heart_rate: heartRates.length ? Math.max(...heartRates) : null,
      heart_rate_zones: heartRateZones,
      route_visibility: state.routeVisibility,
      auto_pause_enabled: state.autoPauseEnabled,
      import_format: null,
    },
    p_points: routePoints(state),
  });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error("Nutrio could not save this outdoor activity.");
  return data;
}

export async function saveImportedOutdoorActivity(
  userId: string,
  imported: OutdoorActivityImport,
): Promise<CompleteOutdoorActivityResult> {
  const heartRates = imported.points.flatMap((point) => point.heartRate == null ? [] : [point.heartRate]);
  const heartRateZones = heartRates.length
    ? calculateHeartRateZones(imported.points, 190)
    : {};
  const { data, error } = await (supabase as unknown as OutdoorRpcClient).rpc("complete_outdoor_activity", {
    p_activity: {
      local_session_id: `import-${imported.format}-${imported.fingerprint}`,
      source: `import_${imported.format}`,
      source_fingerprint: imported.fingerprint,
      activity_type: imported.activityType,
      started_at: imported.startedAt,
      ended_at: imported.endedAt,
      duration_seconds: Math.max(1, Math.round(imported.durationSeconds)),
      moving_seconds: Math.max(1, Math.round(imported.durationSeconds)),
      distance_m: Number(imported.distanceM.toFixed(2)),
      elevation_gain_m: 0,
      average_pace_seconds_per_km: imported.distanceM > 0
        ? imported.durationSeconds / (imported.distanceM / 1000)
        : null,
      calories_burned: imported.calories ?? 0,
      calorie_source: imported.calorieSource,
      average_heart_rate: heartRates.length
        ? Math.round(heartRates.reduce((sum, value) => sum + value, 0) / heartRates.length)
        : null,
      max_heart_rate: heartRates.length ? Math.max(...heartRates) : null,
      heart_rate_zones: heartRateZones,
      route_visibility: "private",
      auto_pause_enabled: false,
      import_format: imported.format,
      imported_for_user: userId,
    },
    p_points: imported.points.map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
      accuracy: point.accuracy,
      altitude: point.altitude ?? null,
      speed: point.speed ?? null,
      heading: point.heading ?? null,
      heart_rate: point.heartRate ?? null,
      recorded_at: new Date(point.timestamp).toISOString(),
    })),
  });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error("Nutrio could not import this activity.");
  return data;
}
