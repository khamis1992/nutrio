import { describe, expect, it } from "vitest";
import { computeNutritionScore } from "@/lib/nutrition-score";

describe("computeNutritionScore", () => {
  it("weights calories/protein/hydration/consistency for the current day", () => {
    // 80*0.38 + 60*0.32 + 100*0.2 + 50*0.1 = 30.4 + 19.2 + 20 + 5 = 74.6 ≈ 75
    expect(
      computeNutritionScore({ caloriePct: 80, proteinPct: 60, hydrationPct: 100, weeklyConsistencyPct: 50 }),
    ).toBe(75);
  });

  it("rebalances weights for past days (no consistency signal)", () => {
    // 80*0.45 + 60*0.35 + 100*0.2 = 36 + 21 + 20 = 77
    expect(computeNutritionScore({ caloriePct: 80, proteinPct: 60, hydrationPct: 100 })).toBe(77);
  });

  it("returns 0 when nothing is logged", () => {
    expect(
      computeNutritionScore({ caloriePct: 0, proteinPct: 0, hydrationPct: 0, weeklyConsistencyPct: 0 }),
    ).toBe(0);
  });

  it("caps at 100 for fully-on-target days", () => {
    expect(
      computeNutritionScore({ caloriePct: 100, proteinPct: 100, hydrationPct: 100, weeklyConsistencyPct: 100 }),
    ).toBe(100);
  });
});
