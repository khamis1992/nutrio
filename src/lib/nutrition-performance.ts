import type { BodyLoadResult, RecoveryReadiness } from "@/lib/health-readiness";
import type { MealCandidate } from "@/lib/recommendation-engine";

export interface NutritionPerformanceInput {
  caloriesConsumed: number;
  calorieTarget: number;
  proteinConsumed: number;
  proteinTarget: number;
  carbsGap: number;
  carbsTarget: number;
  fatGap: number;
  fatTarget: number;
  waterPercent: number;
  mealsLogged: number;
  mealsPlanned: number;
  remainingCalories: number;
  proteinGap: number;
  bodyLoad: BodyLoadResult;
  readiness: RecoveryReadiness;
}

export interface NutritionPerformanceMessage {
  key: string;
  params?: Record<string, string | number>;
}

export interface NutritionPerformanceResult {
  score: number;
  label: string;
  summary: string;
  primaryReason: string;
  labelMessage?: NutritionPerformanceMessage;
  summaryMessage?: NutritionPerformanceMessage;
  primaryReasonMessage?: NutritionPerformanceMessage;
  reasons: string[];
  actionLabel: string;
  actionPath: string;
  mealNeed: {
    protein: number;
    calories: number;
    query: string;
    category: string;
    focus: "protein" | "carbs" | "hydration" | "calories" | "balanced";
  };
}

export interface NutritionMatchedMeal extends MealCandidate {
  matchScore: number;
  matchReason: string;
}

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

function calorieScore(consumed: number, target: number) {
  if (target <= 0) return 45;
  if (consumed <= 0) return 10;
  const ratio = consumed / target;
  if (ratio >= 0.85 && ratio <= 1.08) return 100;
  if (ratio < 0.85) return clamp(Math.round((ratio / 0.85) * 100), 20, 96);
  return clamp(Math.round(100 - ((ratio - 1.08) / 0.45) * 65), 25, 96);
}

function proteinScore(consumed: number, target: number) {
  if (target <= 0) return 45;
  return clamp(Math.round((consumed / target) * 100), 0, 100);
}

function mealConsistencyScore(logged: number, planned: number) {
  const targetMeals = Math.max(3, planned || 0);
  return clamp(Math.round((logged / targetMeals) * 100), 0, 100);
}

function activityFuelAdjustment(input: NutritionPerformanceInput) {
  if (input.bodyLoad.score >= 15 && input.proteinGap > 20) return -8;
  if (input.bodyLoad.score >= 15 && input.remainingCalories < 250) return -7;
  if ((input.readiness.score ?? 100) < 60 && input.waterPercent < 70) return -6;
  if (input.bodyLoad.score >= 8 && input.proteinGap <= 15 && input.waterPercent >= 80) return 5;
  return 0;
}

