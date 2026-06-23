import { describe, expect, it } from "vitest";
import { calculateCoachComplianceBreakdown } from "@/lib/coach-compliance";

describe("calculateCoachComplianceBreakdown", () => {
  it("counts protein, calorie, and hydration hit days", () => {
    const result = calculateCoachComplianceBreakdown(
      [
        { log_date: "2026-06-17", calories_consumed: 1900, protein_consumed_g: 125 },
        { log_date: "2026-06-18", calories_consumed: 2600, protein_consumed_g: 60 },
        { log_date: "2026-06-19", calories_consumed: 2050, protein_consumed_g: 135 },
      ],
      [
        { log_date: "2026-06-17", glasses: 8 },
        { log_date: "2026-06-18", glasses: 4 },
        { log_date: "2026-06-19", glasses: 9 },
      ],
      { daily_calorie_target: 2000, protein_target_g: 140 },
    );

    expect(result.loggedDays).toBe(3);
    expect(result.calorieHitDays).toBe(2);
    expect(result.proteinHitDays).toBe(2);
    expect(result.hydrationHitDays).toBe(2);
    expect(result.macroHitRate).toBeGreaterThan(65);
  });
});
