import { supabase } from "@/integrations/supabase/client";
import type {
  HealthScoreDistributionBucket,
  RetentionAnalyticsSummary,
} from "@/types/retention";

export interface RetentionAnalytics {
  summary: RetentionAnalyticsSummary;
  healthScoreDistribution: HealthScoreDistributionBucket[];
}

export async function fetchRetentionAnalytics(): Promise<RetentionAnalytics> {
  const [rolloversResult, freezesResult, healthScoresResult, bodyMetricsResult] = await Promise.all([
    supabase.from("subscription_rollovers").select("rollover_credits, status"),
    supabase.from("subscription_freezes").select("status"),
    supabase.from("user_health_scores").select("overall_score"),
    supabase.from("body_measurements").select("user_id"),
  ]);

  if (rolloversResult.error) throw rolloversResult.error;
  if (freezesResult.error) throw freezesResult.error;
  if (healthScoresResult.error) throw healthScoresResult.error;
  if (bodyMetricsResult.error) throw bodyMetricsResult.error;

  const rolloverRows = rolloversResult.data || [];
  const freezeRows = freezesResult.data || [];
  const healthRows = healthScoresResult.data || [];
  const bodyRows = bodyMetricsResult.data || [];

  const averageHealthScore = healthRows.length
    ? Math.round(healthRows.reduce((sum, row) => sum + row.overall_score, 0) / healthRows.length)
    : 0;

  return {
    summary: {
      totalRollovers: rolloverRows.length,
      totalRolloverCredits: rolloverRows.reduce((sum, row) => sum + (row.rollover_credits || 0), 0),
      activeFreezes: freezeRows.filter((row) => row.status === "active").length,
      completedFreezes: freezeRows.filter((row) => row.status === "completed").length,
      averageHealthScore,
      usersWithMetrics: new Set(bodyRows.map((row) => row.user_id)).size,
    },
    healthScoreDistribution: [
      { name: "Excellent (80-100%)", value: healthRows.filter((row) => row.overall_score >= 80).length },
      {
        name: "Good (60-79%)",
        value: healthRows.filter((row) => row.overall_score >= 60 && row.overall_score < 80).length,
      },
      {
        name: "Fair (40-59%)",
        value: healthRows.filter((row) => row.overall_score >= 40 && row.overall_score < 60).length,
      },
      { name: "Needs Improvement (<40%)", value: healthRows.filter((row) => row.overall_score < 40).length },
    ],
  };
}