export function calculateNutritionPerformance(input: NutritionPerformanceInput): NutritionPerformanceResult {
  if (input.calorieTarget <= 0 || input.proteinTarget <= 0) {
    return {
      score: 0,
      label: "Needs a nutrition goal",
      summary: "Set your calorie and protein targets to unlock a personalized readiness score.",
      primaryReason: "No saved nutrition target is available for this calculation.",
      labelMessage: { key: "nutrition_performance_needs_goal" },
      summaryMessage: { key: "nutrition_performance_set_goal_summary" },
      primaryReasonMessage: { key: "nutrition_performance_no_target" },
      reasons: ["No saved nutrition target is available for this calculation."],
      actionLabel: "Set nutrition goal",
      actionPath: "/progress?tab=goals",
      mealNeed: {
        protein: 0,
        calories: 0,
        query: "",
        category: "",
        focus: "balanced",
      },
    };
  }

  const calories = calorieScore(input.caloriesConsumed, input.calorieTarget);
  const protein = proteinScore(input.proteinConsumed, input.proteinTarget);
  const hydration = clamp(Math.round(input.waterPercent), 0, 100);
  const meals = mealConsistencyScore(input.mealsLogged, input.mealsPlanned);
  const activityAdjustment = activityFuelAdjustment(input);
  const score = clamp(Math.round(
    calories * 0.34 +
    protein * 0.32 +
    hydration * 0.18 +
    meals * 0.16 +
    activityAdjustment
  ));

  const reasons: string[] = [];
  const reasonMessages: NutritionPerformanceMessage[] = [];
  const addReason = (text: string, message: NutritionPerformanceMessage) => {
    reasons.push(text);
    reasonMessages.push(message);
  };
  if (input.caloriesConsumed <= 0) {
    addReason(
      "No calories logged yet, so the score is based on missing meal data.",
      { key: "nutrition_performance_reason_no_calories" },
    );
  } else if (input.remainingCalories < 0) {
    const amount = Math.abs(Math.round(input.remainingCalories));
    addReason(
      `Calories are ${amount} Cal over target.`,
      { key: "nutrition_performance_reason_over_target", params: { amount } },
    );
  } else if (input.remainingCalories > input.calorieTarget * 0.45) {
    const amount = Math.round(input.remainingCalories);
    addReason(
      `${amount} Cal still unfilled for today.`,
      { key: "nutrition_performance_reason_unfilled", params: { amount } },
    );
  }

  if (input.proteinGap > 0) {
    const amount = Math.round(input.proteinGap);
    addReason(
      `${amount}g protein left to hit your target.`,
      { key: "nutrition_performance_reason_protein_gap", params: { amount } },
    );
  }
  if (input.waterPercent < 80) {
    const percent = Math.round(input.waterPercent);
    addReason(
      `Hydration is at ${percent}%, below the daily target.`,
      { key: "nutrition_performance_reason_hydration", params: { percent } },
    );
  }
  if (input.mealsLogged < Math.max(3, input.mealsPlanned || 0)) {
    addReason(
      `${input.mealsLogged} meal${input.mealsLogged === 1 ? "" : "s"} logged today.`,
      { key: "nutrition_performance_reason_meals_logged", params: { count: input.mealsLogged } },
    );
  }
  if (input.bodyLoad.score >= 15) {
    addReason(
      "High body load today means your next meal should support recovery.",
      { key: "nutrition_performance_reason_body_load" },
    );
  }
  if ((input.readiness.score ?? 100) < 60) {
    addReason(
      "Readiness is low, so recovery nutrition matters more today.",
      { key: "nutrition_performance_reason_readiness" },
    );
  }

  const mealCalories = clamp(
    Math.round(input.remainingCalories > 0 ? Math.min(input.remainingCalories, 650) : 350),
    250,
    650
  );
  const mealProtein = clamp(Math.round(Math.max(25, Math.min(input.proteinGap || 25, 45))), 20, 50);
  const category = mealCalories < 350 ? "snacks" : new Date().getHours() >= 17 ? "dinner" : "lunch";
  const proteinGapRatio = input.proteinTarget > 0 ? input.proteinGap / input.proteinTarget : 0;
  const carbsGapRatio = input.carbsTarget > 0 ? input.carbsGap / input.carbsTarget : 0;
  const fatGapRatio = input.fatTarget > 0 ? input.fatGap / input.fatTarget : 0;
  const focus =
    input.waterPercent < 70 && input.remainingCalories < 350
      ? "hydration"
      : proteinGapRatio >= 0.18 && proteinGapRatio >= carbsGapRatio
        ? "protein"
        : carbsGapRatio >= 0.22 && carbsGapRatio >= fatGapRatio
          ? "carbs"
          : input.remainingCalories > input.calorieTarget * 0.35
            ? "calories"
            : "balanced";
  const query = focus === "protein"
    ? "high-protein"
    : focus === "carbs"
      ? "carbs"
      : focus === "hydration"
        ? "light fresh"
        : focus === "calories"
          ? "balanced bowl"
          : "balanced";

  const label = score >= 82 ? "Strong fuel" : score >= 65 ? "Almost on track" : score >= 45 ? "Needs support" : "Start fueling";
  const labelMessage: NutritionPerformanceMessage = {
    key: score >= 82
      ? "nutrition_performance_strong_fuel"
      : score >= 65
        ? "nutrition_performance_almost_on_track"
        : score >= 45
          ? "nutrition_performance_needs_support"
          : "nutrition_performance_start_fueling",
  };
  const summary = score >= 82
    ? "Your nutrition supports today’s activity."
    : score >= 65
      ? "A small adjustment can finish the day well."
      : focus === "carbs"
        ? "Focus the next meal on smart carbs and steady energy."
        : focus === "hydration"
          ? "Focus the next meal on hydration and lighter foods."
          : focus === "calories"
            ? "Focus the next meal on balanced calories."
            : "Focus the next meal on protein, hydration, and calories.";
  const summaryMessage: NutritionPerformanceMessage = {
    key: score >= 82
      ? "nutrition_performance_summary_strong"
      : score >= 65
        ? "nutrition_performance_summary_almost"
        : focus === "carbs"
          ? "nutrition_performance_summary_carbs"
          : focus === "hydration"
            ? "nutrition_performance_summary_hydration"
            : focus === "calories"
              ? "nutrition_performance_summary_calories"
              : "nutrition_performance_summary_general",
  };
  const primaryReasonMessage = reasonMessages[0] || { key: "nutrition_performance_reason_aligned" };

  return {
    score,
    label,
    summary,
    primaryReason: reasons[0] || "Calories, protein, hydration, and meal timing are aligned.",
    labelMessage,
    summaryMessage,
    primaryReasonMessage,
    reasons: reasons.slice(0, 3),
    actionLabel: focus === "protein"
      ? "Find protein meal"
      : focus === "carbs"
        ? "Find carb meal"
        : focus === "hydration"
          ? "Find light meal"
          : "Find matching meal",
    actionPath: `/meals?category=${category}&q=${encodeURIComponent(query)}&source=nutrition-performance`,
    mealNeed: {
      protein: mealProtein,
      calories: mealCalories,
      query,
      category,
      focus,
    },
  };
}

