import { describe, expect, it } from "vitest";

import { buildWorkoutSequence } from "@/lib/workout-sequence";

const exercise = (id: string, order: number, sets: number, group: string | null, rest = 60) => ({
  id,
  order_index: order,
  sets,
  superset_group: group,
  rest_seconds: rest,
});

describe("buildWorkoutSequence", () => {
  it("keeps normal exercises set-by-set", () => {
    const steps = buildWorkoutSequence([exercise("a", 0, 2, null)]);
    expect(steps.map((step) => `${step.exercise.id}:${step.setNumber}`)).toEqual(["a:1", "a:2"]);
  });

  it("interleaves superset exercises and rests after each round", () => {
    const steps = buildWorkoutSequence([
      exercise("a", 0, 3, "A", 45),
      exercise("b", 1, 2, "A", 75),
    ]);
    expect(steps.map((step) => `${step.exercise.id}:${step.setNumber}`)).toEqual([
      "a:1", "b:1", "a:2", "b:2", "a:3",
    ]);
    expect(steps.map((step) => step.restAfterSeconds)).toEqual([0, 75, 0, 75, 75]);
  });
});
