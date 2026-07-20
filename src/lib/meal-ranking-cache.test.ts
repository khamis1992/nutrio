import { beforeEach, describe, expect, it } from "vitest";

import { loadMealRankingCache, saveMealRankingCache } from "@/lib/meal-ranking-cache";
import { MEAL_RANKING_ENGINE_VERSION, type MealRankingRun } from "@/lib/mealRanking";

const generatedAt = "2026-07-19T09:00:00.000Z";
const run: MealRankingRun = {
  engineVersion: MEAL_RANKING_ENGINE_VERSION,
  generatedAt,
  ranked: [],
  excluded: [],
  inputFreshness: { goals: "fresh", safety: "missing" },
  activityAllowanceApplied: 0,
  healthContextApplied: false,
  healthContextCodes: [],
  remainingNutrition: { calories: 1200, protein: 90, carbs: 120, fat: 40 },
  offline: false,
};

describe("meal ranking cache", () => {
  beforeEach(() => localStorage.clear());

  it("restores a recent result as stale offline data", () => {
    saveMealRankingCache("user-1", run);
    const restored = loadMealRankingCache("user-1", new Date());
    expect(restored?.offline).toBe(true);
    expect(restored?.inputFreshness).toEqual({ goals: "stale", safety: "missing" });
  });

  it("rejects expired results", () => {
    saveMealRankingCache("user-1", run);
    const restored = loadMealRankingCache("user-1", new Date(Date.now() + 25 * 60 * 60 * 1000));
    expect(restored).toBeNull();
  });
});
