import { describe, expect, it } from "vitest";

import {
  MEAL_RANKING_ENGINE_VERSION,
  normalizeMealResponseRankingInput,
  rankMealsV2,
  selectMealRecommendationEngine,
  type MealRankingCandidate,
  type MealRankingContext,
  type MealResponseRankingEvidence,
} from "@/lib/mealRanking";

const now = "2026-07-19T09:00:00.000Z";

const meal = (overrides: Partial<MealRankingCandidate> = {}): MealRankingCandidate => ({
  id: "meal-a",
  name: "Chicken Bowl",
  calories: 550,
  image_url: null,
  restaurant_id: "restaurant-1",
  is_available: true,
  restaurant_name: "Kitchen",
  restaurant_logo_url: null,
  restaurant_rating: 4.6,
  restaurant_total_orders: 300,
  price: 35,
  protein_g: 42,
  carbs_g: 55,
  fat_g: 16,
  fiber_g: 8,
  sodium_mg: 500,
  meal_type: "lunch",
  restaurantValid: true,
  allergenIds: [],
  dietTagIds: ["halal"],
  medicineConflictCodes: [],
  creditEligible: true,
  deliveryAvailable: true,
  deliveryMinutes: 25,
  ...overrides,
});

const context = (overrides: Partial<MealRankingContext> = {}): MealRankingContext => ({
  generatedAt: now,
  targets: {
    dailyCalories: 2200,
    proteinTarget: 160,
    carbsTarget: 220,
    fatTarget: 70,
    fiberTarget: 30,
    sodiumLimitMg: 2300,
  },
  consumed: { calories: 900, protein: 55, carbs: 90, fat: 28, fiber: 8, sodiumMg: 700 },
  preferences: {
    preferredRestaurants: ["restaurant-1"],
    favoriteMealTypes: ["lunch"],
    dietaryRestrictions: ["halal"],
  },
  userAllergenIds: ["nuts"],
  recentMealIds: [],
  recentMealTypes: [],
  activity: { caloriesBurned: 800, measuredAt: now },
  commercial: { mode: "flexible", remainingCredits: 2, maxPrice: 50, walletOrCardAvailable: true },
  delivery: { maxMinutes: 60 },
  inputUpdatedAt: {
    goals: now,
    consumption: now,
    preferences: now,
    safety: now,
    availability: now,
    commercial: now,
  },
  ...overrides,
});

