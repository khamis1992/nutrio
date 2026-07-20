import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

export type ProgressionStrategy = "double_progression" | "linear_load" | "reps_only" | "sets_only" | "rir_based" | "density";

export interface ProgressionRule {
  enabled: boolean;
  strategy: ProgressionStrategy;
  rep_min: number;
  rep_max: number;
  load_increment_kg: number;
  rep_increment: number;
  set_increment: number;
  max_sets: number;
  target_rir: number;
  rest_decrement_seconds: number;
  min_rest_seconds: number;
  rpe_ceiling: number;
  failure_sessions_before_deload: number;
  deload_percent: number;
}

export interface ProgressionRecommendation {
  id: string;
  session_id: string;
  program_exercise_id: string;
  user_id: string;
  outcome: "increase_load" | "increase_reps" | "increase_sets" | "adjust_rest" | "repeat" | "deload";
  previous_weight_kg: number | null;
  recommended_weight_kg: number | null;
  recommended_reps: number | null;
  recommended_sets: number | null;
  recommended_rir: number | null;
  recommended_rest_seconds: number | null;
  reason: string;
  evidence: Json;
  status: "pending" | "accepted" | "dismissed" | "superseded";
  created_at: string;
}

interface ProgressionRecommendationQuery {
  select(columns: string): ProgressionRecommendationQuery;
  eq(column: string, value: string): ProgressionRecommendationQuery;
  in(column: string, values: string[]): ProgressionRecommendationQuery;
  order(column: string, options: { ascending: boolean }): Promise<{
    data: ProgressionRecommendation[] | null;
    error: { message: string } | null;
  }>;
}

const progressionClient = supabase as unknown as {
  from(table: "workout_progression_recommendations"): ProgressionRecommendationQuery;
};

export const DEFAULT_PROGRESSION_RULE: ProgressionRule = {
  enabled: false,
  strategy: "double_progression",
  rep_min: 8,
  rep_max: 12,
  load_increment_kg: 2.5,
  rep_increment: 1,
  set_increment: 1,
  max_sets: 6,
  target_rir: 2,
  rest_decrement_seconds: 15,
  min_rest_seconds: 30,
  rpe_ceiling: 8.5,
  failure_sessions_before_deload: 2,
  deload_percent: 10,
};

const finiteNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function normalizeProgressionRule(value: unknown): ProgressionRule {
  const source = value && typeof value === "object" ? value as Partial<ProgressionRule> : {};
  const repMin = Math.max(1, Math.round(finiteNumber(source.rep_min, DEFAULT_PROGRESSION_RULE.rep_min)));
  const repMax = Math.max(repMin, Math.round(finiteNumber(source.rep_max, DEFAULT_PROGRESSION_RULE.rep_max)));
  const strategy = ["double_progression", "linear_load", "reps_only", "sets_only", "rir_based", "density"].includes(source.strategy || "")
    ? source.strategy as ProgressionStrategy
    : DEFAULT_PROGRESSION_RULE.strategy;

  return {
    enabled: source.enabled === true,
    strategy,
    rep_min: repMin,
    rep_max: repMax,
    load_increment_kg: Math.max(0, finiteNumber(source.load_increment_kg, DEFAULT_PROGRESSION_RULE.load_increment_kg)),
    rep_increment: Math.max(1, Math.round(finiteNumber(source.rep_increment, DEFAULT_PROGRESSION_RULE.rep_increment))),
    set_increment: Math.min(3, Math.max(1, Math.round(finiteNumber(source.set_increment, DEFAULT_PROGRESSION_RULE.set_increment)))),
    max_sets: Math.min(12, Math.max(1, Math.round(finiteNumber(source.max_sets, DEFAULT_PROGRESSION_RULE.max_sets)))),
    target_rir: Math.min(5, Math.max(0, finiteNumber(source.target_rir, DEFAULT_PROGRESSION_RULE.target_rir))),
    rest_decrement_seconds: Math.min(60, Math.max(5, Math.round(finiteNumber(source.rest_decrement_seconds, DEFAULT_PROGRESSION_RULE.rest_decrement_seconds)))),
    min_rest_seconds: Math.min(600, Math.max(0, Math.round(finiteNumber(source.min_rest_seconds, DEFAULT_PROGRESSION_RULE.min_rest_seconds)))),
    rpe_ceiling: Math.min(10, Math.max(6, finiteNumber(source.rpe_ceiling, DEFAULT_PROGRESSION_RULE.rpe_ceiling))),
    failure_sessions_before_deload: Math.min(6, Math.max(1, Math.round(finiteNumber(source.failure_sessions_before_deload, DEFAULT_PROGRESSION_RULE.failure_sessions_before_deload)))),
    deload_percent: Math.min(30, Math.max(5, finiteNumber(source.deload_percent, DEFAULT_PROGRESSION_RULE.deload_percent))),
  };
}

export function progressionRuleSummary(ruleValue: unknown): string {
  const rule = normalizeProgressionRule(ruleValue);
  if (!rule.enabled) return "Manual progression";
  if (rule.strategy === "linear_load") return `+${rule.load_increment_kg} kg after completed sets at RPE <= ${rule.rpe_ceiling}`;
  if (rule.strategy === "reps_only") return `+${rule.rep_increment} rep after reaching ${rule.rep_max} reps`;
  if (rule.strategy === "sets_only") return `+${rule.set_increment} set up to ${rule.max_sets} total sets`;
  if (rule.strategy === "rir_based") return `Increase load after maintaining ${rule.target_rir} RIR`;
  if (rule.strategy === "density") return `-${rule.rest_decrement_seconds}s rest down to ${rule.min_rest_seconds}s`;
  return `${rule.rep_min}-${rule.rep_max} reps, then +${rule.load_increment_kg} kg`;
}

export async function fetchProgressionRecommendations({
  userId,
  exerciseIds,
  sessionId,
}: {
  userId: string;
  exerciseIds: string[];
  sessionId?: string;
}): Promise<Map<string, ProgressionRecommendation>> {
  if (exerciseIds.length === 0) return new Map();

  let query = progressionClient
    .from("workout_progression_recommendations")
    .select("*")
    .eq("user_id", userId)
    .in("program_exercise_id", exerciseIds);

  query = sessionId ? query.eq("session_id", sessionId) : query.eq("status", "pending");
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data || []).reduce((recommendations, recommendation) => {
    if (!recommendations.has(recommendation.program_exercise_id)) {
      recommendations.set(recommendation.program_exercise_id, recommendation);
    }
    return recommendations;
  }, new Map<string, ProgressionRecommendation>());
}
