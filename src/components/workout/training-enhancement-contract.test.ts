import { describe, expect, it } from "vitest";

import {
  buildReplacementEventInput,
  buildWorkoutSetLogInput,
  plateWeightInput,
} from "@/components/workout/training-enhancement-contract";
import type { ExerciseCatalogItem } from "@/lib/exercise-catalog";
import type { ProgressionRecommendation } from "@/lib/workout-progression";

const exercise = {
  id: "program-exercise-1",
  exercise_name: "Barbell squat",
  reps: "8-12",
  rest_seconds: 90,
  progression_rule: {
    enabled: true,
    strategy: "double_progression",
    rep_min: 8,
    rep_max: 12,
    rpe_ceiling: 8,
  },
};

describe("training enhancement contracts", () => {
  it("preserves the exact legacy set payload while the flag is off", () => {
    expect(buildWorkoutSetLogInput({
      enhancementsEnabled: false,
      exercise,
      exerciseName: "Goblet squat",
      setNumber: 2,
      repsInput: "10",
      weightInput: "60",
      rpeInput: "8",
      progression: { recommended_weight_kg: 62.5 } as ProgressionRecommendation,
      sequenceRestSeconds: 45,
    })).toEqual({
      program_exercise_id: "program-exercise-1",
      exercise_name: "Barbell squat",
      set_number: 2,
      reps: 10,
      weight_kg: 60,
      rpe: 8,
    });
  });

  it("preserves the enhanced prescription after a substitution", () => {
    const payload = buildWorkoutSetLogInput({
      enhancementsEnabled: true,
      exercise,
      exerciseName: "Goblet squat",
      setNumber: 2,
      repsInput: "10",
      weightInput: "32",
      rpeInput: "8",
      progression: {
        recommended_weight_kg: 35,
        recommended_reps: 11,
      } as ProgressionRecommendation,
      sequenceRestSeconds: 45,
    });

    expect(payload).toMatchObject({
      program_exercise_id: "program-exercise-1",
      exercise_name: "Goblet squat",
      target_reps_min: 11,
      target_reps_max: 11,
      target_weight_kg: 35,
      target_rpe: 8,
      target_rir: 2,
      target_rest_seconds: 45,
      rir: 2,
    });
  });

  it("records original and replacement intent without changing the prescribed exercise id", () => {
    const replacement = {
      id: "catalog-goblet-squat",
      name: "Goblet squat",
    } as ExerciseCatalogItem;

    expect(buildReplacementEventInput(exercise, replacement, "Goblet squat")).toEqual({
      program_exercise_id: "program-exercise-1",
      event_type: "replaced",
      original_exercise_name: "Barbell squat",
      replacement_exercise_catalog_id: "catalog-goblet-squat",
      replacement_exercise_name: "Goblet squat",
      reason: "Client selected an in-session alternative",
    });
  });

  it("keeps the plate calculator result lossless for the weight input", () => {
    expect(plateWeightInput(62.5)).toBe("62.5");
  });
});
