import type { BodyLoadResult, RecoveryReadiness } from "@/lib/health-readiness";
import type { MealCandidate } from "@/lib/recommendation-engine";

export interface NutritionPerformanceInput {
  caloriesConsumed: number;
  calorieTarget: number;
  proteinConsumed: number;
  proteinTarget: number;
  waterPercent: number;
  mealsLogged: number;
  mealsPlanned: number;
  remainingCalories: number;
  proteinGap: number;
  bodyLoad: BodyLoadResult;
  readiness: RecoveryReadiness;
}

export interface NutritionPerformanceResult {
  score: number;
  label: string;
  summary: string;
  primaryReason: string;
  reasons: string[];
  actionLabel: string;
  actionPath: string;
  mealNeed: {
    protein: number;
    calories: number;
    query: string;
    category: string;
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
  if (input.caloriesConsumed <= 0) {
    reasons.push("No calories logged yet, so the score is based on missing meal data.");
  } else if (input.remainingCalories < 0) {
    reasons.push(`Calories are ${Math.abs(Math.round(input.remainingCalories))} kcal over target.`);
  } else if (input.remainingCalories > input.calorieTarget * 0.45) {
    reasons.push(`${Math.round(input.remainingCalories)} kcal still unfilled for today.`);
  }

  if (input.proteinGap > 0) {
    reasons.push(`${Math.round(input.proteinGap)}g protein left to hit your target.`);
  }
  if (input.waterPercent < 80) {
    reasons.push(`Hydration is at ${Math.round(input.waterPercent)}%, below the daily target.`);
  }
  if (input.mealsLogged < Math.max(3, input.mealsPlanned || 0)) {
    reasons.push(`${input.mealsLogged} meal${input.mealsLogged === 1 ? "" : "s"} logged today.`);
  }
  if (input.bodyLoad.score >= 15) {
    reasons.push("High body load today means your next meal should support recovery.");
  }
  if ((input.readiness.score ?? 100) < 60) {
    reasons.push("Readiness is low, so recovery nutrition matters more today.");
  }

  const mealCalories = clamp(
    Math.round(input.remainingCalories > 0 ? Math.min(input.remainingCalories, 650) : 350),
    250,
    650
  );
  const mealProtein = clamp(Math.round(Math.max(25, Math.min(input.proteinGap || 25, 45))), 20, 50);
  const category = mealCalories < 350 ? "snacks" : new Date().getHours() >= 17 ? "dinner" : "lunch";
  const query = input.proteinGap > 20 ? "high-protein" : input.remainingCalories < 350 ? "light" : "balanced";

  const label = score >= 82 ? "Strong fuel" : score >= 65 ? "Almost on track" : score >= 45 ? "Needs support" : "Start fueling";
  const summary = score >= 82
    ? "Your nutrition supports today’s activity."
    : score >= 65
      ? "A small adjustment can finish the day well."
      : "Focus the next meal on protein, hydration, and calories.";

  return {
    score,
    label,
    summary,
    primaryReason: reasons[0] || "Calories, protein, hydration, and meal timing are aligned.",
    reasons: reasons.slice(0, 3),
    actionLabel: input.proteinGap > 20 ? "Find protein meal" : "Find matching meal",
    actionPath: `/meals?category=${category}&q=${encodeURIComponent(query)}&source=nutrition-performance`,
    mealNeed: {
      protein: mealProtein,
      calories: mealCalories,
      query,
      category,
    },
  };
}

export function findNutritionMatchedMeal(
  candidates: MealCandidate[],
  performance: NutritionPerformanceResult,
): NutritionMatchedMeal | null {
  if (!candidates.length) return null;

  const preferredType = performance.mealNeed.category;
  const calorieBudget = performance.mealNeed.calories;
  const proteinNeed = performance.mealNeed.protein;

  const scored = candidates
    .filter((meal) => meal.is_available !== false)
    .filter((meal) => typeof meal.calories === "number" && typeof meal.protein_g === "number")
    .map((meal) => {
      const calories = meal.calories ?? 0;
      const protein = meal.protein_g ?? 0;
      const calorieFit = Math.max(0, 1 - Math.abs(calories - calorieBudget) / Math.max(calorieBudget, 1));
      const proteinFit = Math.min(protein / Math.max(proteinNeed, 1), 1.25);
      const typeFit = meal.meal_type?.toLowerCase() === preferredType ? 1 : 0;
      const density = calories > 0 ? protein / calories : 0;
      const rating = Math.min(meal.rating || 0, 5) / 5;

      const matchScore = Math.round(
        calorieFit * 30 +
        Math.min(proteinFit, 1) * 35 +
        typeFit * 16 +
        Math.min(density * 120, 1) * 12 +
        rating * 7
      );

      const matchReason = `${Math.round(protein)}g protein / ${Math.round(calories)} kcal`;
      return { ...meal, matchScore, matchReason };
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  return scored[0] ?? null;
}
