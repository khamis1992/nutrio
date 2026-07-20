import type { Json } from "@/integrations/supabase/types";
import { getQatarDay } from "@/lib/dateUtils";
import type { BloodGlucoseSample, SyncedHealthData } from "@/lib/healthKit";
import type { OutdoorActivityImport } from "@/lib/outdoor-activity-import";
import type { SportHubActivitySession } from "@/lib/sporthubIntegration";

export type WearableProviderId =
  | "apple_health"
  | "google_fit"
  | "sporthub"
  | "file_import"
  | "body_scale"
  | "nutrio_activity"
  | "manual";

export type WearableMetricType =
  | "steps"
  | "workouts_count"
  | "active_calories"
  | "average_heart_rate"
  | "resting_heart_rate"
  | "hrv"
  | "sleep_minutes"
  | "deep_sleep_minutes"
  | "rem_sleep_minutes"
  | "respiratory_rate"
  | "spo2"
  | "skin_temperature"
  | "body_weight_kg"
  | "body_fat_percent"
  | "blood_glucose";

export type WearableSyncStatus = "pending" | "synced" | "duplicate" | "error" | "revoked";
export type WearableQualityState = "accepted" | "duplicate" | "invalid" | "stale" | "revoked";

export interface WearableProvenanceContext {
  providerUserId: string;
  sourceTimezone: string;
  receivedAt?: string;
  connectionId?: string | null;
}

export interface WearableMetricSampleInput {
  provider: WearableProviderId;
  provider_user_id: string;
  connection_id?: string | null;
  metric_type: WearableMetricType;
  metric_date: string;
  start_at: string;
  end_at: string;
  value: number;
  unit: string;
  external_id?: string | null;
  dedupe_key: string;
  checksum: string;
  source_app?: string | null;
  device_id?: string | null;
  source_timezone: string;
  received_at: string;
  quality_state: WearableQualityState;
  quality_reason?: string | null;
  ingestion_version: string;
  sync_status: WearableSyncStatus;
  sample_kind?: "instant" | "interval" | "aggregate";
  original_value?: number | null;
  original_unit?: string | null;
  quality_flags?: string[];
  normalizer_version?: string;
  source_record_version?: string | null;
  raw?: Json;
}

export interface WearableProviderAdapter<TPayload> {
  provider: WearableProviderId;
  supports: WearableMetricType[];
  toSamples(payload: TPayload, range: { start: Date; end: Date; metricDate: string }): WearableMetricSampleInput[];
}

export const WEARABLE_PROVIDER_PRECEDENCE: Record<WearableProviderId, number> = {
  body_scale: 100,
  apple_health: 90,
  google_fit: 80,
  sporthub: 70,
  file_import: 50,
  nutrio_activity: 30,
  manual: 20,
};

export const WEARABLE_METRIC_SOURCE_PRECEDENCE: Partial<
  Record<WearableMetricType, Partial<Record<WearableProviderId, number>>>
> = {
  steps: { apple_health: 100, google_fit: 90, file_import: 60, sporthub: 50 },
  workouts_count: { sporthub: 100, file_import: 90, apple_health: 80, google_fit: 70, nutrio_activity: 60 },
  active_calories: { sporthub: 100, file_import: 90, apple_health: 80, google_fit: 70, nutrio_activity: 60 },
  average_heart_rate: { apple_health: 100, google_fit: 90, file_import: 70 },
  resting_heart_rate: { apple_health: 100, google_fit: 90 },
  hrv: { apple_health: 100, google_fit: 90 },
  sleep_minutes: { apple_health: 100, google_fit: 90 },
  deep_sleep_minutes: { apple_health: 100, google_fit: 90 },
  rem_sleep_minutes: { apple_health: 100, google_fit: 90 },
  body_weight_kg: { body_scale: 100, apple_health: 80, google_fit: 70, manual: 60 },
  body_fat_percent: { body_scale: 100, apple_health: 80, google_fit: 70, manual: 60 },
};

export function getWearableMetricSourcePrecedence(
  metricType: WearableMetricType,
  provider: WearableProviderId,
): number {
  return WEARABLE_METRIC_SOURCE_PRECEDENCE[metricType]?.[provider]
    ?? WEARABLE_PROVIDER_PRECEDENCE[provider];
}

