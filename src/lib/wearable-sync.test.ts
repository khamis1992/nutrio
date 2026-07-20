import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  rpc: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        maybeSingle: mocks.maybeSingle,
      };
      return query;
    }),
    rpc: mocks.rpc,
    functions: { invoke: mocks.invoke },
  },
}));

import {
  getBloodGlucoseSyncWindow,
  recordWearableSyncFailure,
  syncBloodGlucoseSamples,
  syncSportHubActivitySessions,
} from "@/lib/wearable-sync";

const nativeSample = {
  value: 100,
  unit: "mg/dL",
  startDate: "2026-07-20T10:00:00.000Z",
  endDate: "2026-07-20T10:00:00.000Z",
  platformId: "record-1",
};

describe("wearable incremental sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.invoke.mockResolvedValue({ data: null, error: null });
  });

  it("re-reads a six-hour overlap behind the persisted high-water mark", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { sync_cursor: { bloodGlucose: { highWatermark: "2026-07-20T10:00:00.000Z" } } },
      error: null,
    });

    const window = await getBloodGlucoseSyncWindow(
      "user-1",
      "apple_health",
      new Date("2026-07-20T12:00:00.000Z"),
    );

    expect(window.start.toISOString()).toBe("2026-07-20T04:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-07-20T12:00:00.000Z");
  });

  it("does not advance the cursor when the server partially rejects a batch", async () => {
    const cursor = { bloodGlucose: { highWatermark: "2026-07-20T09:00:00.000Z" } };
    mocks.rpc
      .mockResolvedValueOnce({
        data: { ok: true, sample_count: 2, inserted_or_updated: 1, unchanged: 0, rejected: 1 },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null });

    const result = await syncBloodGlucoseSamples(
      "user-1",
      "apple_health",
      [nativeSample, { ...nativeSample, platformId: "record-2" }],
      {
        start: new Date("2026-07-20T03:00:00.000Z"),
        end: new Date("2026-07-20T12:00:00.000Z"),
        cursor,
      },
    );

    expect(result).toMatchObject({ status: "partial", accepted: 1, rejected: 1, cursorAdvanced: false });
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "ingest_meal_response_glucose_samples", expect.objectContaining({
      p_provider: "apple_health",
      p_request_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      p_samples: expect.arrayContaining([expect.objectContaining({ value: 100, unit: "mg/dL" })]),
    }));
    expect(mocks.rpc).toHaveBeenLastCalledWith("upsert_wearable_sync_state", expect.objectContaining({
      p_status: "error",
      p_cursor: cursor,
    }));
  });

  it("advances the cursor after a successfully read empty window", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    const end = new Date("2026-07-20T12:00:00.000Z");

    const result = await syncBloodGlucoseSamples(
      "user-1",
      "apple_health",
      [],
      { start: new Date("2026-07-20T06:00:00.000Z"), end, cursor: {} },
    );

    expect(result).toMatchObject({ status: "synced", submitted: 0, cursorAdvanced: true });
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("upsert_wearable_sync_state", expect.objectContaining({
      p_status: "synced",
      p_cursor: expect.objectContaining({
        bloodGlucose: expect.objectContaining({ highWatermark: end.toISOString() }),
      }),
    }));
  });

  it("rebuilds recent meal responses after an opted-in glucose sync", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { meal_response_enabled: true, glucose_analysis_enabled: true },
      error: null,
    });
    mocks.rpc
      .mockResolvedValueOnce({
        data: { ok: true, sample_count: 1, inserted_or_updated: 1, unchanged: 0, rejected: 0 },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null });

    const result = await syncBloodGlucoseSamples(
      "user-1",
      "apple_health",
      [nativeSample],
      {
        start: new Date("2026-07-20T06:00:00.000Z"),
        end: new Date("2026-07-20T12:00:00.000Z"),
        cursor: {},
      },
    );

    expect(result.status).toBe("synced");
    expect(mocks.invoke).toHaveBeenCalledWith("build-meal-response-episodes", {
      body: { limit: 10 },
    });
  });

  it("records native read failures without erasing the previous cursor", async () => {
    const cursor = {
      bloodGlucose: { highWatermark: "2026-07-20T09:00:00.000Z" },
      dailyAggregate: { metricDate: "2026-07-20" },
    };
    mocks.maybeSingle.mockResolvedValue({ data: { sync_cursor: cursor }, error: null });
    mocks.rpc.mockResolvedValue({ data: null, error: null });

    await recordWearableSyncFailure("user-1", "apple_health", "Native health read failed");

    expect(mocks.rpc).toHaveBeenCalledWith("upsert_wearable_sync_state", expect.objectContaining({
      p_status: "error",
      p_cursor: cursor,
      p_error_message: "Native health read failed",
    }));
  });

  it("feeds completed SportHub sessions through normalized event ingestion", async () => {
    mocks.rpc
      .mockResolvedValueOnce({
        data: { ok: true, inserted_or_updated: 2, unchanged: 0, rejected: 0 },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null });

    const result = await syncSportHubActivitySessions("user-1", "sporthub-user-1", [{
      id: "session-1",
      activity_type: "strength",
      venue_name: "West Bay",
      starts_at: "2026-07-20T15:00:00.000Z",
      ends_at: "2026-07-20T16:00:00.000Z",
      duration_minutes: 60,
      calories_burned: 400,
      status: "completed",
    }]);

    expect(result).toMatchObject({ status: "synced", accepted: 2, cursorAdvanced: true });
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "ingest_wearable_metric_samples", {
      p_samples: expect.arrayContaining([expect.objectContaining({
        provider: "sporthub",
        provider_user_id: "sporthub-user-1",
        source_timezone: "Asia/Qatar",
        quality_state: "accepted",
      })]),
    });
  });
});
