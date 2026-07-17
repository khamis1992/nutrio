import { describe, expect, it } from "vitest";

import { calculateGoalPlan } from "@/lib/goal-engine";

const baseInput = {
  goalType: "weight_loss" as const,
  currentWeightKg: 90,
  heightCm: 178,
  age: 38,
  gender: "male" as const,
  activityLevel: "moderate" as const,
};

describe("calculateGoalPlan", () => {
  it("moderates calorie deficits and raises fiber when recent metabolic or lipid markers are flagged", () => {
    const baseline = calculateGoalPlan(baseInput);
    const medicalAware = calculateGoalPlan({
      ...baseInput,
      medicalContext: {
        hasRecentBloodWork: true,
        abnormalMarkerCount: 2,
        flaggedCategories: ["metabolic", "lipid"],
        flaggedMarkers: ["Glucose", "LDL"],
      },
    });

    expect(medicalAware.dailyCalorieTarget).toBeGreaterThanOrEqual(baseline.dailyCalorieTarget);
    expect(medicalAware.fiberTargetG).toBeGreaterThanOrEqual(38);
    expect(medicalAware.medicalContextApplied).toBe(true);
    expect(medicalAware.summary).toContain("flagged");
  });

  it("caps protein more conservatively when kidney markers are flagged", () => {
    const baseline = calculateGoalPlan({ ...baseInput, goalType: "muscle_gain" });
    const medicalAware = calculateGoalPlan({
      ...baseInput,
      goalType: "muscle_gain",
      medicalContext: {
        hasRecentBloodWork: true,
        abnormalMarkerCount: 1,
        flaggedCategories: ["kidney"],
        flaggedMarkers: ["Creatinine"],
      },
    });

    expect(medicalAware.proteinTargetG).toBeLessThan(baseline.proteinTargetG);
    expect(medicalAware.medicalContextApplied).toBe(true);
    expect(medicalAware.safetyNote).toContain("Protein target was capped");
  });
});
