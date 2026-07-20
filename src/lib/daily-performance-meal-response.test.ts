import { describe, expect, it } from "vitest";

import {
  normalizeDailyPerformanceDecision,
  selectPerformanceMeal,
} from "@/lib/daily-performance";

describe("daily performance meal-response orchestration", () => {
  it("normalizes response evidence as context without changing ranked order", () => {
    const decision = normalizeDailyPerformanceDecision({
      id: "decision-1",
      mode: "train",
      meal_calorie_min: 350,
      meal_calorie_max: 650,
      meal_protein_min_g: 30,
      evidence: {
        meal_response: {
          enabled: true,
          applied_to_ranking: true,
          eligible_episode_count: 5,
          evidence_tier: "medium",
          summary: "Lunch responses favored steadier energy.",
        },
      },
    });
    const canonicalRanking = [
      { id: "rank-1", name: "First safe meal", calories: 500, protein_g: 38, meal_type: "lunch" },
      { id: "rank-2", name: "Second safe meal", calories: 480, protein_g: 42, meal_type: "lunch" },
    ];

    expect(decision.meal_response_evidence?.summary).toBe(
      "Lunch responses favored steadier energy.",
    );
    expect(selectPerformanceMeal(canonicalRanking, decision)?.id).toBe("rank-1");
  });
});
