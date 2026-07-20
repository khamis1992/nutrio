import type { ExerciseCatalogItem } from "@/lib/exercise-catalog";
import { normalizeProgressionRule, type ProgressionRecommendation } from "@/lib/workout-progression";
import { parseRepTarget, rpeToRir } from "@/lib/workout-set-prescription";

export interface WorkoutSetPrescriptionSource {
  id: string;
  exercise_name: string;
  reps: string;
  rest_seconds: number | null;
  progression_rule?: unknown;
}

export interface WorkoutSetLogInput {
  program_exercise_id: string;
  exercise_name: string;
  set_number: number;
  reps?: number;
  weight_kg?: number;
  rpe?: number;
  rir?: number;
  target_reps_min?: number;
  target_reps_max?: number;
  target_weight_kg?: number;
  target_rpe?: number;
  target_rir?: number;
  target_rest_seconds?: number;
}

export function buildWorkoutSetLogInput(input: {
  enhancementsEnabled: boolean;
  exercise: WorkoutSetPrescriptionSource;
  exerciseName?: string;
  setNumber: number;
  repsInput: string;
  weightInput: string;
  rpeInput: string;
  progression?: ProgressionRecommendation;
  sequenceRestSeconds?: number;
}): WorkoutSetLogInput {
  const actualRpe = Number.parseFloat(input.rpeInput) || undefined;
  const legacyInput: WorkoutSetLogInput = {
    program_exercise_id: input.exercise.id,
    exercise_name: input.exercise.exercise_name,
    set_number: input.setNumber,
    reps: Number.parseInt(input.repsInput, 10) || undefined,
    weight_kg: Number.parseFloat(input.weightInput) || undefined,
    rpe: actualRpe,
  };

  if (!input.enhancementsEnabled) return legacyInput;

  const repTarget = parseRepTarget(input.exercise.reps);
  const progressionRule = normalizeProgressionRule(input.exercise.progression_rule);
  const recommendedReps = input.progression?.recommended_reps ?? null;
  const targetRpe = progressionRule.enabled ? progressionRule.rpe_ceiling : null;

  return {
    ...legacyInput,
    exercise_name: input.exerciseName || input.exercise.exercise_name,
    rir: rpeToRir(actualRpe) ?? undefined,
    target_reps_min: recommendedReps ?? repTarget?.min,
    target_reps_max: recommendedReps ?? repTarget?.max,
    target_weight_kg: input.progression?.recommended_weight_kg ?? undefined,
    target_rpe: targetRpe ?? undefined,
    target_rir: rpeToRir(targetRpe) ?? undefined,
    target_rest_seconds: input.sequenceRestSeconds ?? input.exercise.rest_seconds ?? undefined,
  };
}

export function buildReplacementEventInput(
  exercise: Pick<WorkoutSetPrescriptionSource, "id" | "exercise_name">,
  replacement: ExerciseCatalogItem,
  replacementName: string,
) {
  return {
    program_exercise_id: exercise.id,
    event_type: "replaced" as const,
    original_exercise_name: exercise.exercise_name,
    replacement_exercise_catalog_id: replacement.id,
    replacement_exercise_name: replacementName,
    reason: "Client selected an in-session alternative",
  };
}

export function plateWeightInput(weightKg: number): string {
  return String(weightKg);
}
