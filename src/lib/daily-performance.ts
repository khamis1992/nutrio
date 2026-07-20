export type PerformanceMode = "train" | "recover" | "rest";
export type PerformanceConfidence = "low" | "medium" | "high";
export type CarbFocus = "none" | "balanced" | "pre_workout" | "post_workout";

export interface DailyPerformanceDecision {
  id: string;
  user_id: string;
  decision_date: string;
  version: number;
  mode: PerformanceMode;
  confidence_score: number;
  confidence_level: PerformanceConfidence;
  workout_program_id: string | null;
  workout_day_id: string | null;
  workout_title: string | null;
  workout_day_type: "workout" | "rest" | "recovery" | null;
  workout_intensity_percent: number;
  exercise_count: number;
  calorie_min: number;
  calorie_max: number;
  protein_min_g: number;
  carbs_target_g: number;
  hydration_min_ml: number;
  carb_focus: CarbFocus;
  meal_calorie_min: number;
  meal_calorie_max: number;
  meal_protein_min_g: number;
  excluded_meal_types: string[];
  coach_directive_id: string | null;
  coach_message: string | null;
  recommended_meal_id: string | null;
  recommendation_source: string | null;
  reasons: string[];
  evidence: Record<string, unknown>;
  meal_response_evidence: DailyMealResponseEvidence | null;
  expires_at: string;
}

export interface DailyMealResponseEvidence {
  enabled: boolean;
  applied_to_ranking: boolean;
  eligible_episode_count: number;
  evidence_tier: "descriptive" | "early" | "medium" | "strong" | null;
  summary: string | null;
}

export interface CoachPerformanceDirective {
  id: string;
  coach_id: string;
  client_id: string;
  message: string;
  calorie_min: number | null;
  calorie_max: number | null;
  protein_min_g: number | null;
  carbs_target_g: number | null;
  hydration_min_ml: number | null;
  carb_focus: CarbFocus;
  workout_intensity_cap: number | null;
  excluded_meal_types: string[];
  priority: number;
  status: "active" | "archived";
  valid_from: string;
  valid_until: string;
  version: number;
}

export type CoachPerformanceDirectiveInput = Omit<
  CoachPerformanceDirective,
  "id" | "coach_id" | "status" | "version"
> & { id?: string };

export interface PerformanceMealCandidate {
  id: string;
  name: string;
  calories: number | null;
  protein_g: number | null;
  meal_type: string | null;
  image_url?: string | null;
}

const numberValue = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const nullableString = (value: unknown) => typeof value === "string" && value ? value : null;
const nullableNumber = (value: unknown) => value === null || value === undefined
  ? null
  : numberValue(value);
