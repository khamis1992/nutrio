import { describe, expect, it } from "vitest";

import {
  filterExercises,
  formatExerciseLabel,
  getExerciseVideoUrl,
  getExerciseAnimationUrl,
  getExerciseImageUrl,
  getLocalizedExerciseContent,
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

  it("searches aliases and localized names from enriched datasets", () => {
    const enriched: ExerciseCatalogItem = {
      ...exercises[0],
      aliases: ["chest press"],
      translations: {
        ar: { name: "ضغط الصدر", description: "وصف", instructions: ["تعليمات"], aliases: [] },
      },
    };
    expect(filterExercises([enriched], "chest press", "all", "all")).toEqual([enriched]);
    expect(filterExercises([enriched], "ضغط الصدر", "all", "all")).toEqual([enriched]);
    expect(getLocalizedExerciseContent(enriched, "ar").name).toBe("ضغط الصدر");
  });

  it("only returns secure exercise videos", () => {
    const secure = { ...exercises[0], videos: [{ url: "https://wger.de/video.mp4", durationSeconds: 5, width: 720, height: 720, codec: "h264", isMain: true }] };
    const insecure = { ...secure, id: "unavailable", videos: [{ ...secure.videos[0], url: "http://example.com/video.mp4" }] };
    expect(getExerciseVideoUrl(secure)).toBe("https://wger.de/video.mp4");
    expect(getExerciseVideoUrl(insecure)).toBeNull();
  });

  it("uses bundled MP4 demonstrations when the catalog has no remote video", () => {
    expect(getExerciseVideoUrl(exercises[0])).toMatch(
      /^\/(?:nutrio\/)?exercises\/videos\/0001-2gPfomN\.mp4$/,
    );
  });

  it("roots local exercise assets so they work from nested app routes", () => {
    const exercise = {
      ...exercises[0],
      animationUrl: "0001-demo.gif",
    };

    expect(getExerciseImageUrl(exercise)).toMatch(/^\/(?:nutrio\/)?exercises\/images\/0001\.jpg$/);
    expect(getExerciseAnimationUrl(exercise)).toMatch(/^\/(?:nutrio\/)?exercises\/videos\/0001-demo\.gif$/);
  });
});
