import { supabase } from "@/integrations/supabase/client";

export async function syncWorkoutSessionsToHealthDailyMetrics(userId: string, metricDate: string) {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("calories_burned")
    .eq("user_id", userId)
    .eq("session_date", metricDate);

  if (error) {
    console.warn("Failed to load workout sessions for health metrics:", error.message);
    return;
  }

  const sessions = data ?? [];
  const activeCalories = sessions.reduce((sum, session) => sum + (session.calories_burned ?? 0), 0);

  const { error: upsertError } = await supabase
    .from("health_daily_metrics" as never)
    .upsert({
      user_id: userId,
      metric_date: metricDate,
      workouts_count: sessions.length,
      active_calories: activeCalories,
      source: "nutrio_activity",
      synced_at: new Date().toISOString(),
    } as never, { onConflict: "user_id,metric_date" });

  if (upsertError) {
    console.warn("Failed to update health daily metrics from workouts:", upsertError.message);
  }
}
