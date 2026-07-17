import { supabase } from "@/integrations/supabase/client";
import { syncCommunityChallengeProgressQuietly } from "@/lib/community-challenge-service";
import type { WorkoutData } from "@/lib/health-types";

interface GoogleFitSyncResponse {
  connected?: boolean;
  success?: boolean;
  workouts?: WorkoutData[];
}

export async function isGoogleFitConnected(_userId?: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke<GoogleFitSyncResponse>(
    "google-fit-sync",
    { body: { action: "status" } },
  );
  if (error) {
    console.error("Unable to check Google Fit connection status:", error.message);
    return false;
  }
  return data?.connected === true;
}

export async function disconnectGoogleFit(): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke<GoogleFitSyncResponse>(
    "google-fit-sync",
    { body: { action: "disconnect" } },
  );
  if (error) {
    console.error("Unable to disconnect Google Fit:", error.message);
    return false;
  }
  return data?.success === true;
}

export async function fetchAndSaveGoogleFitWorkouts(
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<WorkoutData[]> {
  const { data, error } = await supabase.functions.invoke<GoogleFitSyncResponse>(
    "google-fit-sync",
    {
      body: {
        action: "sync",
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
      },
    },
  );

  if (error) {
    console.error("Google Fit workout sync failed:", error.message);
    return [];
  }

  const workouts = Array.isArray(data?.workouts) ? data.workouts : [];
  await syncCommunityChallengeProgressQuietly(userId);
  return workouts;
}
