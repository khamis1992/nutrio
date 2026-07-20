export interface RepTarget {
  min: number;
  max: number;
}

export function parseRepTarget(value: string): RepTarget | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized || /(?:sec|second|min|minute|hold|time)/.test(normalized)) return null;

  const values = normalized.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (values.length === 0 || values.some((item) => !Number.isFinite(item))) return null;

  const first = Math.max(0, Math.round(values[0]));
  const second = values.length > 1 ? Math.max(0, Math.round(values[1])) : first;
  return { min: Math.min(first, second), max: Math.max(first, second) };
}

export function rpeToRir(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 1 || value > 10) return null;
  return Math.round((10 - value) * 10) / 10;
}

export interface SetTargetComparison {
  reps: number | null;
  weightKg: number | null;
  rpe: number | null;
  targetRepsMin: number | null;
  targetWeightKg: number | null;
  targetRpe: number | null;
}

export function didMeetSetTarget(set: SetTargetComparison): boolean | null {
  const checks: boolean[] = [];
  if (set.targetRepsMin != null) checks.push(set.reps != null && set.reps >= set.targetRepsMin);
  if (set.targetWeightKg != null) checks.push(set.weightKg != null && set.weightKg >= set.targetWeightKg);
  if (set.targetRpe != null) checks.push(set.rpe != null && set.rpe <= set.targetRpe);
  return checks.length > 0 ? checks.every(Boolean) : null;
}
