import { describe, expect, it } from "vitest";

import {
  adherenceProgressPercent,
  challengeProgressReason,
  clampStrength,
  type AdherenceGoalSummary,
} from "@/lib/adherence";

const goal: AdherenceGoalSummary = {
  id: "goal-1",
  metric: "activity",
  frequency_per_week: 3,
  target_value: 20,
  completed_days: 2,
  remaining_days: 1,
  strength: 68,
  reason_code: "building",
};

describe("adherence helpers", () => {
  it("clamps strength to a stable percentage", () => {
    expect(clampStrength(104.6)).toBe(100);
    expect(clampStrength(-4)).toBe(0);
    expect(clampStrength(Number.NaN)).toBe(0);
  });

  it("caps weekly progress without changing the flexible target", () => {
    expect(adherenceProgressPercent(goal)).toBe(67);
    expect(adherenceProgressPercent({ ...goal, completed_days: 5 })).toBe(100);
  });

  it("explains challenge progress using privacy-safe verified evidence", () => {
    expect(challengeProgressReason("meals", 2, 5, false)).toContain("verified meal logs");
    expect(challengeProgressReason("activity", 2, 5, true)).toContain("أيام النشاط الموثقة");
    expect(challengeProgressReason("hydration", 9, 5, false)).toContain("0 remaining");
  });
});

