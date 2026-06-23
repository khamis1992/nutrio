import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCachedHealthData } from "@/lib/healthKit";
import type { HealthDailyMetrics } from "@/lib/health-readiness";

const todayKey = () => new Date().toISOString().split("T")[0];
const daysAgoKey = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
};

function fromCachedHealthData(): HealthDailyMetrics | null {
  const cached = getCachedHealthData();
  if (!cached) return null;

  return {
    metric_date: todayKey(),
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

export function useHealthDailyMetrics(userId?: string, date = todayKey(), rangeDays = 7) {
  const [metrics, setMetrics] = useState<HealthDailyMetrics | null>(() => fromCachedHealthData());
  const [rangeMetrics, setRangeMetrics] = useState<HealthDailyMetrics[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setMetrics(fromCachedHealthData());
      return;
    }

    let cancelled = false;
    setLoading(true);

    supabase
      .from("health_daily_metrics" as never)
      .select("*")
      .eq("user_id", userId)
      .eq("metric_date", date)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn("Health daily metrics unavailable:", error.message);
          setMetrics(fromCachedHealthData());
          return;
        }
        setMetrics((data as HealthDailyMetrics | null) ?? fromCachedHealthData());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    supabase
      .from("health_daily_metrics" as never)
      .select("*")
      .eq("user_id", userId)
      .gte("metric_date", daysAgoKey(Math.max(0, rangeDays - 1)))
      .lte("metric_date", date)
      .order("metric_date", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn("Health daily metrics range unavailable:", error.message);
          setRangeMetrics([]);
          return;
        }
        setRangeMetrics((data as HealthDailyMetrics[] | null) ?? []);
      });

    return () => {
      cancelled = true;
    };
  }, [date, rangeDays, userId]);

  return useMemo(() => ({ metrics, rangeMetrics, loading }), [metrics, rangeMetrics, loading]);
}
