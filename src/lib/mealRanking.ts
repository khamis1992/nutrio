export const MEAL_RANKING_ENGINE_VERSION = "meal-ranking-v2.2.0";

export type MealRecommendationEngine = "legacy" | "v2";

export function selectMealRecommendationEngine(
  rankingV2Enabled: boolean,
): MealRecommendationEngine {
  return rankingV2Enabled ? "v2" : "legacy";
}

export type RankingFreshnessState = "fresh" | "stale" | "missing";

export type MealExclusionCode =
  | "unavailable"
  | "restaurant_invalid"
  | "allergen_conflict"
  | "medicine_conflict"
  | "diet_rule_mismatch"
  | "commercially_ineligible"
  | "delivery_window_unavailable";

export type MealExplanationCode =
  | "calorie_fit"
  | "protein_gap"
  | "macro_balance"
  | "preference_match"
  | "variety"
  | "high_rating"
  | "delivery_fit"
  | "good_value"
  | "micronutrient_fit"
  | "health_context_fit"
  | "meal_response_history"
  | "stale_activity"
  | "missing_safety_data";

export type MealResponseEvidenceTier = "moderate" | "medium" | "strong";
export type MealResponseSourceKind =
  | "measured"
  | "self_reported"
  | "observed"
  | "experiment_backed"
  | "experiment"
  | "predicted";

export interface MealResponseRankingEvidence {
  mealId: string;
  outcomeType: string;
  estimateValue: number;
  evidenceTier: MealResponseEvidenceTier;
  sourceKind: MealResponseSourceKind;
  eligibleEpisodeCount: number;
  evidenceWeight: number;
  publishedAt: string;
  expiresAt: string | null;
}

export interface MealResponseRankingInput {
  enabled: boolean;
  generatedAt: string | null;
  meals: MealResponseRankingEvidence[];
}

export interface MealRankingCandidate {
  id: string;
  name: string;
  calories: number | null;
  image_url: string | null;
  restaurant_id: string | null;
  is_available: boolean | null;
  restaurant_name: string;
  restaurant_logo_url: string | null;
  restaurant_rating: number;
  restaurant_total_orders: number;
  price: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g?: number | null;
  sodium_mg?: number | null;
  nutrientMissingCodes?: string[];
  meal_type: string | null;
  restaurantValid?: boolean;
  allergenIds?: string[];
  dietTagIds?: string[];
  medicineConflictCodes?: string[];
  creditEligible?: boolean;
  walletPurchaseEligible?: boolean;
  deliveryAvailable?: boolean | null;
  deliveryMinutes?: number | null;
}

export interface NutritionTargets {
  dailyCalories: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
  fiberTarget?: number | null;
  sodiumLimitMg?: number | null;
}

export interface ConsumedNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sodiumMg?: number | null;
  measuredNutrientCodes?: string[];
  missingNutrientCodes?: string[];
}

export interface TastePreferences {
  preferredRestaurants: string[];
  favoriteMealTypes: string[];
  dietaryRestrictions: string[];
  favoriteMealIds?: string[];
}

export interface MealRankingHealthContext {
  available: boolean;
  sourceDate: string | null;
  freshnessDays: number | null;
  mood: number | null;
  stress: number | null;
  appetite: number | null;
  energy: number | null;
  digestiveSymptoms: string[];
  symptomSeverity: number | null;
  cyclePhase: string | null;
  explanationCodes: string[];
}

export interface MealRankingContext {
  generatedAt: string;
  goalType?: string | null;
  targets: NutritionTargets;
  consumed: ConsumedNutrition;
  preferences: TastePreferences;
  userAllergenIds: string[];
  recentMealIds?: string[];
  recentMealTypes?: string[];
  activity?: {
    caloriesBurned: number;
    measuredAt: string | null;
    maxAllowanceCalories?: number;
  } | null;
  healthContext?: MealRankingHealthContext | null;
  mealResponse?: MealResponseRankingInput | null;
  commercial?: {
    mode: "flexible" | "credits_only" | "budget_only";
    remainingCredits: number | null;
    maxPrice: number | null;
    walletOrCardAvailable?: boolean;
  } | null;
  delivery?: {
    maxMinutes: number | null;
  } | null;
  inputUpdatedAt?: {
    goals?: string | null;
    consumption?: string | null;
    preferences?: string | null;
    safety?: string | null;
    availability?: string | null;
    commercial?: string | null;
  };
}

