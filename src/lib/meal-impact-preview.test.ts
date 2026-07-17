import { describe, expect, it } from "vitest";
import { calculateMealImpact } from "@/lib/meal-impact-preview";

describe("calculateMealImpact", () => {
  it("calculates projected daily macros and remaining targets", () => {
    const result = calculateMealImpact(
      { calories: 900, protein: 60, carbs: 80, fat: 25 },
      { calories: 500, protein: 35, carbs: 50, fat: 20 },
      { calories: 2000, protein: 140, carbs: 220, fat: 70 },
    );

    expect(result.calories).toMatchObject({ projected: 1400, remaining: 600, exceededBy: 0 });
    expect(result.protein).toMatchObject({ projected: 95, remaining: 45, exceededBy: 0 });
  });

  it("reports target overages without negative remaining values", () => {
    const result = calculateMealImpact(
      { calories: 1800, protein: 130, carbs: 190, fat: 65 },
      { calories: 450, protein: 25, carbs: 40, fat: 15 },
      { calories: 2000, protein: 140, carbs: 220, fat: 70 },
    );

    expect(result.calories).toMatchObject({ projected: 2250, remaining: 0, exceededBy: 250 });
    expect(result.fat).toMatchObject({ projected: 80, remaining: 0, exceededBy: 10 });
    expect(result.calories.projectedPercent).toBe(100);
  });
});
