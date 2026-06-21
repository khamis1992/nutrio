import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getLatestAbnormalMarkers, hasBloodWork } from "@/services/blood-work";
import type { BloodMarker } from "@/lib/blood-markers";

export interface BloodWorkSummary {
  hasBloodWork: boolean;
  abnormalMarkers: BloodMarker[];
  loading: boolean;
  criticalCount: number;
  warningCount: number;
  latestTestDate: string | null;
  healthScore: number;
}

export function useBloodWorkSummary(userId: string | undefined): BloodWorkSummary & { refresh: () => void } {
  const [state, setState] = useState<BloodWorkSummary>({
    hasBloodWork: false,
    abnormalMarkers: [],
    loading: true,
    criticalCount: 0,
    warningCount: 0,
    latestTestDate: null,
    healthScore: 0,
  });
  const [, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!userId) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      setState(prev => ({ ...prev, loading: true }));

      const [exists, abnormal] = await Promise.all([
        hasBloodWork(userId),
        getLatestAbnormalMarkers(userId),
      ]);

      const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const { data: latestRecord } = await supabase
        .from("blood_work_records")
        .select("test_date")
        .eq("user_id", userId)
        .gte("test_date", sixMonthsAgo)
        .order("test_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      const criticalCount = abnormal.filter(m => m.status === "critical").length;
      const warningCount = abnormal.filter(m => m.status === "low" || m.status === "high").length;

      const allCount = abnormal.length;
      const weights: Record<string, number> = { normal: 1, low: 0.7, high: 0.7, critical: 0.3 };
      const healthScore = abnormal.length > 0
        ? Math.round(abnormal.reduce((s, m) => s + (weights[m.status] || 0.7), 0) / allCount * 100)
        : exists ? 100 : 0;

      setState({
        hasBloodWork: exists,
        abnormalMarkers: abnormal,
        loading: false,
        criticalCount,
        warningCount,
        latestTestDate: latestRecord?.test_date || null,
        healthScore,
      });
    } catch (err) {
      console.error("Error loading blood work summary:", err);
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
    load();
  }, [load]);

  return { ...state, refresh };
}