export interface RankingComponentScores {
  nutrition: number;
  preference: number;
  quality: number;
  variety: number;
  delivery: number;
  value: number;
  micronutrients: number;
  healthContext: number;
  mealResponse: number;
}

export interface RankedMeal extends MealRankingCandidate {
  finalScore: number;
  mealResponseAdjustment: number;
  componentScores: RankingComponentScores;
  explanationCodes: MealExplanationCode[];
  inputFreshness: Record<string, RankingFreshnessState>;
}

export interface ExcludedMeal {
  mealId: string;
  codes: MealExclusionCode[];
}

export interface MealRankingRun {
  engineVersion: typeof MEAL_RANKING_ENGINE_VERSION;
  generatedAt: string;
  goalType?: string | null;
  ranked: RankedMeal[];
  excluded: ExcludedMeal[];
  inputFreshness: Record<string, RankingFreshnessState>;
  activityAllowanceApplied: number;
  healthContextApplied: boolean;
  healthContextCodes: string[];
  mealResponseApplied?: boolean;
  mealResponseMealIds?: string[];
  remainingNutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  offline: boolean;
}

const WEIGHTS: Record<keyof RankingComponentScores, number> = {
  nutrition: 0.37,
  preference: 0.14,
  quality: 0.09,
  variety: 0.09,
  delivery: 0.09,
  value: 0.09,
  micronutrients: 0.05,
  healthContext: 0.08,
  mealResponse: 0,
};

const MEAL_RESPONSE_WEIGHT = 0.06;
const MAX_MEAL_RESPONSE_ADJUSTMENT = 3;

const clamp = (value: number, minimum = 0, maximum = 100) => (
  Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum))
);

const normalized = (value: number | null | undefined) => (
  Number.isFinite(value) ? Math.max(0, Number(value)) : 0
);

const asObject = (value: unknown): Record<string, unknown> => (
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const finiteNumber = (value: unknown): number | null => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
};

export function normalizeMealResponseRankingInput(value: unknown): MealResponseRankingInput {
  const input = asObject(value);
  const meals = Array.isArray(input.meals) ? input.meals : [];
  return {
    enabled: input.enabled === true,
    generatedAt: typeof input.generated_at === "string" ? input.generated_at : null,
    meals: meals.flatMap((value): MealResponseRankingEvidence[] => {
      const row = asObject(value);
      const estimateValue = finiteNumber(row.estimate_value);
      const evidenceWeight = finiteNumber(row.evidence_weight);
      const eligibleEpisodeCount = finiteNumber(row.eligible_episode_count);
      const evidenceTier = String(row.evidence_tier);
      const sourceKind = String(row.source_kind);
      if (
        typeof row.meal_id !== "string"
        || !row.meal_id
        || typeof row.outcome_type !== "string"
        || estimateValue === null
        || evidenceWeight === null
        || eligibleEpisodeCount === null
        || !["moderate", "medium", "strong"].includes(evidenceTier)
        || !["measured", "self_reported", "observed", "experiment_backed", "experiment", "predicted"].includes(sourceKind)
        || typeof row.published_at !== "string"
      ) {
        return [];
      }
      return [{
        mealId: row.meal_id,
        outcomeType: row.outcome_type,
        estimateValue,
        evidenceTier: evidenceTier as MealResponseEvidenceTier,
        sourceKind: sourceKind as MealResponseSourceKind,
        eligibleEpisodeCount: Math.max(0, Math.floor(eligibleEpisodeCount)),
        evidenceWeight: clamp(evidenceWeight, 0, 1),
        publishedAt: row.published_at,
        expiresAt: typeof row.expires_at === "string" ? row.expires_at : null,
      }];
    }),
  };
}

