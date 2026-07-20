import { supabase } from "@/integrations/supabase/client";
import type { MealRankingRun } from "@/lib/mealRanking";

interface RankingAuditClient {
  rpc(
    fn: "record_meal_ranking_audit",
    args: {
      p_request_id: string;
      p_engine_version: string;
      p_generated_at: string;
      p_input_freshness: Record<string, string>;
      p_exclusions: Array<{ meal_id: string; codes: string[] }>;
      p_ranked: Array<{
        meal_id: string;
        final_score: number;
        component_scores: Record<string, number>;
        explanation_codes: string[];
      }>;
      p_context: {
        candidate_count: number;
        excluded_count: number;
        activity_allowance_applied: number;
        health_context_applied: boolean;
        health_context_codes: string[];
      };
      p_offline: boolean;
    },
  ): Promise<{ data: string | null; error: { code?: string; message?: string } | null }>;
}

const auditClient = supabase as unknown as RankingAuditClient;

export async function recordMealRankingAudit(run: MealRankingRun) {
  if (run.offline) return;
  const { error } = await auditClient.rpc("record_meal_ranking_audit", {
    p_request_id: crypto.randomUUID(),
    p_engine_version: run.engineVersion,
    p_generated_at: run.generatedAt,
    p_input_freshness: run.inputFreshness,
    p_exclusions: run.excluded.map((item) => ({ meal_id: item.mealId, codes: item.codes })),
    p_ranked: run.ranked.slice(0, 50).map((item) => ({
      meal_id: item.id,
      final_score: item.finalScore,
      component_scores: { ...item.componentScores },
      explanation_codes: item.explanationCodes,
    })),
    p_context: {
      candidate_count: run.ranked.length + run.excluded.length,
      excluded_count: run.excluded.length,
      activity_allowance_applied: run.activityAllowanceApplied,
      health_context_applied: run.healthContextApplied,
      health_context_codes: run.healthContextCodes,
    },
    p_offline: false,
  });
  if (error && !["PGRST202", "42883"].includes(error.code ?? "")) {
    console.warn("Unable to record meal ranking audit", error.message);
  }
}
