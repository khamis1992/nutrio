import { describe, expect, it } from "vitest";

import type { ExerciseCatalogItem } from "@/lib/exercise-catalog";
import {
  calculateDailyTrainingLoad,
  calculateMuscleVolume,
  calculatePlateLoad,
  scoreExerciseSubstitution,
} from "@/lib/strength-training";

const exercise = (overrides: Partial<ExerciseCatalogItem>): ExerciseCatalogItem => ({
  id: "bench",
  name: "barbell bench press",
  category: "strength",
  bodyPart: "chest",
  equipment: "barbell",
  target: "pectorals",
  muscleGroup: "chest",
  secondaryMuscles: ["triceps"],
  instructions: [],
  image: null,
  animationUrl: null,
  attribution: "test",
  ...overrides,
});

describe("strength training intelligence", () => {
  it("builds the closest load from available plate pairs", () => {
    const result = calculatePlateLoad(87.5, 20, [
      { weightKg: 20, count: 1 },
      { weightKg: 10, count: 1 },
      { weightKg: 2.5, count: 1 },
      { weightKg: 1.25, count: 1 },
    ]);

    expect(result.exact).toBe(true);
    expect(result.actualWeightKg).toBe(87.5);
    expect(result.perSide).toEqual([
      { weightKg: 20, count: 1 },
      { weightKg: 10, count: 1 },
      { weightKg: 2.5, count: 1 },
      { weightKg: 1.25, count: 1 },
    ]);
  });

  it("rejects substitutions that change the primary training intent", () => {
    const original = exercise({});
    const safe = exercise({ id: "push-up", name: "push up", equipment: "bodyweight" });
    const unsafe = exercise({ id: "curl", name: "curl", bodyPart: "upper arms", target: "biceps", muscleGroup: "arms" });

    expect(scoreExerciseSubstitution(original, safe)).toBeGreaterThanOrEqual(60);
    expect(scoreExerciseSubstitution(original, unsafe)).toBeNull();
  });

  it("compares prescribed and completed working sets by muscle", () => {
    const result = calculateMuscleVolume(
      [{ id: "a", sets: 4, muscle: "Chest" }, { id: "b", sets: 2, muscle: "Back" }],
      [
        { programExerciseId: "a", completed: true },
        { programExerciseId: "a", completed: true },
        { programExerciseId: "b", completed: false },
      ],
    );

    expect(result[0]).toMatchObject({ muscle: "Chest", prescribedSets: 4, completedSets: 2, completionPct: 50 });
  });

  it("calculates session-RPE load and ignores sessions without effort", () => {
    expect(calculateDailyTrainingLoad([
      { startedAt: "2026-07-19T08:00:00Z", durationSeconds: 3600, perceivedEffort: 7 },
      { startedAt: "2026-07-19T18:00:00Z", durationSeconds: 1800, perceivedEffort: 4 },
      { startedAt: "2026-07-20T08:00:00Z", durationSeconds: 1800, perceivedEffort: null },
    ])).toEqual([{ date: "2026-07-19", load: 540, sessions: 2 }]);
  });
});