function freshnessState(
  generatedAt: string,
  updatedAt: string | null | undefined,
  maxAgeHours: number,
): RankingFreshnessState {
  if (!updatedAt) return "missing";
  const age = new Date(generatedAt).getTime() - new Date(updatedAt).getTime();
  if (!Number.isFinite(age)) return "missing";
  return age <= maxAgeHours * 60 * 60 * 1000 ? "fresh" : "stale";
}

function buildInputFreshness(context: MealRankingContext) {
  const updated = context.inputUpdatedAt ?? {};
  const healthContextDate = context.healthContext?.sourceDate
    ? `${context.healthContext.sourceDate}T12:00:00+03:00`
    : null;
  return {
    goals: freshnessState(context.generatedAt, updated.goals, 24 * 14),
    consumption: freshnessState(context.generatedAt, updated.consumption, 24),
    preferences: freshnessState(context.generatedAt, updated.preferences, 24 * 90),
    safety: freshnessState(context.generatedAt, updated.safety, 24 * 30),
    availability: freshnessState(context.generatedAt, updated.availability, 1),
    commercial: freshnessState(context.generatedAt, updated.commercial, 1),
    activity: freshnessState(context.generatedAt, context.activity?.measuredAt, 24),
    healthContext: context.healthContext?.available
      ? freshnessState(context.generatedAt, healthContextDate, 96)
      : "missing",
  } satisfies Record<string, RankingFreshnessState>;
}

function activityAllowance(context: MealRankingContext, freshness: RankingFreshnessState) {
  if (!context.activity || freshness !== "fresh") return 0;
  const dailyCap = Math.min(
    context.activity.maxAllowanceCalories ?? 300,
    normalized(context.targets.dailyCalories) * 0.2,
  );
  return Math.round(Math.min(normalized(context.activity.caloriesBurned) * 0.5, dailyCap));
}

function getRemainingNutrition(context: MealRankingContext, allowance: number) {
  return {
    calories: Math.max(0, normalized(context.targets.dailyCalories) + allowance - normalized(context.consumed.calories)),
    protein: Math.max(0, normalized(context.targets.proteinTarget) - normalized(context.consumed.protein)),
    carbs: Math.max(0, normalized(context.targets.carbsTarget) - normalized(context.consumed.carbs)),
    fat: Math.max(0, normalized(context.targets.fatTarget) - normalized(context.consumed.fat)),
  };
}

function getExclusions(candidate: MealRankingCandidate, context: MealRankingContext): MealExclusionCode[] {
  const codes: MealExclusionCode[] = [];
  if (candidate.is_available !== true) codes.push("unavailable");
  if (!candidate.restaurant_id || candidate.restaurantValid === false) codes.push("restaurant_invalid");

  const userAllergens = new Set(context.userAllergenIds);
  if ((candidate.allergenIds ?? []).some((allergen) => userAllergens.has(allergen))) {
    codes.push("allergen_conflict");
  }
  if ((candidate.medicineConflictCodes?.length ?? 0) > 0) codes.push("medicine_conflict");

  const candidateTags = new Set(candidate.dietTagIds ?? []);
  if (context.preferences.dietaryRestrictions.some((tag) => !candidateTags.has(tag))) {
    codes.push("diet_rule_mismatch");
  }

  const commercial = context.commercial;
  if (commercial?.mode === "credits_only") {
    if ((commercial.remainingCredits ?? 0) <= 0 || candidate.creditEligible === false) {
      codes.push("commercially_ineligible");
    }
  } else if (commercial?.mode === "budget_only") {
    if (commercial.maxPrice === null || candidate.price === null || candidate.price > commercial.maxPrice) {
      codes.push("commercially_ineligible");
    }
  } else if (
    commercial?.mode === "flexible"
    && candidate.creditEligible === false
    && (
      candidate.walletPurchaseEligible === false
      || commercial.walletOrCardAvailable === false
    )
  ) {
    codes.push("commercially_ineligible");
  }

  if (candidate.deliveryAvailable !== true) {
    codes.push("delivery_window_unavailable");
  } else if (
    context.delivery?.maxMinutes !== null
    && context.delivery?.maxMinutes !== undefined
    && candidate.deliveryMinutes !== null
    && candidate.deliveryMinutes !== undefined
    && candidate.deliveryMinutes > context.delivery.maxMinutes
  ) {
    codes.push("delivery_window_unavailable");
  }
  return codes;
}

