import { useCallback, useEffect, useState } from "react";
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
  status: "reviewed" | "applied" | "dismissed";
  adjustment_id: string | null;
  current_targets: MacroTargets;
  proposed_targets: MacroTargets;
  review_summary: string;
  confidence: number;
  days_logged: number;
  adherence_rate: number;
  weight_change_kg: number | null;
}

type RpcError = { code?: string; message?: string; details?: string; hint?: string };
type RpcResult = { data: unknown; error: RpcError | null };
const callRpc = supabase.rpc.bind(supabase) as unknown as (
  name: string,
  args?: Record<string, unknown>,
) => Promise<RpcResult>;

function isReview(value: unknown): value is WeeklyCheckInReview {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" &&
    typeof row.week_start === "string" &&
    typeof row.review_summary === "string" &&
    typeof row.current_targets === "object" &&
    typeof row.proposed_targets === "object";
}

export function useWeeklyAICheckIn() {
  const { user } = useAuth();
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
      setReview(isReview(data) ? data : null);
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
      if (!isReview(data)) throw new Error("weekly_check_in_response_invalid");
      setReview(data);
      return data;
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
      const status = (data as { status?: WeeklyCheckInReview["status"] } | null)?.status;
      if (status) setReview((current) => current ? { ...current, status } : current);
      return true;
    } catch (resolveError) {
      console.error("Failed to resolve weekly AI check-in:", resolveError);
      setError(resolveError instanceof Error ? resolveError.message : "weekly_check_in_resolve_failed");
      return false;
    } finally {
      setResolving(false);
    }
  }, [review]);

  return { review, loading, submitting, resolving, error, submit, resolve, refresh };
}
