import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { AdherenceGoalSummary, AdherenceMetric, AdherenceSummary } from "@/lib/adherence";
import { clampStrength } from "@/lib/adherence";

type RpcResult = { data: unknown; error: { message?: string } | null };
type RpcCall = (fn: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>;

const rpc: RpcCall = (fn, args) =>
  (supabase as unknown as { rpc: RpcCall }).rpc(fn, args);
const metrics: AdherenceMetric[] = ["meal_logging", "activity", "water"];

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeAdherenceSummary(value: unknown): AdherenceSummary {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rows = Array.isArray(source.goals) ? source.goals : [];
  const goals = rows.flatMap((row): AdherenceGoalSummary[] => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>;
    if (!metrics.includes(item.metric as AdherenceMetric)) return [];
    return [{
      id: String(item.id ?? ""),
      metric: item.metric as AdherenceMetric,
      frequency_per_week: Math.min(7, Math.max(1, numberValue(item.frequency_per_week, 1))),
      target_value: Math.max(0, numberValue(item.target_value)),
      completed_days: Math.max(0, numberValue(item.completed_days)),
      remaining_days: Math.max(0, numberValue(item.remaining_days)),
      strength: clampStrength(numberValue(item.strength)),
      reason_code: ["on_track", "strong_history", "building", "getting_started"].includes(String(item.reason_code))
        ? item.reason_code as AdherenceGoalSummary["reason_code"]
        : "getting_started",
    }];
  });

  return {
    week_start: String(source.week_start ?? ""),
    today: String(source.today ?? ""),
    goals,
  };
}

export function useAdherenceGoals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["adherence-goals", user?.id ?? "anonymous"] as const;
  const query = useQuery({
    queryKey,
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    queryFn: async () => {
      const ensured = await rpc("ensure_my_adherence_goals");
      if (ensured.error) throw new Error(ensured.error.message || "Could not prepare adherence goals");
      const summary = await rpc("get_my_adherence_summary");
      if (summary.error) throw new Error(summary.error.message || "Could not load adherence goals");
      return normalizeAdherenceSummary(summary.data);
    },
  });

  const updateGoal = useMutation({
    mutationFn: async (goal: Pick<AdherenceGoalSummary, "metric" | "frequency_per_week" | "target_value">) => {
      const result = await rpc("upsert_my_adherence_goal", {
        p_metric: goal.metric,
        p_frequency_per_week: goal.frequency_per_week,
        p_target_value: goal.target_value,
      });
      if (result.error) throw new Error(result.error.message || "Could not update adherence goal");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, updateGoal };
}