function fitScore(value: number, remaining: number) {
  if (remaining <= 0) return value <= 0 ? 100 : clamp(100 - value * 2);
  return clamp(100 - Math.abs(value - remaining) / Math.max(remaining, 1) * 100);
}

function scoreNutrition(
  candidate: MealRankingCandidate,
  context: MealRankingContext,
  remaining: ReturnType<typeof getRemainingNutrition>,
) {
  const expectedMeals = remaining.calories > context.targets.dailyCalories * 0.55 ? 2 : 1;
  const perMeal = {
    calories: remaining.calories / expectedMeals,
    protein: remaining.protein / expectedMeals,
    carbs: remaining.carbs / expectedMeals,
    fat: remaining.fat / expectedMeals,
  };
  const scores = {
    calories: fitScore(normalized(candidate.calories), perMeal.calories),
    protein: fitScore(normalized(candidate.protein_g), perMeal.protein),
    carbs: fitScore(normalized(candidate.carbs_g), perMeal.carbs),
    fat: fitScore(normalized(candidate.fat_g), perMeal.fat),
  };
  const weights = context.goalType === "weight_loss"
    ? { calories: 0.5, protein: 0.25, carbs: 0.125, fat: 0.125 }
    : context.goalType === "muscle_gain"
      ? { calories: 0.3, protein: 0.4, carbs: 0.2, fat: 0.1 }
      : { calories: 0.4, protein: 0.3, carbs: 0.15, fat: 0.15 };
  return {
    score: Math.round(
      scores.calories * weights.calories
      + scores.protein * weights.protein
      + scores.carbs * weights.carbs
      + scores.fat * weights.fat,
    ),
    calorieFit: scores.calories,
    proteinFit: scores.protein,
    remaining,
  };
}

function scorePreference(candidate: MealRankingCandidate, context: MealRankingContext) {
  let score = 40;
  if (candidate.restaurant_id && context.preferences.preferredRestaurants.includes(candidate.restaurant_id)) score += 30;
  if (candidate.meal_type && context.preferences.favoriteMealTypes.includes(candidate.meal_type)) score += 15;
  if (context.preferences.favoriteMealIds?.includes(candidate.id)) score += 15;
  return clamp(score);
}

function scoreQuality(candidate: MealRankingCandidate) {
  const rating = clamp(normalized(candidate.restaurant_rating), 0, 5) / 5 * 85;
  const popularity = Math.min(15, Math.log10(normalized(candidate.restaurant_total_orders) + 1) * 5);
  return Math.round(clamp(rating + popularity));
}

function scoreVariety(candidate: MealRankingCandidate, context: MealRankingContext) {
  if (context.recentMealIds?.includes(candidate.id)) return 10;
  if (candidate.meal_type && context.recentMealTypes?.includes(candidate.meal_type)) return 55;
  return 100;
}

function scoreDelivery(candidate: MealRankingCandidate, context: MealRankingContext) {
  if (candidate.deliveryMinutes === null || candidate.deliveryMinutes === undefined) return 50;
  const maximum = context.delivery?.maxMinutes ?? 60;
  return Math.round(clamp(100 - candidate.deliveryMinutes / Math.max(maximum, 1) * 70));
}

