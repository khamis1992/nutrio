import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";

import { HttpError } from "./security.ts";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_FIT_AGGREGATE_URL =
  "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate";

export interface GoogleFitCredentials {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
}

export interface GoogleFitWorkout {
  id: string;
  type: string;
  startTime: string;
  endTime: string;
  calories: number;
  duration: number;
  source: "google_fit";
}

const WORKOUT_TYPE_MAP: Record<number, string> = {
  0: "Unknown",
  1: "Running",
  2: "Cycling",
  3: "Walking",
  4: "Hiking",
  5: "Swimming",
  6: "Workout",
  7: "Yoga",
  8: "Pilates",
  9: "Strength Training",
  10: "CrossFit",
  11: "HIIT",
  12: "Dance",
  13: "Sports",
  14: "Winter Sports",
  15: "Water Sports",
  16: "Martial Arts",
  17: "Boxing",
  18: "Rowing",
  19: "Elliptical",
  20: "Stair Climb",
  21: "Sports",
};

type CredentialRow = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_at?: unknown;
};

export async function getGoogleFitCredentials(
  service: SupabaseClient,
  userId: string,
): Promise<GoogleFitCredentials | null> {
  const { data, error } = await service.rpc("get_google_fit_server_credentials", {
    p_user_id: userId,
  });
  if (error) throw new HttpError(503, "integration_storage_unavailable");

  const row = (Array.isArray(data) ? data[0] : data) as CredentialRow | null;
  const accessToken = typeof row?.access_token === "string" ? row.access_token : "";
  const refreshToken = typeof row?.refresh_token === "string" ? row.refresh_token : null;
  const expiresAt = Number(row?.expires_at || 0);
  if (!accessToken || !Number.isFinite(expiresAt)) return null;

  return { accessToken, refreshToken, expiresAt };
}

export async function saveGoogleFitCredentials(
  service: SupabaseClient,
  userId: string,
  credentials: GoogleFitCredentials,
  scope?: string | null,
): Promise<void> {
  const { error } = await service.rpc("upsert_google_fit_server_credentials", {
    p_user_id: userId,
    p_access_token: credentials.accessToken,
    p_refresh_token: credentials.refreshToken,
    p_expires_at: credentials.expiresAt,
    p_scope: scope || null,
  });
  if (error) throw new HttpError(503, "integration_storage_unavailable");
}

export async function refreshGoogleFitCredentials(
  service: SupabaseClient,
  userId: string,
  current?: GoogleFitCredentials | null,
): Promise<GoogleFitCredentials> {
  const credentials = current ?? await getGoogleFitCredentials(service, userId);
  if (!credentials?.refreshToken) throw new HttpError(404, "google_fit_not_connected");

  const clientId = Deno.env.get("GOOGLE_FIT_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_FIT_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new HttpError(503, "google_fit_not_configured");

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: credentials.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    console.error("Google Fit refresh rejected with status", response.status);
    throw new HttpError(502, "google_fit_refresh_failed");
  }

  const data = await response.json() as Record<string, unknown>;
  const accessToken = typeof data.access_token === "string" ? data.access_token : "";
  const expiresIn = Number(data.expires_in || 0);
  if (!accessToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new HttpError(502, "google_fit_invalid_response");
  }

  const refreshed: GoogleFitCredentials = {
    accessToken,
    refreshToken: credentials.refreshToken,
    expiresAt: Math.floor(Date.now() / 1000) + Math.floor(expiresIn),
  };
  await saveGoogleFitCredentials(service, userId, refreshed);
  return refreshed;
}

export async function getValidGoogleFitCredentials(
  service: SupabaseClient,
  userId: string,
): Promise<GoogleFitCredentials> {
  const credentials = await getGoogleFitCredentials(service, userId);
  if (!credentials) throw new HttpError(404, "google_fit_not_connected");
  if (credentials.expiresAt > Math.floor(Date.now() / 1000) + 60) return credentials;
  return await refreshGoogleFitCredentials(service, userId, credentials);
}

type GoogleDataset = {
  dataSourceId?: string;
  point?: Array<{ value?: Array<{ intVal?: number; fpVal?: number }> }>;
};

export async function fetchGoogleFitWorkouts(
  accessToken: string,
  startTime: Date,
  endTime: Date,
): Promise<GoogleFitWorkout[]> {
  const response = await fetch(GOOGLE_FIT_AGGREGATE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      aggregateBy: [
        { dataTypeName: "com.google.activity.segment" },
        { dataTypeName: "com.google.calories.expended" },
        { dataTypeName: "com.google.duration" },
      ],
      startTimeMillis: startTime.getTime(),
      endTimeMillis: endTime.getTime(),
      bucketByActivityType: { activityType: 1 },
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    console.error("Google Fit aggregate rejected with status", response.status);
    throw new HttpError(502, "google_fit_sync_failed");
  }

  const payload = await response.json() as {
    bucket?: Array<{
      startTimeMillis?: string;
      endTimeMillis?: string;
      dataset?: GoogleDataset[];
    }>;
  };

  const workouts: GoogleFitWorkout[] = [];
  for (const bucket of (payload.bucket || []).slice(0, 500)) {
    const datasets = bucket.dataset || [];
    const activityDataset = datasets.find((dataset) => (dataset.point?.length || 0) > 0);
    const activityType = activityDataset?.point?.[0]?.value?.[0]?.intVal ?? 0;
    const durationDataset = datasets.find((dataset) => dataset.dataSourceId?.includes("duration"));
    const calorieDataset = datasets.find((dataset) => dataset.dataSourceId?.includes("calories"));
    const durationMs = durationDataset?.point?.[0]?.value?.[0]?.intVal ?? 0;
    const calories = calorieDataset?.point?.[0]?.value?.[0]?.fpVal ?? 0;
    const startMillis = Number(bucket.startTimeMillis || 0);
    const endMillis = Number(bucket.endTimeMillis || 0);
    if (!startMillis || !endMillis || endMillis <= startMillis) continue;

    workouts.push({
      id: `google-fit-${startMillis}`,
      type: WORKOUT_TYPE_MAP[activityType] || "Workout",
      startTime: new Date(startMillis).toISOString(),
      endTime: new Date(endMillis).toISOString(),
      calories: Math.max(0, Math.min(20_000, Math.round(Number(calories) || 0))),
      duration: Math.max(1, Math.min(1_440, Math.round(durationMs / 60_000))),
      source: "google_fit",
    });
  }

  return workouts;
}
