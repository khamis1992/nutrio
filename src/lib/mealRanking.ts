interface MealRankingResult {
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
  meal_type: string | null;
}

interface NutritionTargets {
  dailyCalories: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
}

interface TastePreferences {
  preferredRestaurants: string[];
  favoriteMealTypes: string[];
  dietaryRestrictions: string[];
}

function tasteMatchScore(meal: MealRankingResult, prefs: TastePreferences): number {
  let score = 0.5;

  if (prefs.preferredRestaurants.includes(meal.restaurant_id ?? "")) {
    score += 0.2;
  }

  if (meal.meal_type && prefs.favoriteMealTypes.includes(meal.meal_type)) {
    score += 0.15;
  }

  if (meal.restaurant_rating > 4.5) score += 0.1;
  else if (meal.restaurant_rating > 4.0) score += 0.05;

  return score;
}

function nutritionAlignmentScore(meal: MealRankingResult, targets: NutritionTargets): number {
  let score = 0.5;

  if (meal.calories) {
    const ratio = meal.calories / targets.dailyCalories;
    if (ratio >= 0.15 && ratio <= 0.35) {
      score += 0.3;
    } else if (ratio >= 0.1 && ratio <= 0.4) {
      score += 0.15;
    }
  }

  if (meal.protein_g && targets.proteinTarget) {
    const proteinRatio = meal.protein_g / (targets.proteinTarget / 3);
    if (proteinRatio >= 0.7 && proteinRatio <= 1.3) {
      score += 0.1;
    }
  }

  return score;
}

function popularityScore(meal: MealRankingResult, maxOrders: number): number {
  if (maxOrders <= 0) return 0;
  return (meal.restaurant_total_orders / maxOrders) * 0.5;
}

function diversityScore(meal: MealRankingResult, alreadySelectedMealTypes: Set<string>): number {
  if (!meal.meal_type) return 0;
  if (alreadySelectedMealTypes.has(meal.meal_type)) return 0;
  return 0.1;
}

function freshnessScore(meal: MealRankingResult, recentlyViewedMealIds: Set<string>): number {
  if (recentlyViewedMealIds.has(meal.id)) return -2;
  return 0;
}

export function scoreMeals(
  meals: MealRankingResult[],
  targets: NutritionTargets,
  prefs: TastePreferences,
  recentlyViewedMealIds: Set<string> = new Set(),
): MealRankingResult[] {
  const maxOrders = Math.max(...meals.map((m) => m.restaurant_total_orders), 1);
  const selectedTypes = new Set<string>();

  const scored = meals.map((meal) => {
    const taste = tasteMatchScore(meal, prefs);
    const nutrition = nutritionAlignmentScore(meal, targets);
    const popularity = popularityScore(meal, maxOrders);
    const diversity = diversityScore(meal, selectedTypes);
    const freshness = freshnessScore(meal, recentlyViewedMealIds);

    const weightedScore =
      0.4 * taste +
      0.3 * nutrition +
      0.2 * popularity +
      0.1 * diversity +
      freshness;

    if (meal.meal_type) {
      selectedTypes.add(meal.meal_type);
    }

    return { meal, score: weightedScore };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.map((s) => s.meal);
}