const METRIC_UNITS: Record<WearableMetricType, string> = {
  steps: "count",
  workouts_count: "count",
  active_calories: "kcal",
  average_heart_rate: "bpm",
  resting_heart_rate: "bpm",
  hrv: "ms",
  sleep_minutes: "minute",
  deep_sleep_minutes: "minute",
  rem_sleep_minutes: "minute",
  respiratory_rate: "breaths_per_minute",
  spo2: "percent",
  skin_temperature: "celsius",
  body_weight_kg: "kg",
  body_fat_percent: "percent",
  blood_glucose: "mg/dL",
};

const GLUCOSE_MMOL_L_TO_MG_DL = 18.0182;
export const WEARABLE_NORMALIZER_VERSION = "1";
export const WEARABLE_INGESTION_VERSION = "2";

const SYNCED_DATA_METRICS: Array<{
  metricType: WearableMetricType;
  read: (data: SyncedHealthData) => number | null;
}> = [
  { metricType: "steps", read: (data) => data.steps },
  { metricType: "workouts_count", read: (data) => data.workoutCount },
  { metricType: "active_calories", read: (data) => data.activeCalories },
  { metricType: "average_heart_rate", read: (data) => data.heartRate },
  { metricType: "resting_heart_rate", read: (data) => data.restingHeartRate },
  { metricType: "hrv", read: (data) => data.hrv },
  { metricType: "sleep_minutes", read: (data) => data.sleepMinutes },
  { metricType: "deep_sleep_minutes", read: (data) => data.deepSleepMinutes },
  { metricType: "rem_sleep_minutes", read: (data) => data.remSleepMinutes },
  { metricType: "respiratory_rate", read: (data) => data.respiratoryRate },
  { metricType: "spo2", read: (data) => data.spo2 },
];

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
    .join(",")}}`;
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(8, "0");
}

function normalizeFiniteMetric(value: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, value);
}

function normalizedUnitKey(unit: string): string {
  return unit.trim().toLowerCase().replace(/\s+/g, "");
}

function validInstant(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function dateInTimezone(instant: string, timezone: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(instant));
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
  } catch {
    return null;
  }
}

function provenance(context: WearableProvenanceContext) {
  return {
    provider_user_id: context.providerUserId,
    connection_id: context.connectionId ?? null,
    source_timezone: context.sourceTimezone,
    received_at: validInstant(context.receivedAt) ?? new Date().toISOString(),
    quality_state: "accepted" as const,
    quality_reason: null,
    ingestion_version: WEARABLE_INGESTION_VERSION,
  };
}

export function normalizeBloodGlucoseToMgDl(value: number, unit: string): number | null {
  if (!Number.isFinite(value) || value < 0) return null;

  const unitKey = normalizedUnitKey(unit);
  if (["mg/dl", "mgdl", "milligramperdeciliter"].includes(unitKey)) {
    return value;
  }
  if (["mmol/l", "mmoll", "millimoleperliter"].includes(unitKey)) {
    return Math.round(value * GLUCOSE_MMOL_L_TO_MG_DL * 1000) / 1000;
  }
  return null;
}

function sourceRecordIdentity(provider: WearableProviderId, sample: BloodGlucoseSample): {
  externalId: string;
  identityKind: "platform_id" | "derived";
} {
  const platformId = sample.platformId?.trim();
  if (platformId) return { externalId: platformId, identityKind: "platform_id" };

  const identity = stableJson({
    provider,
    dataType: "bloodGlucose",
    sourceId: sample.sourceId?.trim() || null,
    sourceName: sample.sourceName?.trim() || null,
    startDate: sample.startDate,
    endDate: sample.endDate,
  });
  return { externalId: `derived:${hashString(identity)}`, identityKind: "derived" };
}

export function bloodGlucoseSamplesToWearableSamples(
  provider: Extract<WearableProviderId, "apple_health" | "google_fit">,
  samples: BloodGlucoseSample[],
  context: WearableProvenanceContext = {
    providerUserId: provider,
    sourceTimezone: "Asia/Qatar",
  },
): WearableMetricSampleInput[] {
  return samples.flatMap((sample) => {
    const value = normalizeBloodGlucoseToMgDl(sample.value, sample.unit);
    const startAt = new Date(sample.startDate);
    const endAt = new Date(sample.endDate);
    if (
      value === null
      || value < 20
      || value > 600
      || Number.isNaN(startAt.getTime())
      || Number.isNaN(endAt.getTime())
      || endAt < startAt
    ) {
      return [];
    }

    const { externalId, identityKind } = sourceRecordIdentity(provider, sample);
    const metricDate = getQatarDay(startAt);
    const dedupeKey = buildWearableDedupeKey({
      provider,
      metricType: "blood_glucose",
      metricDate,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      externalId,
    });
    const qualityFlags = normalizedUnitKey(sample.unit).startsWith("mmol")
      ? ["unit_converted"]
      : [];
    const sourceRecordVersion = hashString(stableJson({
      value: sample.value,
      unit: sample.unit,
      startDate: sample.startDate,
      endDate: sample.endDate,
      sourceName: sample.sourceName ?? null,
      sourceId: sample.sourceId ?? null,
    }));
    const sampleWithoutChecksum: Omit<WearableMetricSampleInput, "checksum"> = {
      provider,
      ...provenance(context),
      metric_type: "blood_glucose",
      metric_date: metricDate,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      value,
      unit: METRIC_UNITS.blood_glucose,
      external_id: externalId,
      dedupe_key: dedupeKey,
      source_app: sample.sourceName ?? sample.sourceId ?? provider,
      device_id: null,
      sync_status: "synced",
      sample_kind: "instant",
      original_value: sample.value,
      original_unit: sample.unit,
      quality_flags: qualityFlags,
      normalizer_version: WEARABLE_NORMALIZER_VERSION,
      source_record_version: sourceRecordVersion,
      raw: {
        dataType: "bloodGlucose",
        sourceRecordId: externalId,
        sourceRecordIdentity: identityKind,
        sourceId: sample.sourceId ?? null,
        sourceName: sample.sourceName ?? null,
        originalValue: sample.value,
        originalUnit: sample.unit,
        qualityFlags,
        normalizerVersion: WEARABLE_NORMALIZER_VERSION,
        sourceRecordVersion,
      },
    };

    return [{
      ...sampleWithoutChecksum,
      checksum: buildWearableChecksum(sampleWithoutChecksum),
    }];
  });
}

export function buildWearableDedupeKey(input: {
  provider: WearableProviderId;
  metricType: WearableMetricType;
  metricDate: string;
  startAt: string;
  endAt: string;
  externalId?: string | null;
}) {
  const identity = input.externalId?.trim()
    ? input.externalId.trim()
    : `${input.metricDate}:${input.startAt}:${input.endAt}`;

  return [
    "wearable",
    input.provider,
    input.metricType,
    identity,
  ].join(":");
}

export function buildWearableChecksum(input: Omit<WearableMetricSampleInput, "checksum">) {
  return hashString(stableJson({
    provider: input.provider,
    provider_user_id: input.provider_user_id,
    connection_id: input.connection_id ?? null,
    metric_type: input.metric_type,
    metric_date: input.metric_date,
    start_at: input.start_at,
    end_at: input.end_at,
    value: input.value,
    unit: input.unit,
    external_id: input.external_id ?? null,
    source_app: input.source_app ?? null,
    device_id: input.device_id ?? null,
    source_timezone: input.source_timezone,
    quality_state: input.quality_state,
    ingestion_version: input.ingestion_version,
    sample_kind: input.sample_kind ?? null,
    original_value: input.original_value ?? null,
    original_unit: input.original_unit ?? null,
    quality_flags: input.quality_flags ?? [],
    normalizer_version: input.normalizer_version ?? null,
    source_record_version: input.source_record_version ?? null,
    raw: input.raw ?? null,
  }));
}

export function syncedHealthDataToSamples(
  data: SyncedHealthData,
  range: { start: Date; end: Date; metricDate: string; provenance?: WearableProvenanceContext },
): WearableMetricSampleInput[] {
  if (data.source === "none") return [];
  const provider: WearableProviderId = data.source;
  const context = range.provenance ?? {
    providerUserId: provider,
    sourceTimezone: "Asia/Qatar",
    receivedAt: data.syncedAt,
  };

  return SYNCED_DATA_METRICS.flatMap(({ metricType, read }) => {
    const value = normalizeFiniteMetric(read(data));
    if (value === null) return [];

    const startAt = range.start.toISOString();
    const endAt = range.end.toISOString();
    const externalId = `${provider}:${metricType}:${range.metricDate}`;
    const dedupeKey = buildWearableDedupeKey({
      provider,
      metricType,
      metricDate: range.metricDate,
      startAt,
      endAt,
      externalId,
    });
    const sampleWithoutChecksum: Omit<WearableMetricSampleInput, "checksum"> = {
      provider,
      ...provenance(context),
      metric_type: metricType,
      metric_date: range.metricDate,
      start_at: startAt,
      end_at: endAt,
      value,
      unit: METRIC_UNITS[metricType],
      external_id: externalId,
      dedupe_key: dedupeKey,
      source_app: provider,
      device_id: null,
      sync_status: "synced",
      sample_kind: "aggregate",
      normalizer_version: WEARABLE_NORMALIZER_VERSION,
      raw: {
        source: provider,
        syncedAt: data.syncedAt,
        aggregate: true,
      },
    };

    return [{
      ...sampleWithoutChecksum,
      checksum: buildWearableChecksum(sampleWithoutChecksum),
    }];
  });
}

function eventSamples(
  provider: Extract<WearableProviderId, "sporthub" | "file_import">,
  externalId: string,
  startAt: string,
  endAt: string,
  calories: number | null,
  context: WearableProvenanceContext,
  raw: Json,
): WearableMetricSampleInput[] {
  const normalizedStart = validInstant(startAt);
  const normalizedEnd = validInstant(endAt);
  const metricDate = normalizedStart && dateInTimezone(normalizedStart, context.sourceTimezone);
  if (!normalizedStart || !normalizedEnd || !metricDate || normalizedEnd < normalizedStart) return [];

  const metrics: Array<[WearableMetricType, number, string]> = [["workouts_count", 1, "count"]];
  if (typeof calories === "number" && Number.isFinite(calories) && calories >= 0) {
    metrics.push(["active_calories", calories, "kcal"]);
  }

  return metrics.map(([metricType, value, unit]) => {
    const dedupeKey = buildWearableDedupeKey({
      provider,
      metricType,
      metricDate,
      startAt: normalizedStart,
      endAt: normalizedEnd,
      externalId,
    });
    const withoutChecksum: Omit<WearableMetricSampleInput, "checksum"> = {
      provider,
      ...provenance(context),
      metric_type: metricType,
      metric_date: metricDate,
      start_at: normalizedStart,
      end_at: normalizedEnd,
      value,
      unit,
      external_id: externalId,
      dedupe_key: dedupeKey,
      source_app: provider,
      sync_status: "synced",
      sample_kind: "interval",
      normalizer_version: WEARABLE_NORMALIZER_VERSION,
      raw,
    };
    return { ...withoutChecksum, checksum: buildWearableChecksum(withoutChecksum) };
  });
}

export function sportHubSessionsToWearableSamples(
  sessions: SportHubActivitySession[],
  context: WearableProvenanceContext,
): WearableMetricSampleInput[] {
  return sessions.flatMap((session) => {
    if (session.status !== "completed") return [];
    const endAt = session.ends_at
      ?? (session.duration_minutes && validInstant(session.starts_at)
        ? new Date(new Date(session.starts_at).getTime() + session.duration_minutes * 60_000).toISOString()
        : session.starts_at);
    return eventSamples(
      "sporthub",
      session.id,
      session.starts_at,
      endAt,
      session.calories_burned,
      context,
      { activityType: session.activity_type, venueName: session.venue_name },
    );
  });
}

export function outdoorImportToWearableSamples(
  activity: OutdoorActivityImport,
  context: WearableProvenanceContext,
): WearableMetricSampleInput[] {
  return eventSamples(
    "file_import",
    activity.externalId ?? `${activity.format}:${activity.fingerprint}`,
    activity.startedAt,
    activity.endedAt,
    activity.calories,
    context,
    {
      format: activity.format,
      activityType: activity.activityType,
      durationSeconds: activity.durationSeconds,
      distanceM: activity.distanceM,
      fingerprint: activity.fingerprint,
    },
  );
}

export const appleHealthDailyAdapter: WearableProviderAdapter<SyncedHealthData> = {
  provider: "apple_health",
  supports: SYNCED_DATA_METRICS.map(({ metricType }) => metricType),
  toSamples: syncedHealthDataToSamples,
};

export const googleFitDailyAdapter: WearableProviderAdapter<SyncedHealthData> = {
  provider: "google_fit",
  supports: SYNCED_DATA_METRICS.map(({ metricType }) => metricType),
  toSamples: syncedHealthDataToSamples,
};
