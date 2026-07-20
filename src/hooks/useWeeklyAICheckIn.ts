import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface WeeklyCheckInAnswers {
  energy_rating: number;
  hunger_rating: number;
  recovery_rating: number;
  plan_adherence_rating: number;
  weight_kg: number | null;
  notes: string | null;
}

export interface WeeklyCheckInReview {
  id: string;
  week_start: string;
  status: "reviewed" | "applied" | "dismissed" | "stale";
  adjustment_id: string | null;
  current_targets: MacroTargets;
  proposed_targets: MacroTargets;
  review_summary: string;
  confidence: number;
  days_logged: number;
  adherence_rate: number;
  weight_change_kg: number | null;
  recommendation_state: "change" | "maintain" | "hold";
  decision_code: string;
  reason_codes: string[];
  hold_reasons: string[];
  data_quality: {
    label: "low" | "medium" | "high";
    days_logged: number;
    weight_samples: number;
    outliers_removed: number;
    span_days: number;
    prior_window_samples: number;
    recent_window_samples: number;
  };
  weight_trend: {
    method: string;
    window_days: number;
    prior_median_kg: number | null;
    recent_median_kg: number | null;
    change_kg: number | null;
    weekly_rate_kg: number | null;
  };
  safety_context: {
    health_context_date: string | null;
    health_context_codes: string[];
    active_health_program: boolean;
    unresolved_safety_event: boolean;
  };
  algorithm_version: string;
  expires_at: string | null;
  meal_response_evidence: WeeklyMealResponseEvidence;
}

export interface WeeklyMealResponseEvidence {
  enabled: boolean;
  eligible_episode_count: number;
  descriptive_episode_count: number;
  estimate_count: number;
  strongest_evidence_tier: "descriptive" | "early" | "medium" | "strong" | null;
  summary: string | null;
}

type RpcError = { code?: string; message?: string; details?: string; hint?: string };
type RpcResult = { data: unknown; error: RpcError | null };
const callRpc = async (
  name: string,
  args?: Record<string, unknown>,
): Promise<RpcResult> => {
  const rpc = supabase.rpc as unknown as (
    rpcName: string,
    rpcArgs?: Record<string, unknown>,
  ) => Promise<RpcResult>;
  return rpc(name, args);
};

const asObject = (value: unknown): Record<string, unknown> => (
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const asNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asNullableString = (value: unknown) => typeof value === "string" && value.trim()
  ? value.trim()
  : null;

const asStringArray = (value: unknown) => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === "string")
  : [];

const asNullableNumber = (value: unknown) => value === null || value === undefined
  ? null
  : asNumber(value);

export function normalizeWeeklyCheckInReview(value: unknown): WeeklyCheckInReview | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string"
    || typeof row.week_start !== "string"
    || typeof row.review_summary !== "string"
    || !row.current_targets
    || typeof row.current_targets !== "object"
    || !row.proposed_targets
    || typeof row.proposed_targets !== "object") return null;

  const evidence = asObject(
    row.meal_response_evidence
      ?? row.response_evidence_summary
      ?? row.meal_response_evidence_summary,
  );
  const evidenceTier = String(evidence.strongest_evidence_tier ?? evidence.evidence_tier ?? "");
  const dataQuality = asObject(row.data_quality);
  const weightTrend = asObject(row.weight_trend);
  const safetyContext = asObject(row.safety_context);
  const dataQualityLabel = String(dataQuality.label ?? "low");
  const recommendationState = String(row.recommendation_state ?? "maintain");
  const status = String(row.status ?? "reviewed");

  return {
    ...row,
    status: ["reviewed", "applied", "dismissed", "stale"].includes(status)
      ? status as WeeklyCheckInReview["status"]
      : "reviewed",
    current_targets: row.current_targets as unknown as MacroTargets,
    proposed_targets: row.proposed_targets as unknown as MacroTargets,
    confidence: asNumber(row.confidence),
    days_logged: asNumber(row.days_logged),
    adherence_rate: asNumber(row.adherence_rate),
    weight_change_kg: row.weight_change_kg === null || row.weight_change_kg === undefined
      ? null
      : asNumber(row.weight_change_kg),
    recommendation_state: ["change", "maintain", "hold"].includes(recommendationState)
      ? recommendationState as WeeklyCheckInReview["recommendation_state"]
      : "maintain",
    decision_code: asNullableString(row.decision_code) ?? "legacy_review",
    reason_codes: asStringArray(row.reason_codes),
    hold_reasons: asStringArray(row.hold_reasons),
    data_quality: {
      label: ["low", "medium", "high"].includes(dataQualityLabel)
        ? dataQualityLabel as WeeklyCheckInReview["data_quality"]["label"]
        : "low",
      days_logged: Math.max(0, asNumber(dataQuality.days_logged ?? row.days_logged)),
      weight_samples: Math.max(0, asNumber(dataQuality.weight_samples)),
      outliers_removed: Math.max(0, asNumber(dataQuality.outliers_removed)),
      span_days: Math.max(0, asNumber(dataQuality.span_days)),
      prior_window_samples: Math.max(0, asNumber(dataQuality.prior_window_samples)),
      recent_window_samples: Math.max(0, asNumber(dataQuality.recent_window_samples)),
    },
    weight_trend: {
      method: asNullableString(weightTrend.method) ?? "legacy_first_last",
      window_days: Math.max(0, asNumber(weightTrend.window_days, 28)),
      prior_median_kg: asNullableNumber(weightTrend.prior_median_kg),
      recent_median_kg: asNullableNumber(weightTrend.recent_median_kg),
      change_kg: asNullableNumber(weightTrend.change_kg ?? row.weight_change_kg),
      weekly_rate_kg: asNullableNumber(weightTrend.weekly_rate_kg),
    },
    safety_context: {
      health_context_date: asNullableString(safetyContext.health_context_date),
      health_context_codes: asStringArray(safetyContext.health_context_codes),
      active_health_program: Boolean(safetyContext.active_health_program),
      unresolved_safety_event: Boolean(safetyContext.unresolved_safety_event),
    },
    algorithm_version: asNullableString(row.algorithm_version) ?? "legacy",
    expires_at: asNullableString(row.expires_at),
    meal_response_evidence: {
      enabled: Boolean(evidence.enabled ?? evidence.meal_response_enabled),
      eligible_episode_count: Math.max(0, asNumber(
        evidence.eligible_episode_count ?? evidence.eligible_episodes,
      )),
      descriptive_episode_count: Math.max(0, asNumber(
        evidence.descriptive_episode_count ?? evidence.descriptive_episodes,
      )),
      estimate_count: Math.max(0, asNumber(
        evidence.estimate_count ?? evidence.published_estimate_count,
      )),
      strongest_evidence_tier: ["descriptive", "early", "medium", "strong"].includes(evidenceTier)
        ? evidenceTier as WeeklyMealResponseEvidence["strongest_evidence_tier"]
        : null,
      summary: asNullableString(evidence.summary),
    },
  } as WeeklyCheckInReview;
}

