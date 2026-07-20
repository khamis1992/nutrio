export type WorkoutSetType = "normal" | "dropset" | "myo" | "partial" | "forced" | "tut" | "isometric" | "jump";
export type WorkoutPrescriptionUnit = "reps" | "seconds" | "minutes" | "meters" | "kilometers";

export interface SequencedExercise {
  id: string;
  sets: number;
  order_index: number;
  rest_seconds: number | null;
  superset_group?: string | null;
}

export interface WorkoutSequenceStep<T extends SequencedExercise> {
  exercise: T;
  setNumber: number;
  supersetGroup: string | null;
  roundNumber: number;
  roundExerciseNumber: number;
  roundExerciseCount: number;
  restAfterSeconds: number;
}

export function buildWorkoutSequence<T extends SequencedExercise>(items: T[]): WorkoutSequenceStep<T>[] {
  const exercises = [...items].sort((a, b) => a.order_index - b.order_index);
  const handledGroups = new Set<string>();
  const steps: WorkoutSequenceStep<T>[] = [];

  for (const exercise of exercises) {
    const group = exercise.superset_group?.trim().toUpperCase() || null;
    if (!group) {
      for (let setNumber = 1; setNumber <= exercise.sets; setNumber += 1) {
        steps.push({
          exercise,
          setNumber,
          supersetGroup: null,
          roundNumber: setNumber,
          roundExerciseNumber: 1,
          roundExerciseCount: 1,
          restAfterSeconds: exercise.rest_seconds ?? 0,
        });
      }
      continue;
    }

    if (handledGroups.has(group)) continue;
    handledGroups.add(group);
    const members = exercises.filter((candidate) => candidate.superset_group?.trim().toUpperCase() === group);
    const rounds = Math.max(...members.map((member) => member.sets), 0);
    const groupRest = Math.max(...members.map((member) => member.rest_seconds ?? 0), 0);

    for (let round = 1; round <= rounds; round += 1) {
      const activeMembers = members.filter((member) => member.sets >= round);
      activeMembers.forEach((member, index) => {
        steps.push({
          exercise: member,
          setNumber: round,
          supersetGroup: group,
          roundNumber: round,
          roundExerciseNumber: index + 1,
          roundExerciseCount: activeMembers.length,
          restAfterSeconds: index === activeMembers.length - 1 ? groupRest : 0,
        });
      });
    }
  }

  return steps;
}
