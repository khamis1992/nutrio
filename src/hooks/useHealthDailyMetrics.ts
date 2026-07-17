import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getQatarDay } from "@/lib/dateUtils";
import {
  clearCachedHealthData,
  getCachedHealthData,
  setCachedHealthData,
} from "@/lib/healthKit";
import type { HealthPlatform, SyncedHealthData } from "@/lib/healthKit";
import type { HealthDailyMetrics } from "@/lib/health-readiness";

const todayKey = () => getQatarDay();

const daysBeforeKey = (dateKey: string, days: number) => {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateKey) {
    return dateKey;
  }

  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
};

function fromCachedHealthData(userId: string | undefined, date: string): HealthDailyMetrics | null {
  if (!userId) return null;

  const cached = getCachedHealthData(userId, date);
  if (!cached) return null;

  return {
    user_id: userId,
    metric_date: date,
    steps: cached.steps ?? 0,
    workouts_count: cached.workoutCount ?? 0,
    active_calories: cached.activeCalories ?? 0,
    resting_heart_rate: cached.restingHeartRate ?? null,
    average_heart_rate: cached.heartRate ?? null,
    hrv: cached.hrv ?? null,
    sleep_minutes: cached.sleepMinutes ?? null,
    deep_sleep_minutes: cached.deepSleepMinutes ?? null,
    rem_sleep_minutes: cached.remSleepMinutes ?? null,
    respiratory_rate: cached.respiratoryRate ?? null,
    spo2: cached.spo2 ?? null,
    skin_temperature: null,
    source: cached.source,
    synced_at: cached.syncedAt,
  };
}

function isHealthPlatform(source: string): source is HealthPlatform {
  return source === "apple_health" || source === "google_fit" || source === "none";
}

function isMetricInScope(metric: HealthDailyMetrics, userId: string, date: string): boolean {
  return metric.user_id === userId && metric.metric_date === date;
}

function cacheDailyMetric(userId: string, date: string, metric: HealthDailyMetrics): void {
  if (!isMetricInScope(metric, userId, date) || !isHealthPlatform(metric.source)) return;

  const syncedData: SyncedHealthData = {
    steps: metric.steps,
    heartRate: metric.average_heart_rate,
    workoutCount: metric.workouts_count,
    activeCalories: metric.active_calories,
    restingHeartRate: metric.resting_heart_rate,
    hrv: metric.hrv,
    sleepMinutes: metric.sleep_minutes,
    deepSleepMinutes: metric.deep_sleep_minutes,
    remSleepMinutes: metric.rem_sleep_minutes,
    respiratoryRate: metric.respiratory_rate,
    spo2: metric.spo2,
    source: metric.source,
    syncedAt: metric.synced_at,
  };

  setCachedHealthData(syncedData, userId, metric.metric_date);
}

interface MetricState {
  userId: string | undefined;
  date: string;
  value: HealthDailyMetrics | null;
  loading: boolean;
}

interface RangeState {
  userId: string | undefined;
  date: string;
  rangeDays: number;
  value: HealthDailyMetrics[];
}

export function useHealthDailyMetrics(userId?: string, date = todayKey(), rangeDays = 7) {
  const [metricState, setMetricState] = useState<MetricState>(() => ({
    userId,
    date,
    value: fromCachedHealthData(userId, date),
    loading: Boolean(userId),
  }));
  const [rangeState, setRangeState] = useState<RangeState>(() => ({
    userId,
    date,
    rangeDays,
    value: [],
  }));

  useEffect(() => {
    if (!userId) {
      setMetricState({ userId: undefined, date, value: null, loading: false });
      setRangeState({ userId: undefined, date, rangeDays, value: [] });
      return;
    }

    let cancelled = false;
    const cached = fromCachedHealthData(userId, date);
    const rangeStartDate = daysBeforeKey(date, Math.max(0, Math.floor(rangeDays) - 1));

    setMetricState({ userId, date, value: cached, loading: true });
    setRangeState({ userId, date, rangeDays, value: [] });

    void Promise.resolve(
      supabase
        .from("health_daily_metrics" as never)
        .select("*")
        .eq("user_id", userId)
        .eq("metric_date", date)
        .maybeSingle(),
    )
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn("Health daily metrics unavailable:", error.message);
          setMetricState({ userId, date, value: cached, loading: true });
          return;
        }

        const dailyMetric = data as HealthDailyMetrics | null;
        const scopedMetric = dailyMetric && isMetricInScope(dailyMetric, userId, date)
          ? dailyMetric
          : null;
        if (dailyMetric && !scopedMetric) {
          clearCachedHealthData(userId);
          console.error("Rejected an out-of-scope health metrics response");
          setMetricState({ userId, date, value: null, loading: true });
          return;
        }
        if (scopedMetric) cacheDailyMetric(userId, date, scopedMetric);
        setMetricState({ userId, date, value: scopedMetric ?? cached, loading: true });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        console.warn("Health daily metrics unavailable:", message);
        setMetricState({ userId, date, value: cached, loading: true });
      })
      .finally(() => {
        if (!cancelled) {
          setMetricState((current) => (
            current.userId === userId && current.date === date
              ? { ...current, loading: false }
              : current
          ));
        }
      });

    void Promise.resolve(
      supabase
        .from("health_daily_metrics" as never)
        .select("*")
        .eq("user_id", userId)
        .gte("metric_date", rangeStartDate)
        .lte("metric_date", date)
        .order("metric_date", { ascending: true }),
    )
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn("Health daily metrics range unavailable:", error.message);
          setRangeState({ userId, date, rangeDays, value: [] });
          return;
        }
        const receivedRange = (data as HealthDailyMetrics[] | null) ?? [];
        const containsOutOfScopeMetric = receivedRange.some((metric) => (
          metric.user_id !== userId
          || metric.metric_date < rangeStartDate
          || metric.metric_date > date
        ));
        if (containsOutOfScopeMetric) {
          console.error("Rejected an out-of-scope health metrics range response");
          setRangeState({ userId, date, rangeDays, value: [] });
          return;
        }
        const scopedRange = receivedRange;
        setRangeState({ userId, date, rangeDays, value: scopedRange });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        console.warn("Health daily metrics range unavailable:", message);
        setRangeState({ userId, date, rangeDays, value: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [date, rangeDays, userId]);

  return useMemo(() => {
    const hasCurrentMetricScope = metricState.userId === userId && metricState.date === date;
    const hasCurrentRangeScope = rangeState.userId === userId
      && rangeState.date === date
      && rangeState.rangeDays === rangeDays;

    return {
      metrics: hasCurrentMetricScope ? metricState.value : null,
      rangeMetrics: hasCurrentRangeScope ? rangeState.value : [],
      loading: Boolean(userId) && (!hasCurrentMetricScope || metricState.loading),
    };
  }, [date, metricState, rangeDays, rangeState, userId]);
}
