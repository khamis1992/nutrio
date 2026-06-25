import { supabase } from "@/integrations/supabase/client";

type WorkoutMetricSession = {
  workout_type: string | null;
  duration_minutes: number | null;
  calories_burned: number | null;
};

type ExistingHealthMetric = {
  steps: number | null;
  source: string | null;
};

const EXTERNAL_HEALTH_SOURCES = new Set([
  "apple_health",
  "google_fit",
  "healthkit",
  "native_health",
  "mixed",
]);

function isWalkingWorkout(workoutType: string | null) {
  if (!workoutType) return false;
  const normalized = workoutType.toLowerCase();
  return normalized.includes("walk") || normalized.includes("walking") || normalized.includes("المشي");
}

function estimateWalkingSteps(session: WorkoutMetricSession) {
  if (!isWalkingWorkout(session.workout_type)) return 0;

  const workoutType = session.workout_type?.toLowerCase() ?? "";
  const minutes = Math.max(0, session.duration_minutes ?? 0);
  const stepsPerMinute = workoutType.includes("fast") || workoutType.includes("سريع")
    ? 120
    : workoutType.includes("slow") || workoutType.includes("بطيء")
      ? 80
      : 100;

  return Math.round(minutes * stepsPerMinute);
}

export async function syncWorkoutSessionsToHealthDailyMetrics(userId: string, metricDate: string) {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("workout_type, duration_minutes, calories_burned")
    .eq("user_id", userId)
    .eq("session_date", metricDate);

  if (error) {
    console.warn("Failed to load workout sessions for health metrics:", error.message);
    return;
  }

  const sessions = (data ?? []) as WorkoutMetricSession[];
  const activeCalories = sessions.reduce((sum, session) => sum + (session.calories_burned ?? 0), 0);
  const estimatedWalkingSteps = sessions.reduce((sum, session) => sum + estimateWalkingSteps(session), 0);
  const { data: existingMetric, error: existingMetricError } = await supabase
    .from("health_daily_metrics" as never)
    .select("steps, source")
    .eq("user_id", userId)
    .eq("metric_date", metricDate)
    .maybeSingle();

  if (existingMetricError) {
    console.warn("Failed to load existing health metrics:", existingMetricError.message);
  }

  const existing = existingMetric as ExistingHealthMetric | null;
  const existingSteps = existing?.steps ?? 0;
  const hasExternalSteps = existingSteps > 0 && EXTERNAL_HEALTH_SOURCES.has(existing?.source ?? "");
  const nextSteps = hasExternalSteps ? existingSteps : estimatedWalkingSteps;

  const { error: upsertError } = await supabase
    .from("health_daily_metrics" as never)
    .upsert({
      user_id: userId,
      metric_date: metricDate,
      steps: nextSteps,
      workouts_count: sessions.length,
      active_calories: activeCalories,
      source: hasExternalSteps ? "mixed" : "nutrio_activity",
      synced_at: new Date().toISOString(),
    } as never, { onConflict: "user_id,metric_date" });

  if (upsertError) {
    console.warn("Failed to update health daily metrics from workouts:", upsertError.message);
  }
}