export function useWeeklyAICheckIn() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [review, setReview] = useState<WeeklyCheckInReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setReview(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await callRpc("get_current_weekly_ai_check_in");
    if (rpcError) {
      console.error("Failed to load weekly AI check-in:", rpcError);
      setError(rpcError.message || "weekly_check_in_load_failed");
    } else {
      setReview(normalizeWeeklyCheckInReview(data));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submit = useCallback(async (answers: WeeklyCheckInAnswers) => {
    if (!user) return null;
    setSubmitting(true);
    setError(null);
    try {
      const { data, error: rpcError } = await callRpc("create_weekly_ai_check_in", {
        p_energy_rating: answers.energy_rating,
        p_hunger_rating: answers.hunger_rating,
        p_recovery_rating: answers.recovery_rating,
        p_plan_adherence_rating: answers.plan_adherence_rating,
        p_weight_kg: answers.weight_kg,
        p_notes: answers.notes,
      });
      if (rpcError) throw rpcError;
      const nextReview = normalizeWeeklyCheckInReview(data);
      if (!nextReview) throw new Error("weekly_check_in_response_invalid");
      setReview(nextReview);
      return nextReview;
    } catch (submitError) {
      const rpcFailure = submitError as RpcError | null;
      const errorCode = rpcFailure?.code || rpcFailure?.message || (submitError instanceof Error ? submitError.message : "weekly_check_in_submit_failed");
      console.error("Failed to submit weekly AI check-in:", errorCode, rpcFailure?.details || rpcFailure?.message || "");
      setError(errorCode);
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [user]);

  const resolve = useCallback(async (decision: "apply" | "dismiss") => {
    if (!review) return false;
    setResolving(true);
    setError(null);
    try {
      const { data, error: rpcError } = await callRpc("resolve_weekly_ai_check_in", {
        p_check_in_id: review.id,
        p_decision: decision,
      });
      if (rpcError) throw rpcError;
      const result = data as { status?: WeeklyCheckInReview["status"]; code?: string } | null;
      const status = result?.status;
      if (status) setReview((current) => current ? { ...current, status } : current);
      if (status === "stale") {
        setError(result?.code ?? "WEEKLY_CHECK_IN_STALE_REFRESH_REQUIRED");
        return false;
      }
      if (decision === "apply" && user?.id) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["profile", user.id] }),
          queryClient.invalidateQueries({ queryKey: ["nutrition-goals", user.id] }),
          queryClient.invalidateQueries({ queryKey: ["daily-performance-decision", user.id] }),
          queryClient.invalidateQueries({ queryKey: ["meal-ranking", user.id] }),
          queryClient.invalidateQueries({ queryKey: ["meal-response-dashboard", user.id] }),
        ]);
      }
      return true;
    } catch (resolveError) {
      console.error("Failed to resolve weekly AI check-in:", resolveError);
      setError(resolveError instanceof Error ? resolveError.message : "weekly_check_in_resolve_failed");
      return false;
    } finally {
      setResolving(false);
    }
  }, [queryClient, review, user?.id]);

  return { review, loading, submitting, resolving, error, submit, resolve, refresh };
}
