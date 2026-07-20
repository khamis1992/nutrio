import { describe, expect, it } from "vitest";
import type { SyncedHealthData } from "@/lib/healthKit";
import {
  WEARABLE_PROVIDER_PRECEDENCE,
  bloodGlucoseSamplesToWearableSamples,
  getWearableMetricSourcePrecedence,
  normalizeBloodGlucoseToMgDl,
  outdoorImportToWearableSamples,
  sportHubSessionsToWearableSamples,
  syncedHealthDataToSamples,
} from "@/lib/wearable-normalization";

const baseSyncedData = (overrides: Partial<SyncedHealthData> = {}): SyncedHealthData => ({
  steps: 8400,
  heartRate: 72,
  workoutCount: 1,
  activeCalories: 430,
  restingHeartRate: 61,
  hrv: 48,
  sleepMinutes: 450,
  deepSleepMinutes: null,
  remSleepMinutes: null,
  respiratoryRate: 15,
  spo2: 98,
  source: "apple_health",
  syncedAt: "2026-07-19T06:00:00.000Z",
  ...overrides,
});

const range = {
  start: new Date("2026-07-19T00:00:00.000Z"),
  end: new Date("2026-07-20T00:00:00.000Z"),
  metricDate: "2026-07-19",
};

describe("wearable normalization", () => {
  it("builds stable dedupe keys and checksums for replayed daily provider payloads", () => {
    const first = syncedHealthDataToSamples(baseSyncedData(), range);
    const second = syncedHealthDataToSamples(baseSyncedData(), range);

    expect(first.length).toBeGreaterThan(0);
    expect(first.map((sample) => sample.dedupe_key)).toEqual(second.map((sample) => sample.dedupe_key));
    expect(first.map((sample) => sample.checksum)).toEqual(second.map((sample) => sample.checksum));
    expect(new Set(first.map((sample) => sample.dedupe_key)).size).toBe(first.length);
  });

  it("emits only present metrics and ignores disconnected providers", () => {
    const samples = syncedHealthDataToSamples(baseSyncedData({
      steps: null,
      activeCalories: null,
      heartRate: null,
      source: "google_fit",
    }), range);

    expect(samples.map((sample) => sample.metric_type)).not.toContain("steps");
    expect(samples.map((sample) => sample.metric_type)).not.toContain("active_calories");
    expect(samples.every((sample) => sample.provider === "google_fit")).toBe(true);
    expect(syncedHealthDataToSamples(baseSyncedData({ source: "none" }), range)).toEqual([]);
  });

  it("documents Apple and Google source precedence for duplicate daily metrics", () => {
    expect(WEARABLE_PROVIDER_PRECEDENCE.apple_health).toBeGreaterThan(
      WEARABLE_PROVIDER_PRECEDENCE.google_fit,
    );
  });

  it("uses metric-specific precedence for two providers", () => {
    expect(getWearableMetricSourcePrecedence("workouts_count", "sporthub")).toBeGreaterThan(
      getWearableMetricSourcePrecedence("workouts_count", "apple_health"),
    );
    expect(getWearableMetricSourcePrecedence("sleep_minutes", "apple_health")).toBeGreaterThan(
      getWearableMetricSourcePrecedence("sleep_minutes", "google_fit"),
    );
  });

  it("adds ADR provenance to normalized samples", () => {
    const [sample] = syncedHealthDataToSamples(baseSyncedData(), {
      ...range,
      provenance: {
        providerUserId: "provider-user-7",
        sourceTimezone: "Asia/Qatar",
        receivedAt: "2026-07-19T06:01:00.000Z",
      },
    });
    expect(sample).toMatchObject({
      provider_user_id: "provider-user-7",
      source_timezone: "Asia/Qatar",
      received_at: "2026-07-19T06:01:00.000Z",
      quality_state: "accepted",
      ingestion_version: "2",
    });
  });

  it("normalizes completed SportHub sessions and ignores malformed or incomplete sessions", () => {
    const samples = sportHubSessionsToWearableSamples([
      {
        id: "sporthub-1",
        activity_type: "strength",
        venue_name: "West Bay",
        starts_at: "2026-07-19T16:00:00.000Z",
        ends_at: null,
        duration_minutes: 60,
        calories_burned: 420,
        status: "completed",
      },
      {
        id: "sporthub-booked",
        activity_type: "yoga",
        venue_name: null,
        starts_at: "not-a-date",
        ends_at: null,
        duration_minutes: 45,
        calories_burned: null,
        status: "booked",
      },
    ], { providerUserId: "sporthub-user", sourceTimezone: "Asia/Qatar" });

    expect(samples.map((sample) => sample.metric_type)).toEqual(["workouts_count", "active_calories"]);
    expect(samples.every((sample) => sample.provider_user_id === "sporthub-user")).toBe(true);
  });

  it("uses source timezone across a DST boundary for GPX, TCX, and FIT imports", () => {
    const samples = outdoorImportToWearableSamples({
      format: "fit",
      externalId: null,
      activityType: "running",
      startedAt: "2026-11-01T05:30:00.000Z",
      endedAt: "2026-11-01T06:30:00.000Z",
      durationSeconds: 3600,
      distanceM: 10000,
      calories: 650,
      calorieSource: "imported_file",
      points: [],
      fingerprint: "dst-fit",
    }, { providerUserId: "import-user", sourceTimezone: "America/New_York" });

    expect(samples).toHaveLength(2);
    expect(samples.every((sample) => sample.metric_date === "2026-11-01")).toBe(true);
    expect(samples[0].external_id).toBe("fit:dst-fit");
  });

  it("normalizes glucose units to mg/dL without aggregating event samples", () => {
    expect(normalizeBloodGlucoseToMgDl(100, "mg/dL")).toBe(100);
    expect(normalizeBloodGlucoseToMgDl(5.5, "mmol/L")).toBeCloseTo(99.1, 1);
    expect(normalizeBloodGlucoseToMgDl(5.5, "unsupported")).toBeNull();

    const samples = bloodGlucoseSamplesToWearableSamples("apple_health", [
      {
        value: 5.5,
        unit: "mmol/L",
        startDate: "2026-07-19T08:00:00.000Z",
        endDate: "2026-07-19T08:00:00.000Z",
        sourceName: "CGM",
        sourceId: "com.example.cgm",
        platformId: "healthkit-record-1",
      },
      {
        value: 6.1,
        unit: "mmol/L",
        startDate: "2026-07-19T08:05:00.000Z",
        endDate: "2026-07-19T08:05:00.000Z",
        sourceName: "CGM",
        sourceId: "com.example.cgm",
        platformId: "healthkit-record-2",
      },
    ]);

    expect(samples).toHaveLength(2);
    expect(samples[0]).toMatchObject({
      metric_type: "blood_glucose",
      value: 99.1,
      unit: "mg/dL",
      external_id: "healthkit-record-1",
      sample_kind: "instant",
      original_value: 5.5,
      original_unit: "mmol/L",
      quality_flags: ["unit_converted"],
    });
    expect(samples[0].dedupe_key).not.toBe(samples[1].dedupe_key);
  });

  it("keeps a stable derived source identity across corrected glucose values", () => {
    const base = {
      value: 110,
      unit: "mg/dL",
      startDate: "2026-07-19T08:00:00.000Z",
      endDate: "2026-07-19T08:00:00.000Z",
      sourceName: "Meter",
      sourceId: "com.example.meter",
    };
    const first = bloodGlucoseSamplesToWearableSamples("apple_health", [base])[0];
    const corrected = bloodGlucoseSamplesToWearableSamples("apple_health", [{ ...base, value: 112 }])[0];

    expect(first.external_id).toBe(corrected.external_id);
    expect(first.dedupe_key).toBe(corrected.dedupe_key);
    expect(first.checksum).not.toBe(corrected.checksum);
  });
});
