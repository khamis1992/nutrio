import type { ExerciseCatalogItem } from "@/lib/exercise-catalog";

export interface PlatePair {
  weightKg: number;
  count: number;
}

export interface PlateLoadResult {
  targetWeightKg: number;
  actualWeightKg: number;
  barWeightKg: number;
  differenceKg: number;
  exact: boolean;
  perSide: Array<{ weightKg: number; count: number }>;
}

export interface TrainingVolumeExercise {
  id: string;
  sets: number;
  muscle: string;
}

export interface TrainingVolumeSet {
  programExerciseId: string | null;
  completed: boolean;
}

export interface MuscleVolume {
  muscle: string;
  prescribedSets: number;
  completedSets: number;
  completionPct: number;
}

export interface TrainingLoadSession {
  startedAt: string;
  durationSeconds: number | null;
  perceivedEffort: number | null;
}

export interface DailyTrainingLoad {
  date: string;
  load: number;
  sessions: number;
}

const roundTo = (value: number, precision = 2) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

export function calculatePlateLoad(
  targetWeightKg: number,
  barWeightKg: number,
  availablePairs: PlatePair[],
): PlateLoadResult {
  const safeTarget = Math.max(0, targetWeightKg);
  const safeBar = Math.max(0, barWeightKg);
  const desiredPerSide = Math.max(0, (safeTarget - safeBar) / 2);
  const inventory = availablePairs
    .filter((plate) => plate.weightKg > 0 && plate.count > 0)
    .flatMap((plate) => Array.from({ length: Math.floor(plate.count) }, () => plate.weightKg))
    .sort((a, b) => b - a);

  const scale = 100;
  const desiredUnits = Math.round(desiredPerSide * scale);
  const possibilities = new Map<number, number[]>([[0, []]]);

  inventory.forEach((weight) => {
    const units = Math.round(weight * scale);
    const snapshot = [...possibilities.entries()];
    snapshot.forEach(([sum, selected]) => {
      const next = sum + units;
      if (!possibilities.has(next)) possibilities.set(next, [...selected, weight]);
    });
  });

  const bestUnits = [...possibilities.keys()].sort((a, b) => {
    const distance = Math.abs(a - desiredUnits) - Math.abs(b - desiredUnits);
    return distance !== 0 ? distance : a - b;
  })[0] ?? 0;
  const selected = possibilities.get(bestUnits) ?? [];
  const grouped = [...selected.reduce((groups, weight) => {
    groups.set(weight, (groups.get(weight) ?? 0) + 1);
    return groups;
  }, new Map<number, number>()).entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([weightKg, count]) => ({ weightKg, count }));
  const actualWeightKg = roundTo(safeBar + (bestUnits / scale) * 2);

  return {
    targetWeightKg: safeTarget,
    actualWeightKg,
    barWeightKg: safeBar,
    differenceKg: roundTo(actualWeightKg - safeTarget),
    exact: Math.abs(actualWeightKg - safeTarget) < 0.001,
    perSide: grouped,
  };
}

const normalizedTokens = (exercise: ExerciseCatalogItem) => new Set(
  [exercise.target, exercise.muscleGroup, ...(exercise.primaryMuscles ?? [])]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

export function scoreExerciseSubstitution(
  original: ExerciseCatalogItem,
  candidate: ExerciseCatalogItem,
  availableEquipment: string[] = [],
): number | null {
  if (candidate.id === original.id) return null;
  const originalMuscles = normalizedTokens(original);
  const candidateMuscles = normalizedTokens(candidate);
  const sharedPrimaryIntent = [...originalMuscles].some((muscle) => candidateMuscles.has(muscle));
  if (!sharedPrimaryIntent) return null;

  const originalBodyPart = original.bodyPart.trim().toLowerCase();
  const candidateBodyPart = candidate.bodyPart.trim().toLowerCase();
  const sameBodyPart = Boolean(originalBodyPart) && originalBodyPart === candidateBodyPart;
  const sameCategory = original.category.trim().toLowerCase() === candidate.category.trim().toLowerCase();
  if (!sameBodyPart && !sameCategory) return null;

  const equipment = new Set(availableEquipment.map((item) => item.trim().toLowerCase()));
  const candidateEquipment = [candidate.equipment, ...(candidate.equipmentList ?? [])]
    .map((item) => item.trim().toLowerCase());
  if (equipment.size > 0 && !candidateEquipment.some((item) => equipment.has(item) || item === "body weight" || item === "bodyweight")) {
    return null;
  }

  let score = 60;
  if (sameBodyPart) score += 15;
  if (sameCategory) score += 15;
  if (candidate.equipment === original.equipment) score += 5;
  const sharedSecondary = candidate.secondaryMuscles.filter((muscle) =>
    original.secondaryMuscles.map((value) => value.toLowerCase()).includes(muscle.toLowerCase()),
  ).length;
  return Math.min(100, score + Math.min(5, sharedSecondary));
}

export function getSafeExerciseSubstitutions(
  original: ExerciseCatalogItem | undefined,
  catalog: ExerciseCatalogItem[],
  availableEquipment: string[] = [],
): Array<{ exercise: ExerciseCatalogItem; intentScore: number }> {
  if (!original) return [];
  return catalog
    .flatMap((exercise) => {
      const intentScore = scoreExerciseSubstitution(original, exercise, availableEquipment);
      return intentScore == null ? [] : [{ exercise, intentScore }];
    })
    .sort((a, b) => b.intentScore - a.intentScore || a.exercise.name.localeCompare(b.exercise.name));
}

export function calculateMuscleVolume(
  exercises: TrainingVolumeExercise[],
  sets: TrainingVolumeSet[],
): MuscleVolume[] {
  const byExercise = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const totals = new Map<string, { prescribedSets: number; completedSets: number }>();

  exercises.forEach((exercise) => {
    const muscle = exercise.muscle || "Other";
    const current = totals.get(muscle) ?? { prescribedSets: 0, completedSets: 0 };
    current.prescribedSets += Math.max(0, exercise.sets);
    totals.set(muscle, current);
  });
  sets.forEach((set) => {
    if (!set.completed || !set.programExerciseId) return;
    const exercise = byExercise.get(set.programExerciseId);
    if (!exercise) return;
    const muscle = exercise.muscle || "Other";
    const current = totals.get(muscle) ?? { prescribedSets: 0, completedSets: 0 };
    current.completedSets += 1;
    totals.set(muscle, current);
  });

  return [...totals.entries()]
    .map(([muscle, volume]) => ({
      muscle,
      ...volume,
      completionPct: volume.prescribedSets > 0
        ? Math.min(100, Math.round((volume.completedSets / volume.prescribedSets) * 100))
        : 0,
    }))
    .sort((a, b) => b.prescribedSets - a.prescribedSets || a.muscle.localeCompare(b.muscle));
}

export function calculateDailyTrainingLoad(sessions: TrainingLoadSession[]): DailyTrainingLoad[] {
  const days = new Map<string, DailyTrainingLoad>();
  sessions.forEach((session) => {
    if (!session.durationSeconds || !session.perceivedEffort) return;
    const date = session.startedAt.slice(0, 10);
    const current = days.get(date) ?? { date, load: 0, sessions: 0 };
    current.load += Math.round((session.durationSeconds / 60) * session.perceivedEffort);
    current.sessions += 1;
    days.set(date, current);
  });
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}