const objectValue = (value: unknown): Record<string, unknown> => (
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

export function normalizeDailyPerformanceDecision(value: unknown): DailyPerformanceDecision {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const evidence = objectValue(row.evidence);
  const mealResponse = objectValue(
    row.meal_response_evidence
      ?? evidence.meal_response_evidence
      ?? evidence.meal_response,
  );
  const mealResponseTier = String(mealResponse.evidence_tier ?? mealResponse.strongest_evidence_tier ?? "");
  const hasMealResponseEvidence = Object.keys(mealResponse).length > 0;
  const mode = ["train", "recover", "rest"].includes(String(row.mode))
    ? row.mode as PerformanceMode
    : "recover";
  const confidenceLevel = ["low", "medium", "high"].includes(String(row.confidence_level))
    ? row.confidence_level as PerformanceConfidence
    : "low";
  const carbFocus = ["none", "balanced", "pre_workout", "post_workout"].includes(String(row.carb_focus))
    ? row.carb_focus as CarbFocus
    : "balanced";

  return {
    id: String(row.id ?? ""),
    user_id: String(row.user_id ?? ""),
    decision_date: String(row.decision_date ?? ""),
    version: Math.max(1, numberValue(row.version, 1)),
    mode,
    confidence_score: Math.min(100, Math.max(0, numberValue(row.confidence_score))),
    confidence_level: confidenceLevel,
    workout_program_id: nullableString(row.workout_program_id),
    workout_day_id: nullableString(row.workout_day_id),
    workout_title: nullableString(row.workout_title),
    workout_day_type: ["workout", "rest", "recovery"].includes(String(row.workout_day_type))
      ? row.workout_day_type as DailyPerformanceDecision["workout_day_type"]
      : null,
    workout_intensity_percent: numberValue(row.workout_intensity_percent),
    exercise_count: numberValue(row.exercise_count),
    calorie_min: numberValue(row.calorie_min),
    calorie_max: numberValue(row.calorie_max),
    protein_min_g: numberValue(row.protein_min_g),
    carbs_target_g: numberValue(row.carbs_target_g),
    hydration_min_ml: numberValue(row.hydration_min_ml),
    carb_focus: carbFocus,
    meal_calorie_min: numberValue(row.meal_calorie_min),
    meal_calorie_max: numberValue(row.meal_calorie_max),
    meal_protein_min_g: numberValue(row.meal_protein_min_g),
    excluded_meal_types: Array.isArray(row.excluded_meal_types)
      ? row.excluded_meal_types.map(String)
      : [],
    coach_directive_id: nullableString(row.coach_directive_id),
    coach_message: nullableString(row.coach_message),
    recommended_meal_id: nullableString(row.recommended_meal_id),
    recommendation_source: nullableString(row.recommendation_source),
    reasons: Array.isArray(row.reasons) ? row.reasons.map(String) : [],
    evidence,
    meal_response_evidence: hasMealResponseEvidence ? {
      enabled: Boolean(mealResponse.enabled ?? mealResponse.meal_response_enabled),
      applied_to_ranking: Boolean(
        mealResponse.applied_to_ranking ?? mealResponse.recommendation_use_enabled,
      ),
      eligible_episode_count: Math.max(0, numberValue(
        mealResponse.eligible_episode_count ?? mealResponse.eligible_episodes,
      )),
      evidence_tier: ["descriptive", "early", "medium", "strong"].includes(mealResponseTier)
        ? mealResponseTier as DailyMealResponseEvidence["evidence_tier"]
        : null,
      summary: nullableString(mealResponse.summary),
    } : null,
    expires_at: String(row.expires_at ?? ""),
  };
}

export function normalizeCoachPerformanceDirective(value: unknown): CoachPerformanceDirective | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (!row.id) return null;
  const focus = ["none", "balanced", "pre_workout", "post_workout"].includes(String(row.carb_focus))
    ? row.carb_focus as CarbFocus
    : "balanced";
  return {
    id: String(row.id),
    coach_id: String(row.coach_id ?? ""),
    client_id: String(row.client_id ?? ""),
    message: String(row.message ?? ""),
    calorie_min: nullableNumber(row.calorie_min),
    calorie_max: nullableNumber(row.calorie_max),
    protein_min_g: nullableNumber(row.protein_min_g),
    carbs_target_g: nullableNumber(row.carbs_target_g),
    hydration_min_ml: nullableNumber(row.hydration_min_ml),
    carb_focus: focus,
    workout_intensity_cap: nullableNumber(row.workout_intensity_cap),
    excluded_meal_types: Array.isArray(row.excluded_meal_types)
      ? row.excluded_meal_types.map(String)
      : [],
    priority: numberValue(row.priority, 50),
    status: row.status === "archived" ? "archived" : "active",
    valid_from: String(row.valid_from ?? ""),
    valid_until: String(row.valid_until ?? ""),
    version: Math.max(1, numberValue(row.version, 1)),
  };
}

const normalizeMealType = (value: string | null) => value === "snacks" ? "snack" : value;

export function mealMatchesPerformanceEnvelope(
  meal: PerformanceMealCandidate,
  decision: DailyPerformanceDecision,
) {
  const calories = meal.calories ?? 0;
  const protein = meal.protein_g ?? 0;
  return !decision.excluded_meal_types.includes(normalizeMealType(meal.meal_type) ?? "")
    && calories >= decision.meal_calorie_min
    && calories <= decision.meal_calorie_max
    && protein >= decision.meal_protein_min_g;
}

export function selectPerformanceMeal<T extends PerformanceMealCandidate>(
  safetyRankedMeals: T[],
  decision: DailyPerformanceDecision | null | undefined,
) {
  if (!decision) return null;
  return safetyRankedMeals.find((meal) => mealMatchesPerformanceEnvelope(meal, decision)) ?? null;
}
