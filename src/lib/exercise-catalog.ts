export interface ExerciseCatalogItem {
  id: string;
  name: string;
  category: string;
  bodyPart: string;
  equipment: string;
  target: string;
  muscleGroup: string;
  secondaryMuscles: string[];
  instructions: string[];
  image: string | null;
  animationUrl: string | null;
  attribution: string;
}

let catalogPromise: Promise<ExerciseCatalogItem[]> | null = null;

export function loadExerciseCatalog(): Promise<ExerciseCatalogItem[]> {
  if (!catalogPromise) {
    const url = `${import.meta.env.BASE_URL}exercises/catalog.v1.json`;
    catalogPromise = fetch(url).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Unable to load exercise catalog (${response.status})`);
      }
      return response.json() as Promise<ExerciseCatalogItem[]>;
    });
  }
  return catalogPromise;
}

export function getExerciseImageUrl(exercise: Pick<ExerciseCatalogItem, "image">): string | null {
  return exercise.image
    ? `${import.meta.env.BASE_URL}exercises/images/${exercise.image}`
    : null;
}

export function getExerciseAnimationUrl(
  exercise: Pick<ExerciseCatalogItem, "animationUrl">,
): string | null {
  if (!exercise.animationUrl) return null;
  if (/^https?:\/\//.test(exercise.animationUrl)) return exercise.animationUrl;
  return `${import.meta.env.BASE_URL}exercises/videos/${exercise.animationUrl}`;
}

export function formatExerciseLabel(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function filterExercises(
  catalog: ExerciseCatalogItem[],
  query: string,
  category: string,
  equipment: string,
): ExerciseCatalogItem[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return catalog.filter((exercise) => {
    if (category !== "all" && exercise.category !== category) return false;
    if (equipment !== "all" && exercise.equipment !== equipment) return false;
    if (!normalizedQuery) return true;
    return [
      exercise.name,
      exercise.target,
      exercise.muscleGroup,
      exercise.category,
      exercise.equipment,
      ...exercise.secondaryMuscles,
    ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  });
}
