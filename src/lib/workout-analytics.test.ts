import { describe, expect, it } from "vitest";

import { calculateWorkoutAnalytics, estimateOneRepMax } from "@/lib/workout-analytics";

describe("workout analytics", () => {
  it("calculates volume, effort, estimated strength and rest adherence", () => {
    const summary = calculateWorkoutAnalytics([
      { reps: 10, weight_kg: 50, rpe: 8, rir: 2, target_rest_seconds: 60, actual_rest_seconds: 68 },
      { reps: 8, weight_kg: 60, rpe: 9, rir: 1, target_rest_seconds: 60, actual_rest_seconds: 90 },
    ]);
    expect(summary.totalVolumeKg).toBe(980);
    expect(summary.averageRpe).toBe(8.5);
    expect(summary.averageRir).toBe(1.5);
    expect(summary.restAdherencePct).toBe(50);
    expect(summary.estimatedOneRepMaxKg).toBeCloseTo(76, 1);
  });

  it("returns zero for an invalid one-rep-max input", () => {
    expect(estimateOneRepMax(0, 10)).toBe(0);
  });
});
