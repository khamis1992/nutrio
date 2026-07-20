export interface WorkoutAnalyticsSet {
  reps: number | null;
  weight_kg: number | null;
  rpe: number | null;
  rir?: number | null;
  actual_rest_seconds?: number | null;
  target_rest_seconds?: number | null;
  completed?: boolean;
}

export interface WorkoutAnalyticsSummary {
  completedSets: number;
  totalVolumeKg: number;
  averageRpe: number | null;
  averageRir: number | null;
  estimatedOneRepMaxKg: number | null;
  restAdherencePct: number | null;
}

export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  return weightKg * (1 + reps / 30);
}

export function calculateWorkoutAnalytics(sets: WorkoutAnalyticsSet[]): WorkoutAnalyticsSummary {
  const completed = sets.filter((set) => set.completed !== false);
  const totalVolumeKg = completed.reduce((total, set) => total + (set.weight_kg ?? 0) * (set.reps ?? 0), 0);
  const rpes = completed.flatMap((set) => set.rpe == null ? [] : [set.rpe]);
  const rirs = completed.flatMap((set) => set.rir == null ? [] : [set.rir]);
  const oneRepMaxes = completed.flatMap((set) => set.weight_kg && set.reps
    ? [estimateOneRepMax(set.weight_kg, set.reps)]
    : []);
  const comparableRest = completed.filter((set) => set.actual_rest_seconds != null && set.target_rest_seconds != null);
  const restMatches = comparableRest.filter((set) => Math.abs((set.actual_rest_seconds ?? 0) - (set.target_rest_seconds ?? 0)) <= 15);

  return {
    completedSets: completed.length,
    totalVolumeKg: Math.round(totalVolumeKg),
    averageRpe: rpes.length ? Math.round((rpes.reduce((sum, value) => sum + value, 0) / rpes.length) * 10) / 10 : null,
    averageRir: rirs.length ? Math.round((rirs.reduce((sum, value) => sum + value, 0) / rirs.length) * 10) / 10 : null,
    estimatedOneRepMaxKg: oneRepMaxes.length ? Math.round(Math.max(...oneRepMaxes) * 10) / 10 : null,
    restAdherencePct: comparableRest.length ? Math.round((restMatches.length / comparableRest.length) * 100) : null,
  };
}