describe("rankMealsV2", () => {
  it("selects legacy by default and V2 only when its flag is enabled", () => {
    expect(selectMealRecommendationEngine(false)).toBe("legacy");
    expect(selectMealRecommendationEngine(true)).toBe("v2");
  });

  it("is deterministic and uses meal id as the final tie-breaker", () => {
    const candidates = [meal({ id: "meal-b" }), meal({ id: "meal-a" })];
    const first = rankMealsV2(candidates, context());
    const second = rankMealsV2([...candidates].reverse(), context());

    expect(first.engineVersion).toBe(MEAL_RANKING_ENGINE_VERSION);
    expect(first.ranked.map((item) => item.id)).toEqual(["meal-a", "meal-b"]);
    expect(second).toEqual(first);
  });

  it("applies hard gates before scoring in the contracted order", () => {
    const unsafe = meal({
      id: "unsafe",
      is_available: false,
      restaurantValid: false,
      allergenIds: ["nuts"],
      medicineConflictCodes: ["grapefruit"],
      dietTagIds: [],
      creditEligible: false,
      deliveryAvailable: false,
    });
    const result = rankMealsV2([unsafe], context({
      commercial: { mode: "credits_only", remainingCredits: 0, maxPrice: null },
    }));

    expect(result.ranked).toHaveLength(0);
    expect(result.excluded[0].codes).toEqual([
      "unavailable",
      "restaurant_invalid",
      "allergen_conflict",
      "medicine_conflict",
      "diet_rule_mismatch",
      "commercially_ineligible",
      "delivery_window_unavailable",
    ]);
  });

  it("fails closed when delivery availability is unknown", () => {
    const result = rankMealsV2(
      [meal({ deliveryAvailable: null, deliveryMinutes: null })],
      context(),
    );

    expect(result.ranked).toHaveLength(0);
    expect(result.excluded[0].codes).toContain("delivery_window_unavailable");
  });

  it("caps activity allowance and ignores stale activity", () => {
    const fresh = rankMealsV2([meal()], context());
    const stale = rankMealsV2([meal()], context({
      activity: { caloriesBurned: 800, measuredAt: "2026-07-17T08:00:00.000Z" },
    }));

    expect(fresh.activityAllowanceApplied).toBe(300);
    expect(fresh.remainingNutrition).toEqual({ calories: 1600, protein: 105, carbs: 130, fat: 42 });
    expect(stale.activityAllowanceApplied).toBe(0);
    expect(stale.ranked[0].explanationCodes).toContain("stale_activity");
  });

  it("returns a fully decomposable score", () => {
    const ranked = rankMealsV2([meal()], context()).ranked[0];
    const recomposed = Math.round(
      ranked.componentScores.nutrition * 0.37
      + ranked.componentScores.preference * 0.14
      + ranked.componentScores.quality * 0.09
      + ranked.componentScores.variety * 0.09
      + ranked.componentScores.delivery * 0.09
      + ranked.componentScores.value * 0.09
      + ranked.componentScores.micronutrients * 0.05
      + ranked.componentScores.healthContext * 0.08
      + ranked.mealResponseAdjustment,
    );
    expect(ranked.finalScore).toBe(recomposed);
    expect(ranked.explanationCodes.length).toBeGreaterThan(0);
  });

  it("uses the active goal type and only measured micronutrients", () => {
    const muscleGain = rankMealsV2(
      [meal({ protein_g: 80, calories: 600 })],
      context({
        goalType: "muscle_gain",
        consumed: {
          calories: 900,
          protein: 55,
          carbs: 90,
          fat: 28,
          fiber: 8,
          sodiumMg: 700,
          measuredNutrientCodes: ["fiber_g", "sodium_mg"],
        },
      }),
    );
    const missing = rankMealsV2(
      [meal({ nutrientMissingCodes: ["fiber_g", "sodium_mg"] })],
      context({
        goalType: "weight_loss",
        consumed: {
          calories: 900,
          protein: 55,
          carbs: 90,
          fat: 28,
          measuredNutrientCodes: [],
          missingNutrientCodes: ["fiber_g", "sodium_mg"],
        },
      }),
    );

    expect(muscleGain.goalType).toBe("muscle_gain");
    expect(muscleGain.ranked[0].componentScores.micronutrients).not.toBe(50);
    expect(missing.goalType).toBe("weight_loss");
    expect(missing.ranked[0].componentScores.micronutrients).toBe(50);
  });

  it("discloses missing safety data without claiming it is fresh", () => {
    const result = rankMealsV2([meal()], context({
      inputUpdatedAt: { goals: now, consumption: now, availability: now, commercial: now },
    }));
    expect(result.inputFreshness.safety).toBe("missing");
    expect(result.ranked[0].explanationCodes).toContain("missing_safety_data");
  });

  it("excludes a meal when neither a plan credit nor wallet purchase is eligible", () => {
    const result = rankMealsV2(
      [meal({ creditEligible: false, walletPurchaseEligible: false })],
      context({
        commercial: {
          mode: "flexible",
          remainingCredits: 0,
          maxPrice: null,
          walletOrCardAvailable: true,
        },
      }),
    );

    expect(result.ranked).toHaveLength(0);
    expect(result.excluded[0].codes).toContain("commercially_ineligible");
  });

  it("allows a meal that can be funded by an eligible wallet purchase", () => {
    const result = rankMealsV2(
      [meal({ creditEligible: false, walletPurchaseEligible: true })],
      context({
        commercial: {
          mode: "flexible",
          remainingCredits: 0,
          maxPrice: null,
          walletOrCardAvailable: true,
        },
      }),
    );

    expect(result.ranked).toHaveLength(1);
    expect(result.ranked[0].componentScores.value).toBe(70);
  });

  it("uses only fresh, consented health context as a bounded soft score", () => {
    const result = rankMealsV2(
      [
        meal({ id: "lighter", calories: 350 }),
        meal({ id: "larger", calories: 800 }),
      ],
      context({
        healthContext: {
          available: true,
          sourceDate: "2026-07-19",
          freshnessDays: 0,
          mood: 3,
          stress: 3,
          appetite: 2,
          energy: 3,
          digestiveSymptoms: [],
          symptomSeverity: 0,
          cyclePhase: null,
          explanationCodes: ["context.low_appetite"],
        },
      }),
    );

    const lighter = result.ranked.find((candidate) => candidate.id === "lighter");
    const larger = result.ranked.find((candidate) => candidate.id === "larger");
    expect(result.healthContextApplied).toBe(true);
    expect(result.healthContextCodes).toEqual(["context.low_appetite"]);
    expect(lighter?.componentScores.healthContext).toBeGreaterThan(
      larger?.componentScores.healthContext ?? 0,
    );
    expect(lighter?.explanationCodes).toContain("health_context_fit");
  });

  it("keeps health context neutral when the user did not opt in", () => {
    const result = rankMealsV2([meal()], context({ healthContext: null }));
    expect(result.healthContextApplied).toBe(false);
    expect(result.healthContextCodes).toEqual([]);
    expect(result.ranked[0].componentScores.healthContext).toBe(50);
    expect(result.ranked[0].explanationCodes).not.toContain("health_context_fit");
  });

  it("applies only qualifying published meal-response evidence with a three-point cap", () => {
    const result = rankMealsV2(
      [meal({ id: "meal-a" }), meal({ id: "meal-b" })],
      context({
        mealResponse: {
          enabled: true,
          generatedAt: now,
          meals: [{
            mealId: "meal-b",
            outcomeType: "glucose_peak_delta",
            estimateValue: 0,
            evidenceTier: "strong",
            sourceKind: "measured",
            eligibleEpisodeCount: 8,
            evidenceWeight: 1,
            publishedAt: "2026-07-19T08:00:00.000Z",
            expiresAt: "2026-08-19T08:00:00.000Z",
          }],
        },
      }),
    );

    const personalized = result.ranked.find((candidate) => candidate.id === "meal-b");
    expect(personalized?.componentScores.mealResponse).toBe(100);
    expect(personalized?.mealResponseAdjustment).toBe(3);
    expect(personalized?.explanationCodes).toContain("meal_response_history");
    expect(result.mealResponseApplied).toBe(true);
    expect(result.mealResponseMealIds).toEqual(["meal-b"]);
  });

  it.each([
    ["consent disabled", { enabled: false }],
    ["predicted only", { evidence: { sourceKind: "predicted" } }],
    ["low confidence", { evidence: { evidenceWeight: 0.64 } }],
    ["too few episodes", { evidence: { eligibleEpisodeCount: 4 } }],
    ["expired", { evidence: { expiresAt: "2026-07-19T08:59:59.000Z" } }],
  ])("keeps meal-response scoring neutral when %s", (_label, override) => {
    const typedOverride = override as {
      enabled?: boolean;
      evidence?: Partial<MealResponseRankingEvidence>;
    };
    const evidence = {
      mealId: "meal-a",
      outcomeType: "glucose_peak_delta",
      estimateValue: 0,
      evidenceTier: "moderate" as const,
      sourceKind: "measured" as const,
      eligibleEpisodeCount: 5,
      evidenceWeight: 0.65,
      publishedAt: "2026-07-19T08:00:00.000Z",
      expiresAt: "2026-08-19T08:00:00.000Z",
      ...(typedOverride.evidence ?? {}),
    };
    const result = rankMealsV2([meal()], context({
      mealResponse: {
        enabled: typedOverride.enabled ?? true,
        generatedAt: now,
        meals: [evidence],
      },
    }));

    expect(result.ranked[0].componentScores.mealResponse).toBe(50);
    expect(result.ranked[0].mealResponseAdjustment).toBe(0);
    expect(result.ranked[0].explanationCodes).not.toContain("meal_response_history");
    expect(result.mealResponseApplied).toBe(false);
  });

  it("normalizes the RPC contract and rejects malformed rows", () => {
    const normalized = normalizeMealResponseRankingInput({
      enabled: true,
      generated_at: now,
      meals: [
        {
          meal_id: "meal-a",
          outcome_type: "glucose_peak_delta",
          estimate_value: "22",
          evidence_tier: "moderate",
          source_kind: "measured",
          eligible_episode_count: 5,
          evidence_weight: 0.65,
          published_at: "2026-07-19T08:00:00.000Z",
          expires_at: null,
        },
        { meal_id: "malformed" },
      ],
    });

    expect(normalized.enabled).toBe(true);
    expect(normalized.meals).toHaveLength(1);
    expect(normalized.meals[0]).toMatchObject({ mealId: "meal-a", estimateValue: 22 });
  });

  it("does not let meal-response evidence bypass hard exclusions", () => {
    const result = rankMealsV2([meal({ is_available: false })], context({
      mealResponse: {
        enabled: true,
        generatedAt: now,
        meals: [{
          mealId: "meal-a",
          outcomeType: "glucose_peak_delta",
          estimateValue: 0,
          evidenceTier: "strong",
          sourceKind: "measured",
          eligibleEpisodeCount: 8,
          evidenceWeight: 1,
          publishedAt: "2026-07-19T08:00:00.000Z",
          expiresAt: null,
        }],
      },
    }));

    expect(result.ranked).toHaveLength(0);
    expect(result.excluded[0].codes).toContain("unavailable");
  });
});
