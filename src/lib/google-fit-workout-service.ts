import { format } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import type { GoogleFitAuth } from "@/services/health/googleFit";
import type { WorkoutData } from "@/lib/health-types";

async function refreshGoogleFitToken(): Promise<GoogleFitAuth | null> {
  try {
    const { data, error } = await supabase.functions.invoke("google-fit-token-refresh", {
      body: {},
    });

    if (error || !data?.success || !data.access_token) {
      console.error("Google Fit token refresh failed:", error?.message ?? data?.error);
      return null;
    }

    return {
      accessToken: data.access_token,
      expiresAt: data.expires_at,
    };
  } catch (error) {
    console.error("Failed to refresh Google Fit token:", error);
    return null;
  }
}

export async function getGoogleFitAuthForUser(userId: string): Promise<GoogleFitAuth | null> {
  const { data } = await supabase
    .from("user_integrations")
    .select("access_token, expires_at")
    .eq("user_id", userId)
    .eq("provider", "google_fit")
    .maybeSingle();

  if (!data?.access_token) return null;

  const expiresAt = data.expires_at * 1000;
  if (expiresAt > Date.now()) {
    return {
      accessToken: data.access_token,
      expiresAt,
    };
  }

  return refreshGoogleFitToken();
}

export async function isGoogleFitConnected(userId: string): Promise<boolean> {
  return !!(await getGoogleFitAuthForUser(userId));
}

async function saveWorkoutSession(userId: string, workout: WorkoutData) {
  const startTime = new Date(workout.startTime);

  const { error } = await supabase.from("workout_sessions").upsert(
    {
      user_id: userId,
      session_date: format(startTime, "yyyy-MM-dd"),
      workout_type: workout.type,
      duration_minutes: workout.duration,
      calories_burned: workout.calories,
      source: workout.source ?? "google_fit",
      created_at: workout.startTime,
    },
    {
      onConflict: "user_id, session_date, workout_type",
    }
  );

  if (error) {
    console.warn("Failed to save Google Fit workout to DB:", error.message);
  }
}

export async function fetchAndSaveGoogleFitWorkouts(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<WorkoutData[]> {
  const auth = await getGoogleFitAuthForUser(userId);
  const { getWorkouts } = await import("@/services/health/googleFit");
  const workouts = await getWorkouts(auth ?? { accessToken: "", expiresAt: 0 }, startDate, endDate);

  await Promise.all(workouts.map((workout) => saveWorkoutSession(userId, workout)));

  return workouts;
}
