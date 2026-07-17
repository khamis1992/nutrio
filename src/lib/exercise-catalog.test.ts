import { describe, expect, it } from "vitest";

import {
  filterExercises,
  formatExerciseLabel,
  type ExerciseCatalogItem,
} from "@/lib/exercise-catalog";

const exercises: ExerciseCatalogItem[] = [
  {
    id: "0001",
    name: "barbell bench press",
    category: "chest",
    bodyPart: "chest",
    equipment: "barbell",
    target: "pectorals",
    muscleGroup: "chest",
    secondaryMuscles: ["triceps", "shoulders"],
    instructions: ["Lower the bar with control."],
    image: "0001.jpg",
    animationUrl: null,
    attribution: "Gym visual",
  },
  {
    id: "0002",
    name: "bodyweight squat",
    category: "upper legs",
    bodyPart: "upper legs",
    equipment: "body weight",
    target: "quads",
    muscleGroup: "glutes",
    secondaryMuscles: ["hamstrings"],
    instructions: ["Sit the hips back."],
    image: "0002.jpg",
    animationUrl: null,
    attribution: "Gym visual",
  },
];

describe("exercise catalog helpers", () => {
  it("searches names, targets, and supporting muscles", () => {
    expect(filterExercises(exercises, "bench", "all", "all")).toEqual([exercises[0]]);
    expect(filterExercises(exercises, "hamstrings", "all", "all")).toEqual([exercises[1]]);
    expect(filterExercises(exercises, "quads", "all", "all")).toEqual([exercises[1]]);
  });

  it("combines category and equipment filters", () => {
    expect(filterExercises(exercises, "", "chest", "barbell")).toEqual([exercises[0]]);
    expect(filterExercises(exercises, "", "chest", "body weight")).toEqual([]);
  });

  it("formats dataset labels for display", () => {
    expect(formatExerciseLabel("upper legs")).toBe("Upper Legs");
    expect(formatExerciseLabel("3/4 sit-up")).toBe("3/4 Sit-up");
  });
});

