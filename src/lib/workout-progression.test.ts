import { describe, expect, it } from "vitest";

import { normalizeProgressionRule, progressionRuleSummary } from "@/lib/workout-progression";

describe("workout progression rules", () => {
  it("normalizes invalid ranges and safety limits", () => {
    const rule = normalizeProgressionRule({
      enabled: true,
      strategy: "double_progression",
      rep_min: 12,
      rep_max: 8,
      rpe_ceiling: 12,
      deload_percent: 2,
    });

    expect(rule.rep_max).toBe(12);
    expect(rule.rpe_ceiling).toBe(10);
    expect(rule.deload_percent).toBe(5);
  });

  it("creates a readable double-progression summary", () => {
    expect(progressionRuleSummary({ enabled: true, rep_min: 8, rep_max: 12, load_increment_kg: 2.5 }))
      .toBe("8-12 reps, then +2.5 kg");
  });
});
