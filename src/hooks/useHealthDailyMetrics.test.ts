import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHealthDailyMetrics } from "@/hooks/useHealthDailyMetrics";
import { supabase } from "@/integrations/supabase/client";
import { getCachedHealthData, setCachedHealthData } from "@/lib/healthKit";
import type { SyncedHealthData } from "@/lib/healthKit";
import type { HealthDailyMetrics } from "@/lib/health-readiness";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

interface QueryResponse<T> {
  data: T;
  error: { message: string } | null;
}

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
}

function createDailyQuery(response: QueryResponse<HealthDailyMetrics | null>) {
  const maybeSingle = vi.fn().mockResolvedValue(response);
  const metricDateEq = vi.fn().mockReturnValue({ maybeSingle });
  const userEq = vi.fn().mockReturnValue({ eq: metricDateEq });
  const select = vi.fn().mockReturnValue({ eq: userEq });

  return { query: { select }, metricDateEq };
}

function createRangeQuery(response: QueryResponse<HealthDailyMetrics[] | null>) {
  const order = vi.fn().mockResolvedValue(response);
  const lte = vi.fn().mockReturnValue({ order });
  const gte = vi.fn().mockReturnValue({ lte });
  const userEq = vi.fn().mockReturnValue({ gte });
  const select = vi.fn().mockReturnValue({ eq: userEq });

  return { query: { select }, gte, lte };
}

function mockQueries(
  dailyResponse: QueryResponse<HealthDailyMetrics | null>,
  rangeResponse: QueryResponse<HealthDailyMetrics[] | null> = { data: [], error: null },
) {
  const daily = createDailyQuery(dailyResponse);
  const range = createRangeQuery(rangeResponse);
  vi.mocked(supabase.from)
    .mockReturnValueOnce(daily.query as never)
    .mockReturnValueOnce(range.query as never);
  return { daily, range };
}

const syncedHealthData = (syncedAt: string, steps = 7400): SyncedHealthData => ({
  steps,
  heartRate: 71,
  workoutCount: 1,
  activeCalories: 390,
  restingHeartRate: 60,
  hrv: 51,
  sleepMinutes: 455,
  deepSleepMinutes: 100,
  remSleepMinutes: 110,
  respiratoryRate: 14,
  spo2: 98,
  source: "apple_health",
  syncedAt,
});

const dailyMetric = (metricDate: string, syncedAt: string, userId = "user-a"): HealthDailyMetrics => ({
  user_id: userId,
  metric_date: metricDate,
  steps: 9200,
  workouts_count: 2,
  active_calories: 520,
  resting_heart_rate: 59,
  average_heart_rate: 70,
  hrv: 54,
  sleep_minutes: 470,
  deep_sleep_minutes: 105,
  rem_sleep_minutes: 115,
  respiratory_rate: 14,
  spo2: 99,
  skin_temperature: null,
  source: "apple_health",
  synced_at: syncedAt,
});

describe("useHealthDailyMetrics", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    vi.mocked(supabase.from).mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses only the requested user's cache when the daily query fails", async () => {
    const cached = syncedHealthData("2026-07-11T21:30:00.000Z");
    setCachedHealthData(cached, "user-a", "2026-07-12");
    mockQueries({ data: null, error: { message: "offline" } });

    const { result } = renderHook(() => useHealthDailyMetrics("user-a", "2026-07-12"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.metrics).toMatchObject({
      metric_date: "2026-07-12",
      steps: cached.steps,
      synced_at: cached.syncedAt,
    });
  });

  it("does not relabel a stale cached record as the requested day", async () => {
    setCachedHealthData(
      syncedHealthData("2026-07-11T08:00:00.000Z"),
      "user-a",
      "2026-07-11",
    );
    mockQueries({ data: null, error: null });

    const { result } = renderHook(() => useHealthDailyMetrics("user-a", "2026-07-12"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.metrics).toBeNull();
  });

  it("masks the previous account's state immediately when the user changes", async () => {
    setCachedHealthData(
      syncedHealthData("2026-07-12T08:00:00.000Z", 12345),
      "user-a",
      "2026-07-12",
    );
    mockQueries({ data: null, error: null });
    mockQueries({ data: null, error: null });

    const { result, rerender } = renderHook(
      ({ userId }) => useHealthDailyMetrics(userId, "2026-07-12"),
      { initialProps: { userId: "user-a" } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.metrics?.steps).toBe(12345);

    rerender({ userId: "user-b" });

    expect(result.current.metrics).toBeNull();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.metrics).toBeNull();
  });

  it("uses Qatar's calendar day for the default date and range", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T21:30:00.000Z"));
    const queries = mockQueries({ data: null, error: null });

    renderHook(() => useHealthDailyMetrics("user-a", undefined, 7));

    expect(queries.daily.metricDateEq).toHaveBeenCalledWith("metric_date", "2026-07-12");
    expect(queries.range.gte).toHaveBeenCalledWith("metric_date", "2026-07-06");
    expect(queries.range.lte).toHaveBeenCalledWith("metric_date", "2026-07-12");

    await act(async () => {
      await Promise.resolve();
    });
  });

  it("caches a database metric only under its queried user and source date", async () => {
    const metric = dailyMetric("2026-07-12", "2026-07-12T08:00:00.000Z");
    mockQueries({ data: metric, error: null });

    const { result } = renderHook(() => useHealthDailyMetrics("user-a", "2026-07-12"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.metrics).toEqual(metric);
    expect(getCachedHealthData("user-a", "2026-07-12")).toMatchObject({
      steps: metric.steps,
      syncedAt: metric.synced_at,
    });
    expect(getCachedHealthData("user-b", "2026-07-12")).toBeNull();
  });

  it("rejects a daily response belonging to another account", async () => {
    const otherUsersMetric = dailyMetric(
      "2026-07-12",
      "2026-07-12T08:00:00.000Z",
      "user-b",
    );
    mockQueries({ data: otherUsersMetric, error: null });

    const { result } = renderHook(() => useHealthDailyMetrics("user-a", "2026-07-12"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.metrics).toBeNull();
    expect(getCachedHealthData("user-a", "2026-07-12")).toBeNull();
  });

  it("returns no cached health data without an authenticated user", () => {
    setCachedHealthData(
      syncedHealthData("2026-07-12T08:00:00.000Z"),
      "user-a",
      "2026-07-12",
    );

    const { result } = renderHook(() => useHealthDailyMetrics(undefined, "2026-07-12"));

    expect(result.current.metrics).toBeNull();
    expect(result.current.rangeMetrics).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
