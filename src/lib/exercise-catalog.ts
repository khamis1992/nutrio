export interface ExerciseTranslation {
  name: string;
  description: string;
  instructions: string[];
  aliases: string[];
}

export interface ExerciseImageAsset {
  url: string;
  thumbnail: string | null;
  isMain: boolean;
  style: string | null;
  aiGenerated: boolean;
}

export interface ExerciseVideoAsset {
  url: string;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  codec: string | null;
  isMain: boolean;
  webPlayable?: boolean;
}

export interface ExerciseDataQuality {
  score: number;
  level: "complete" | "partial" | "basic";
  hasInstructions: boolean;
  hasMuscleData: boolean;
  hasEquipmentData: boolean;
  hasImage: boolean;
  hasVideo: boolean;
  hasAnimation?: boolean;
}

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
  description?: string | null;
  aliases?: string[];
  translations?: Partial<Record<"en" | "ar", ExerciseTranslation>>;
  equipmentList?: string[];
  primaryMuscles?: string[];
  images?: ExerciseImageAsset[];
  videos?: ExerciseVideoAsset[];
  license?: { name: string; url: string | null; author: string } | null;
  source?: "legacy" | "wger" | "merged";
  externalIds?: { wgerId?: number; wgerUuid?: string };
  lastUpdated?: string | null;
  dataQuality?: ExerciseDataQuality;
}

let catalogPromise: Promise<ExerciseCatalogItem[]> | null = null;

const localExerciseVideos: Record<string, string> = {
  "0001": "0001-2gPfomN.mp4",
  "0002": "0002-Hy9D21L.mp4",
};

function getPublicExerciseAssetUrl(path: string): string {
  const normalizedPath = path.replace(/^\/+/, "");
  const configuredBase = import.meta.env.BASE_URL || "/";

  // Vite uses a relative base for local and Capacitor builds. Runtime URLs
  // must still be rooted at the app origin so nested client routes do not
  // turn `./exercises/...` into `/coach-programs/.../exercises/...`.
  if (configuredBase === "." || configuredBase === "./") {
    return `/${normalizedPath}`;
  }

  const normalizedBase = configuredBase.endsWith("/")
    ? configuredBase
    : `${configuredBase}/`;
  return `${normalizedBase}${normalizedPath}`;
}

async function fetchCatalog(path: string): Promise<ExerciseCatalogItem[]> {
  const response = await fetch(getPublicExerciseAssetUrl(`exercises/${path}`));
  if (!response.ok) throw new Error(`Unable to load exercise catalog (${response.status})`);
  return response.json() as Promise<ExerciseCatalogItem[]>;
}

export function loadExerciseCatalog(): Promise<ExerciseCatalogItem[]> {
  if (!catalogPromise) {
    catalogPromise = fetchCatalog("catalog.v2.json").catch(() => fetchCatalog("catalog.v1.json"));
  }
  return catalogPromise;
}

function safeHttpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function getExerciseImageUrl(exercise: Pick<ExerciseCatalogItem, "image">): string | null {
  const remoteImage = safeHttpsUrl(exercise.image);
  if (remoteImage) return remoteImage;
  return exercise.image
    ? getPublicExerciseAssetUrl(`exercises/images/${exercise.image}`)
    : null;
}

export function getExerciseAnimationUrl(
  exercise: Pick<ExerciseCatalogItem, "animationUrl">,
): string | null {
  if (!exercise.animationUrl) return null;
  const remoteAnimation = safeHttpsUrl(exercise.animationUrl);
  return remoteAnimation
    || getPublicExerciseAssetUrl(`exercises/videos/${exercise.animationUrl}`);
}

export function getExerciseVideoUrl(
  exercise: Pick<ExerciseCatalogItem, "id" | "videos">,
): string | null {
  const playableVideos = (exercise.videos || []).filter((video) =>
    video.webPlayable === true
      || (video.codec?.toLowerCase() === "h264" && /\.mp4(?:$|\?)/i.test(video.url)));
  const preferred = playableVideos.find((video) => video.isMain) || playableVideos[0];
  const remoteVideo = safeHttpsUrl(preferred?.url);
  if (remoteVideo) return remoteVideo;

  const localVideo = localExerciseVideos[exercise.id];
  return localVideo
    ? getPublicExerciseAssetUrl(`exercises/videos/${localVideo}`)
    : null;
}

export function getLocalizedExerciseContent(
  exercise: ExerciseCatalogItem,
  language: "en" | "ar",
): ExerciseTranslation {
  const translation = exercise.translations?.[language];
  return {
    name: translation?.name || exercise.name,
    description: translation?.description || exercise.description || "",
    instructions: translation?.instructions?.length ? translation.instructions : exercise.instructions,
    aliases: translation?.aliases?.length ? translation.aliases : (exercise.aliases || []),
  };
}

export function formatExerciseLabel(value: string): string {
  return value.split(" ").filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

export function filterExercises(
  catalog: ExerciseCatalogItem[], query: string, category: string, equipment: string,
): ExerciseCatalogItem[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return catalog.filter((exercise) => {
    if (category !== "all" && exercise.category !== category) return false;
    if (equipment !== "all" && ![exercise.equipment, ...(exercise.equipmentList || [])].includes(equipment)) return false;
    if (!normalizedQuery) return true;
    return [
      exercise.name, exercise.target, exercise.muscleGroup, exercise.category, exercise.equipment,
      ...exercise.secondaryMuscles, ...(exercise.primaryMuscles || []), ...(exercise.equipmentList || []),
      ...(exercise.aliases || []),
      ...Object.values(exercise.translations || {}).flatMap((translation) =>
        translation ? [translation.name, ...translation.aliases] : []),
    ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  });
}
