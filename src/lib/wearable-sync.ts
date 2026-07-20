import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { BloodGlucoseSample, SyncedHealthData } from "@/lib/healthKit";
import type { OutdoorActivityImport } from "@/lib/outdoor-activity-import";
import type { SportHubActivitySession } from "@/lib/sporthubIntegration";
import {
  bloodGlucoseSamplesToWearableSamples,
  outdoorImportToWearableSamples,
  sportHubSessionsToWearableSamples,
  syncedHealthDataToSamples,
  type WearableMetricSampleInput,
  type WearableProviderId,
} from "@/lib/wearable-normalization";

const GLUCOSE_OVERLAP_MS = 6 * 60 * 60 * 1000;
const GLUCOSE_INITIAL_LOOKBACK_MS = 48 * 60 * 60 * 1000;
const INGEST_BATCH_SIZE = 500;

type WearableIngestResult = {
  ok: boolean;
  inserted_or_updated: number;
  unchanged: number;
  rejected: number;
};

type GlucoseIngestResult = {
  ok: boolean;
  sample_count: number;
  inserted_or_updated: number;
  unchanged: number;
  rejected?: number;
};

export type WearableSyncResult = {
  status: "synced" | "partial" | "failed" | "empty";
  submitted: number;
  accepted: number;
  rejected: number;
  cursorAdvanced: boolean;
  error?: string;
};

export interface WearableSyncCursor {
  bloodGlucose?: {
    highWatermark?: string;
    overlapMs?: number;
    lastWindowStart?: string;
    lastWindowEnd?: string;
    sampleCount?: number;
  };
  dailyAggregate?: {
    highWatermark?: string;
    metricDate?: string;
    sampleCount?: number;
  };
  [key: string]: Json | undefined;
}