export function findNutritionMatchedMeal(
  candidates: MealCandidate[],
  performance: NutritionPerformanceResult,
): NutritionMatchedMeal | null {
  if (!candidates.length || performance.mealNeed.calories <= 0 || performance.mealNeed.protein <= 0) return null;

  const preferredType = performance.mealNeed.category;
  const calorieBudget = performance.mealNeed.calories;
  const proteinNeed = performance.mealNeed.protein;
  const focus = performance.mealNeed.focus;

  const scored = candidates
    .filter((meal) => meal.is_available !== false)
    .filter((meal) => typeof meal.calories === "number" && typeof meal.protein_g === "number")
    .map((meal) => {
      const calories = meal.calories ?? 0;
      const protein = meal.protein_g ?? 0;
      const carbs = meal.carbs_g ?? 0;
      const calorieFit = Math.max(0, 1 - Math.abs(calories - calorieBudget) / Math.max(calorieBudget, 1));
      const proteinFit = Math.min(protein / Math.max(proteinNeed, 1), 1.25);
      const carbEnergyFit = calories > 0 ? Math.min(carbs / Math.max(calories / 10, 1), 1.25) : 0;
      const lightHydrationFit = Math.max(0, 1 - Math.max(calories - 380, 0) / 300);
      const typeFit = meal.meal_type?.toLowerCase() === preferredType ? 1 : 0;
      const density = calories > 0 ? protein / calories : 0;
      const rating = Math.min(meal.rating || 0, 5) / 5;

      const matchScore = Math.round(
        calorieFit * 28 +
        (focus === "protein" ? Math.min(proteinFit, 1) * 34 : Math.min(proteinFit, 1) * 18) +
        (focus === "carbs" ? Math.min(carbEnergyFit, 1) * 30 : 0) +
        (focus === "hydration" ? lightHydrationFit * 26 : 0) +
        typeFit * 16 +
        Math.min(density * 120, 1) * (focus === "protein" ? 12 : 6) +
        rating * 7
      );

      const matchReason = focus === "carbs"
        ? `${Math.round(carbs)}g carbs / ${Math.round(calories)} kcal`
        : focus === "hydration"
          ? `Light option / ${Math.round(calories)} kcal`
          : focus === "calories"
            ? `${Math.round(calories)} kcal / ${Math.round(protein)}g protein`
            : `${Math.round(protein)}g protein / ${Math.round(calories)} kcal`;
      return { ...meal, matchScore, matchReason };
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  return scored[0] ?? null;
}