function scoreValue(candidate: MealRankingCandidate, context: MealRankingContext) {
  if (candidate.creditEligible === true && (context.commercial?.remainingCredits ?? 0) > 0) return 100;
  if (candidate.walletPurchaseEligible === true) return 70;
  if (candidate.price === null) return 40;
  const budget = context.commercial?.maxPrice;
  if (!budget || budget <= 0) return 60;
  return Math.round(clamp(100 - candidate.price / budget * 60));
}

function scoreMicronutrients(candidate: MealRankingCandidate, context: MealRankingContext) {
  const fiberTarget = normalized(context.targets.fiberTarget);
  const sodiumLimit = normalized(context.targets.sodiumLimitMg);
  const missing = new Set(candidate.nutrientMissingCodes ?? []);
  const measured = new Set(context.consumed.measuredNutrientCodes ?? []);
  const scores: number[] = [];

  if (fiberTarget > 0 && Number.isFinite(candidate.fiber_g) && !missing.has("fiber_g")) {
    const consumedFiber = measured.has("fiber_g") ? normalized(context.consumed.fiber) : 0;
    const fiberRemaining = Math.max(0, fiberTarget - consumedFiber);
    scores.push(clamp(normalized(candidate.fiber_g) / Math.max(fiberRemaining, 1) * 100));
  }

  if (sodiumLimit > 0 && Number.isFinite(candidate.sodium_mg) && !missing.has("sodium_mg")) {
    const consumedSodium = measured.has("sodium_mg") ? normalized(context.consumed.sodiumMg) : 0;
    const sodiumRemaining = Math.max(0, sodiumLimit - consumedSodium);
    scores.push(clamp(100 - normalized(candidate.sodium_mg) / Math.max(sodiumRemaining, 1) * 100));
  }

  return scores.length > 0
    ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length)
    : 50;
}

function scoreHealthContext(
  candidate: MealRankingCandidate,
  context: MealRankingContext,
  remaining: ReturnType<typeof getRemainingNutrition>,
  freshness: RankingFreshnessState,
) {
  const healthContext = context.healthContext;
  if (!healthContext?.available || freshness !== "fresh") {
    return { score: 50, applied: false, codes: [] as string[] };
  }

  const activeCodes = new Set(healthContext.explanationCodes);
  const signalScores: number[] = [];
  const expectedMeals = remaining.calories > context.targets.dailyCalories * 0.55 ? 2 : 1;

  if (activeCodes.has("context.low_appetite")) {
    const lighterMealTarget = clamp(
      remaining.calories / expectedMeals * 0.7,
      250,
      450,
    );
    signalScores.push(fitScore(normalized(candidate.calories), lighterMealTarget));
  }

  if (activeCodes.has("context.high_appetite")) {
    const satietyScore = (
      clamp(normalized(candidate.protein_g) / 35 * 100) * 0.65
      + clamp(normalized(candidate.fiber_g) / 10 * 100) * 0.35
    );
    signalScores.push(satietyScore);
  }

  if (activeCodes.has("context.low_energy")) {
    const perMealCarbs = remaining.carbs / expectedMeals;
    const perMealProtein = remaining.protein / expectedMeals;
    signalScores.push(
      fitScore(normalized(candidate.carbs_g), perMealCarbs) * 0.55
      + fitScore(normalized(candidate.protein_g), perMealProtein) * 0.45,
    );
  }

  if (activeCodes.has("context.digestive_discomfort")) {
    signalScores.push(clamp(100 - Math.max(normalized(candidate.fat_g) - 15, 0) * 3));
  }

  return {
    score: signalScores.length > 0
      ? Math.round(signalScores.reduce((sum, value) => sum + value, 0) / signalScores.length)
      : 50,
    applied: true,
    codes: [...activeCodes].sort(),
  };
}

function mealResponseOutcomeScore(outcomeType: string, estimateValue: number): number | null {
  switch (outcomeType) {
    case "glucose_peak_delta":
      return clamp(100 - Math.max(0, estimateValue) * 1.25);
    case "glucose_positive_iauc":
      return clamp(100 - Math.max(0, estimateValue) / 60);
    case "glucose_recovery_time":
      return clamp(100 - Math.max(0, estimateValue) * (5 / 6));
    default:
      return null;
  }
}