export interface WearableIncrementalWindow {
  start: Date;
  end: Date;
  cursor: WearableSyncCursor;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCursor(value: unknown): WearableSyncCursor {
  return isRecord(value) ? value as WearableSyncCursor : {};
}

function isMissingRpcError(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "42883" || /function .* does not exist/i.test(error?.message ?? "");
}

function errorMessage(error: { message?: string } | null | undefined, fallback: string): string {
  return error?.message?.trim() || fallback;
}

async function readSyncCursor(userId: string, provider: WearableProviderId): Promise<WearableSyncCursor> {
  const { data, error } = await supabase
    .from("wearable_sync_sources")
    .select("sync_cursor")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();

  if (error) {
    console.warn("Wearable sync cursor read failed:", error.message);
    return {};
  }
  return parseCursor(data?.sync_cursor);
}

async function updateSyncState(
  provider: WearableProviderId,
  status: "synced" | "error",
  cursor: WearableSyncCursor,
  error: string | null,
): Promise<string | null> {
  const { error: syncStateError } = await supabase.rpc("upsert_wearable_sync_state" as never, {
    p_provider: provider,
    p_status: status,
    p_cursor: cursor as Json,
    p_error_message: error,
  } as never);

  if (!syncStateError) return null;
  if (!isMissingRpcError(syncStateError)) {
    console.warn("Wearable sync state update failed:", syncStateError.message);
  }
  return errorMessage(syncStateError, "Could not persist wearable sync cursor");
}

async function ingestBatch(samples: WearableMetricSampleInput[]): Promise<{
  result: WearableIngestResult | null;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc("ingest_wearable_metric_samples" as never, {
    p_samples: samples as unknown as Json,
  } as never);

  if (error) {
    if (!isMissingRpcError(error)) console.warn("Wearable sample ingest failed:", error.message);
    return { result: null, error: errorMessage(error, "Wearable sample ingest failed") };
  }

  const result = data as unknown as WearableIngestResult | null;
  if (
    !result?.ok
    || !Number.isInteger(result.inserted_or_updated)
    || !Number.isInteger(result.unchanged)
    || !Number.isInteger(result.rejected)
    || result.inserted_or_updated < 0
    || result.unchanged < 0
    || result.rejected < 0
  ) {
    return { result: null, error: "Wearable ingest returned an invalid result" };
  }

  const accounted = result.inserted_or_updated + result.unchanged + result.rejected;
  if (accounted > samples.length) {
    return { result: null, error: "Wearable ingest returned inconsistent sample counts" };
  }
  return {
    result: { ...result, rejected: result.rejected + samples.length - accounted },
    error: null,
  };
}

function deterministicRequestId(samples: WearableMetricSampleInput[]): string {
  const identity = samples.map((sample) => `${sample.dedupe_key}:${sample.checksum}`).join("|");
  const words = [2166136261, 2246822519, 3266489917, 668265263].map((seed) => {
    let hash = seed;
    for (let index = 0; index < identity.length; index += 1) {
      hash ^= identity.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  });
  const hex = words.join("");
  const variant = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function ingestGlucoseBatch(
  provider: Extract<WearableProviderId, "apple_health" | "google_fit">,
  samples: WearableMetricSampleInput[],
): Promise<{ result: WearableIngestResult | null; error: string | null }> {
  const payload = samples.map((sample) => ({
    ...sample,
    value: sample.original_value ?? sample.value,
    unit: sample.original_unit ?? sample.unit,
  }));
  const { data, error } = await supabase.rpc("ingest_meal_response_glucose_samples" as never, {
    p_request_id: deterministicRequestId(samples),
    p_provider: provider === "google_fit" ? "health_connect" : provider,
    p_samples: payload as unknown as Json,
  } as never);

  if (error) {
    console.warn("Blood glucose sample ingest failed:", error.message);
    return { result: null, error: errorMessage(error, "Blood glucose sample ingest failed") };
  }

  const parsed = data as unknown as GlucoseIngestResult | null;
  if (
    !parsed?.ok
    || !Number.isInteger(parsed.sample_count)
    || !Number.isInteger(parsed.inserted_or_updated)
    || !Number.isInteger(parsed.unchanged)
    || parsed.sample_count !== samples.length
    || parsed.inserted_or_updated < 0
    || parsed.unchanged < 0
  ) {
    return { result: null, error: "Blood glucose ingest returned an invalid result" };
  }
  const accepted = parsed.inserted_or_updated + parsed.unchanged;
  const rejected = parsed.rejected ?? parsed.sample_count - accepted;
  if (!Number.isInteger(rejected) || rejected < 0 || accepted + rejected !== samples.length) {
    return { result: null, error: "Blood glucose ingest returned inconsistent sample counts" };
  }

  return {
    result: {
      ok: true,
      inserted_or_updated: parsed.inserted_or_updated,
      unchanged: parsed.unchanged,
      rejected,
    },
    error: null,
  };
}

async function rebuildRecentMealResponsesAfterGlucoseSync(userId: string): Promise<void> {
  const { data: preferences, error: preferenceError } = await supabase
    .from("health_context_preferences")
    .select("meal_response_enabled, glucose_analysis_enabled")
    .eq("user_id", userId)
    .maybeSingle();
  const responsePreferences = preferences as unknown as {
    meal_response_enabled?: boolean;
    glucose_analysis_enabled?: boolean;
  } | null;
  if (preferenceError || !responsePreferences?.meal_response_enabled || !responsePreferences.glucose_analysis_enabled) {
    return;
  }

  const { error } = await supabase.functions.invoke("build-meal-response-episodes", {
    body: { limit: 10 },
  });
  if (error) {
    console.warn("Meal response rebuild after glucose sync was deferred:", error.message);
  }
}

export async function recordWearableSyncFailure(
  userId: string,
  provider: WearableProviderId,
  message: string,
): Promise<void> {
  const cursor = await readSyncCursor(userId, provider);
  await updateSyncState(provider, "error", cursor, message);
}

export async function getBloodGlucoseSyncWindow(
  userId: string,
  provider: Extract<WearableProviderId, "apple_health" | "google_fit">,
  end = new Date(),
): Promise<WearableIncrementalWindow> {
  const cursor = await readSyncCursor(userId, provider);
  const highWatermark = cursor.bloodGlucose?.highWatermark
    ? new Date(cursor.bloodGlucose.highWatermark)
    : null;
  const hasValidHighWatermark = highWatermark
    && !Number.isNaN(highWatermark.getTime())
    && highWatermark <= end;
  const startMs = hasValidHighWatermark
    ? highWatermark.getTime() - GLUCOSE_OVERLAP_MS
    : end.getTime() - GLUCOSE_INITIAL_LOOKBACK_MS;

  return { start: new Date(startMs), end, cursor };
}

export async function syncWearableDailyAggregate(
  userId: string,
  data: SyncedHealthData,
  range: { start: Date; end: Date; metricDate: string },
): Promise<WearableSyncResult> {
  if (data.source === "none") {
    return { status: "empty", submitted: 0, accepted: 0, rejected: 0, cursorAdvanced: false };
  }
  const provider: WearableProviderId = data.source;
  const samples = syncedHealthDataToSamples(data, {
    ...range,
    provenance: {
      providerUserId: userId,
      sourceTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Qatar",
      receivedAt: data.syncedAt,
    },
  });
  if (samples.length === 0) {
    return { status: "empty", submitted: 0, accepted: 0, rejected: 0, cursorAdvanced: false };
  }

  const cursor = await readSyncCursor(userId, provider);
  const { result, error } = await ingestBatch(samples);
  if (!result) {
    await updateSyncState(provider, "error", cursor, error);
    return {
      status: "failed",
      submitted: samples.length,
      accepted: 0,
      rejected: samples.length,
      cursorAdvanced: false,
      error: error ?? undefined,
    };
  }

  const accepted = result.inserted_or_updated + result.unchanged;
  if (result.rejected > 0) {
    const message = `Wearable ingest rejected ${result.rejected} of ${samples.length} daily samples`;
    await updateSyncState(provider, "error", cursor, message);
    return {
      status: accepted > 0 ? "partial" : "failed",
      submitted: samples.length,
      accepted,
      rejected: result.rejected,
      cursorAdvanced: false,
      error: message,
    };
  }

  const nextCursor: WearableSyncCursor = {
    ...cursor,
    dailyAggregate: {
      highWatermark: range.end.toISOString(),
      metricDate: range.metricDate,
      sampleCount: samples.length,
    },
  };
  const stateError = await updateSyncState(provider, "synced", nextCursor, null);
  if (stateError) {
    return {
      status: "partial",
      submitted: samples.length,
      accepted,
      rejected: 0,
      cursorAdvanced: false,
      error: stateError,
    };
  }

  return {
    status: "synced",
    submitted: samples.length,
    accepted,
    rejected: 0,
    cursorAdvanced: true,
  };
}

export async function syncBloodGlucoseSamples(
  userId: string,
  provider: Extract<WearableProviderId, "apple_health" | "google_fit">,
  nativeSamples: BloodGlucoseSample[],
  window: WearableIncrementalWindow,
): Promise<WearableSyncResult> {
  const samples = bloodGlucoseSamplesToWearableSamples(provider, nativeSamples, {
    providerUserId: userId,
    sourceTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Qatar",
    receivedAt: window.end.toISOString(),
  });
  if (samples.length !== nativeSamples.length) {
    const rejected = nativeSamples.length - samples.length;
    const message = `Client normalization rejected ${rejected} blood glucose samples`;
    await updateSyncState(provider, "error", window.cursor, message);
    return {
      status: samples.length > 0 ? "partial" : "failed",
      submitted: nativeSamples.length,
      accepted: 0,
      rejected,
      cursorAdvanced: false,
      error: message,
    };
  }

  let accepted = 0;
  let rejected = 0;
  for (let offset = 0; offset < samples.length; offset += INGEST_BATCH_SIZE) {
    const batch = samples.slice(offset, offset + INGEST_BATCH_SIZE);
    const { result, error } = await ingestGlucoseBatch(provider, batch);
    if (!result) {
      const unprocessed = samples.length - offset;
      rejected += unprocessed;
      await updateSyncState(provider, "error", window.cursor, error);
      return {
        status: accepted > 0 ? "partial" : "failed",
        submitted: samples.length,
        accepted,
        rejected,
        cursorAdvanced: false,
        error: error ?? undefined,
      };
    }
    accepted += result.inserted_or_updated + result.unchanged;
    rejected += result.rejected;
    if (result.rejected > 0) break;
  }

  if (rejected > 0) {
    const message = `Wearable ingest rejected ${rejected} of ${samples.length} blood glucose samples`;
    await updateSyncState(provider, "error", window.cursor, message);
    return {
      status: accepted > 0 ? "partial" : "failed",
      submitted: samples.length,
      accepted,
      rejected,
      cursorAdvanced: false,
      error: message,
    };
  }

  const nextCursor: WearableSyncCursor = {
    ...window.cursor,
    bloodGlucose: {
      highWatermark: window.end.toISOString(),
      overlapMs: GLUCOSE_OVERLAP_MS,
      lastWindowStart: window.start.toISOString(),
      lastWindowEnd: window.end.toISOString(),
      sampleCount: samples.length,
    },
  };
  const stateError = await updateSyncState(provider, "synced", nextCursor, null);
  if (stateError) {
    return {
      status: "partial",
      submitted: samples.length,
      accepted,
      rejected: 0,
      cursorAdvanced: false,
      error: stateError,
    };
  }

  await rebuildRecentMealResponsesAfterGlucoseSync(userId);

  return {
    status: "synced",
    submitted: samples.length,
    accepted,
    rejected: 0,
    cursorAdvanced: true,
  };
}

async function syncEventSamples(
  userId: string,
  provider: Extract<WearableProviderId, "sporthub" | "file_import">,
  samples: WearableMetricSampleInput[],
): Promise<WearableSyncResult> {
  if (samples.length === 0) {
    return { status: "empty", submitted: 0, accepted: 0, rejected: 0, cursorAdvanced: false };
  }
  const cursor = await readSyncCursor(userId, provider);
  const { result, error } = await ingestBatch(samples);
  if (!result) {
    await updateSyncState(provider, "error", cursor, error);
    return {
      status: "failed",
      submitted: samples.length,
      accepted: 0,
      rejected: samples.length,
      cursorAdvanced: false,
      error: error ?? undefined,
    };
  }

  const accepted = result.inserted_or_updated + result.unchanged;
  if (result.rejected > 0) {
    const message = `Wearable ingest rejected ${result.rejected} of ${samples.length} event samples`;
    await updateSyncState(provider, "error", cursor, message);
    return {
      status: accepted > 0 ? "partial" : "failed",
      submitted: samples.length,
      accepted,
      rejected: result.rejected,
      cursorAdvanced: false,
      error: message,
    };
  }

  const nextCursor: WearableSyncCursor = {
    ...cursor,
    eventImport: {
      highWatermark: samples.reduce(
        (latest, sample) => sample.end_at > latest ? sample.end_at : latest,
        samples[0].end_at,
      ),
      sampleCount: samples.length,
    },
  };
  const stateError = await updateSyncState(provider, "synced", nextCursor, null);
  return {
    status: stateError ? "partial" : "synced",
    submitted: samples.length,
    accepted,
    rejected: 0,
    cursorAdvanced: !stateError,
    error: stateError ?? undefined,
  };
}

export async function syncSportHubActivitySessions(
  userId: string,
  providerUserId: string,
  sessions: SportHubActivitySession[],
  sourceTimezone = "Asia/Qatar",
): Promise<WearableSyncResult> {
  const receivedAt = new Date().toISOString();
  return syncEventSamples(userId, "sporthub", sportHubSessionsToWearableSamples(sessions, {
    providerUserId,
    sourceTimezone,
    receivedAt,
  }));
}

export async function syncHistoricalActivityImport(
  userId: string,
  activity: OutdoorActivityImport,
  sourceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Qatar",
): Promise<WearableSyncResult> {
  return syncEventSamples(userId, "file_import", outdoorImportToWearableSamples(activity, {
    providerUserId: userId,
    sourceTimezone,
    receivedAt: new Date().toISOString(),
  }));
}
