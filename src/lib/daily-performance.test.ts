import { describe, expect, it } from "vitest";

import {
  mealMatchesPerformanceEnvelope,
  normalizeDailyPerformanceDecision,
  selectPerformanceMeal,
} from "@/lib/daily-performance";

const decision = normalizeDailyPerformanceDecision({
  id: "decision-1",
  user_id: "user-1",
  decision_date: "2026-07-20",
  version: 2,
  mode: "train",
  confidence_score: 82,
  confidence_level: "high",
  meal_calorie_min: 350,
  meal_calorie_max: 620,
  meal_protein_min_g: 30,
  excluded_meal_types: ["snack"],
});

describe("daily performance meal envelope", () => {
  it("preserves the safety-ranked order while applying coach limits", () => {
    const meals = [
      { id: "safe-but-low-protein", name: "A", calories: 450, protein_g: 18, meal_type: "lunch" },
      { id: "first-valid", name: "B", calories: 500, protein_g: 35, meal_type: "lunch" },
      { id: "second-valid", name: "C", calories: 470, protein_g: 40, meal_type: "dinner" },
    ];
    expect(selectPerformanceMeal(meals, decision)?.id).toBe("first-valid");
  });

  it("normalizes snacks and excludes them", () => {
    expect(mealMatchesPerformanceEnvelope(
      { id: "snack", name: "Snack", calories: 400, protein_g: 35, meal_type: "snacks" },
      decision,
    )).toBe(false);
  });

  it("fails closed when no safe candidate fits the envelope", () => {
    expect(selectPerformanceMeal([
      { id: "too-high", name: "High", calories: 800, protein_g: 50, meal_type: "lunch" },
    ], decision)).toBeNull();
  });
});