function scoreMealResponse(candidate: MealRankingCandidate, context: MealRankingContext) {
  const input = context.mealResponse;
  if (!input?.enabled) {
    return { score: 50, adjustment: 0, applied: false };
  }

  const generatedAt = new Date(context.generatedAt).getTime();
  const evidence = input.meals.find((item) => item.mealId === candidate.id);
  if (!evidence || !Number.isFinite(generatedAt)) {
    return { score: 50, adjustment: 0, applied: false };
  }

  const publishedAt = new Date(evidence.publishedAt).getTime();
  const expiresAt = evidence.expiresAt === null
    ? null
    : new Date(evidence.expiresAt).getTime();
  const supportedTier = ["moderate", "medium", "strong"].includes(evidence.evidenceTier);
  const supportedSource = evidence.sourceKind !== "predicted"
    && ["measured", "self_reported", "observed", "experiment_backed", "experiment"].includes(evidence.sourceKind);
  if (
    !supportedTier
    || !supportedSource
    || evidence.evidenceWeight < 0.65
    || evidence.eligibleEpisodeCount < 5
    || !Number.isFinite(publishedAt)
    || publishedAt > generatedAt
    || (expiresAt !== null && (!Number.isFinite(expiresAt) || expiresAt <= generatedAt))
  ) {
    return { score: 50, adjustment: 0, applied: false };
  }

  const outcomeScore = mealResponseOutcomeScore(evidence.outcomeType, evidence.estimateValue);
  if (outcomeScore === null) {
    return { score: 50, adjustment: 0, applied: false };
  }

  const score = Math.round(50 + (outcomeScore - 50) * evidence.evidenceWeight);
  const adjustment = Math.round(clamp(
    (score - 50) * MEAL_RESPONSE_WEIGHT,
    -MAX_MEAL_RESPONSE_ADJUSTMENT,
    MAX_MEAL_RESPONSE_ADJUSTMENT,
  ) * 100) / 100;
  return { score, adjustment, applied: true };
}

function explanationCodes(
  scores: RankingComponentScores,
  nutrition: ReturnType<typeof scoreNutrition>,
  freshness: Record<string, RankingFreshnessState>,
  healthContextApplied: boolean,
  mealResponseApplied: boolean,
): MealExplanationCode[] {
  const reasons: Array<{ code: MealExplanationCode; strength: number }> = [];
  if (nutrition.calorieFit >= 65) reasons.push({ code: "calorie_fit", strength: nutrition.calorieFit });
  if (nutrition.remaining.protein > 0 && nutrition.proteinFit >= 55) reasons.push({ code: "protein_gap", strength: nutrition.proteinFit });
  if (scores.nutrition >= 70) reasons.push({ code: "macro_balance", strength: scores.nutrition });
  if (scores.preference >= 70) reasons.push({ code: "preference_match", strength: scores.preference });
  if (scores.variety >= 90) reasons.push({ code: "variety", strength: scores.variety });
  if (scores.quality >= 75) reasons.push({ code: "high_rating", strength: scores.quality });
  if (scores.delivery >= 75) reasons.push({ code: "delivery_fit", strength: scores.delivery });
  if (scores.value >= 80) reasons.push({ code: "good_value", strength: scores.value });
  if (scores.micronutrients >= 70) reasons.push({ code: "micronutrient_fit", strength: scores.micronutrients });
  if (healthContextApplied && Math.abs(scores.healthContext - 50) >= 10) {
    reasons.push({ code: "health_context_fit", strength: 96 });
  }
  if (mealResponseApplied) {
    reasons.push({ code: "meal_response_history", strength: 95 });
  }

  const selected = reasons
    .sort((a, b) => b.strength - a.strength || a.code.localeCompare(b.code))
    .slice(0, 3)
    .map(({ code }) => code);
  if (freshness.activity === "stale") selected.push("stale_activity");
  if (freshness.safety !== "fresh") selected.push("missing_safety_data");
  return selected;
}

export function rankMealsV2(
  candidates: MealRankingCandidate[],
  context: MealRankingContext,
): MealRankingRun {
  const inputFreshness = buildInputFreshness(context);
  const allowance = activityAllowance(context, inputFreshness.activity);
  const remainingNutrition = getRemainingNutrition(context, allowance);
  const excluded: ExcludedMeal[] = [];
  const ranked: RankedMeal[] = [];

  for (const candidate of candidates) {
    const exclusionCodes = getExclusions(candidate, context);
    if (exclusionCodes.length > 0) {
      excluded.push({ mealId: candidate.id, codes: exclusionCodes });
      continue;
    }

    const nutrition = scoreNutrition(candidate, context, remainingNutrition);
    const healthContext = scoreHealthContext(
      candidate,
      context,
      remainingNutrition,
      inputFreshness.healthContext,
    );
    const mealResponse = scoreMealResponse(candidate, context);
    const componentScores: RankingComponentScores = {
      nutrition: nutrition.score,
      preference: scorePreference(candidate, context),
      quality: scoreQuality(candidate),
      variety: scoreVariety(candidate, context),
      delivery: scoreDelivery(candidate, context),
      value: scoreValue(candidate, context),
      micronutrients: scoreMicronutrients(candidate, context),
      healthContext: healthContext.score,
      mealResponse: mealResponse.score,
    };
    const baseScore = (
      (Object.keys(WEIGHTS) as Array<keyof RankingComponentScores>)
        .reduce((total, key) => total + componentScores[key] * WEIGHTS[key], 0)
    );
    const finalScore = Math.round(clamp(baseScore + mealResponse.adjustment));
    ranked.push({
      ...candidate,
      finalScore,
      mealResponseAdjustment: mealResponse.adjustment,
      componentScores,
      explanationCodes: explanationCodes(
        componentScores,
        nutrition,
        inputFreshness,
        healthContext.applied,
        mealResponse.applied,
      ),
      inputFreshness,
    });
  }

  ranked.sort((a, b) => b.finalScore - a.finalScore || a.id.localeCompare(b.id));
  excluded.sort((a, b) => a.mealId.localeCompare(b.mealId));
  return {
    engineVersion: MEAL_RANKING_ENGINE_VERSION,
    generatedAt: context.generatedAt,
    goalType: context.goalType ?? null,
    ranked,
    excluded,
    inputFreshness,
    activityAllowanceApplied: allowance,
    healthContextApplied: context.healthContext?.available === true
      && inputFreshness.healthContext === "fresh",
    healthContextCodes: context.healthContext?.available === true
      && inputFreshness.healthContext === "fresh"
      ? [...context.healthContext.explanationCodes].sort()
      : [],
    mealResponseApplied: ranked.some((meal) => meal.explanationCodes.includes("meal_response_history")),
    mealResponseMealIds: ranked
      .filter((meal) => meal.explanationCodes.includes("meal_response_history"))
      .map((meal) => meal.id)
      .sort(),
    remainingNutrition,
    offline: false,
  };
}

// Compatibility wrapper for legacy callers while ranking-v2 is rolled out.
export function scoreMeals(
  meals: MealRankingCandidate[],
  targets: NutritionTargets,
  prefs: TastePreferences,
  recentlyViewedMealIds: Set<string> = new Set(),
): MealRankingCandidate[] {
  const generatedAt = new Date(0).toISOString();
  return rankMealsV2(meals, {
    generatedAt,
    targets,
    consumed: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    preferences: prefs,
    userAllergenIds: [],
    recentMealIds: [...recentlyViewedMealIds],
    inputUpdatedAt: {
      goals: generatedAt,
      consumption: generatedAt,
      preferences: generatedAt,
      safety: generatedAt,
      availability: generatedAt,
      commercial: generatedAt,
    },
  }).ranked;
}
