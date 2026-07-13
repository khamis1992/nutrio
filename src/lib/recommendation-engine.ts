export interface MealCandidate {
  id: string;
  name: string;
  image_url: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  price: number | null;
  meal_type: string | null;
  restaurant_id: string | null;
  restaurant_name: string;
  restaurant_logo_url: string | null;
  rating: number;
  total_orders: number;
  is_available: boolean | null;
  ingredients: string | null;
}

export interface OrderHistoryItem {
  meal_id: string;
  meal_name: string;
  restaurant_id: string;
  meal_type: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  order_created_at: string;
}

export interface HealthGoals {
  daily_calorie_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
}

export interface ScoredMeal extends MealCandidate {
  score: number;
  reason: string;
}

function normalizeText(str: string | null): string {
  return (str || "").toLowerCase().trim();
}

function getHour(): number {
  return new Date().getHours();
}

function getMealTypeByHour(): string {
  const hour = getHour();
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 18) return "snacks";
  return "dinner";
}

function todayProgressFromLogs(
  logs: Array<{
    meal_type: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }>
): {
  caloriesConsumed: number;
  proteinConsumed: number;
  carbsConsumed: number;
  fatConsumed: number;
} {
  return logs.reduce(
    (acc, l) => ({
      caloriesConsumed: acc.caloriesConsumed + (l.calories || 0),
      proteinConsumed: acc.proteinConsumed + (l.protein_g || 0),
      carbsConsumed: acc.carbsConsumed + (l.carbs_g || 0),
      fatConsumed: acc.fatConsumed + (l.fat_g || 0),
    }),
    { caloriesConsumed: 0, proteinConsumed: 0, carbsConsumed: 0, fatConsumed: 0 }
  );
}

// ─── Section 1: Recommended For You (من أجلك) ──────────────────────────
export function recommendForYou(
  candidates: MealCandidate[],
  orders: OrderHistoryItem[],
  _healthGoals: HealthGoals | null
): ScoredMeal[] {
  if (candidates.length === 0) return [];

  const orderedIds = new Set(orders.map((o) => o.meal_id));
  const orderedRestaurantIds = new Set(orders.map((o) => o.restaurant_id));
  const avgOrderCalories =
    orders.length > 0
      ? orders.reduce((s, o) => s + (o.calories || 0), 0) / orders.length
      : 0;
  const avgOrderProtein =
    orders.length > 0
      ? orders.reduce((s, o) => s + (o.protein_g || 0), 0) / orders.length
      : 0;

  // Extract top ingredients from past orders
  const ingredientFreq: Record<string, number> = {};
  orders.forEach((o) => {
    const ings = o.meal_name.split(/[\s,]+/);
    ings.forEach((ing) => {
      const key = normalizeText(ing);
      if (key.length > 2) {
        ingredientFreq[key] = (ingredientFreq[key] || 0) + 1;
      }
    });
  });
  const topIngredients = Object.entries(ingredientFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k]) => k);

  const scored = candidates.map((meal) => {
    let score = 50;
    let reason = "بناءً على شعبية الوجبات";

    // 1. Re-order boost (familiarity)
    if (orderedIds.has(meal.id)) {
      score += 15;
      reason = "طلبته من قبل و أعجبك";
    }

    // 2. Restaurant loyalty
    if (meal.restaurant_id && orderedRestaurantIds.has(meal.restaurant_id)) {
      score += 10;
      if (!orderedIds.has(meal.id)) {
        reason = "من مطعم طلبته سابقاً";
      }
    }

    // 3. Ingredient match
    if (topIngredients.length > 0) {
      const mealWords = normalizeText(meal.name).split(/[\s,]+/);
      const matchCount = topIngredients.filter((ing) =>
        mealWords.some((mw) => mw.includes(ing) || ing.includes(mw))
      ).length;
      const ingScore = (matchCount / Math.max(topIngredients.length, 1)) * 20;
      score += ingScore;
      if (matchCount > 1) reason = "يحتوي على نكهات تحبها";
    }

    // 4. Calorie similarity to past orders
    if (avgOrderCalories > 0 && meal.calories) {
      const diff = Math.abs(meal.calories - avgOrderCalories) / avgOrderCalories;
      if (diff < 0.2) {
        score += 10;
        reason = "يطابق حجم وجباتك المعتادة";
      }
    }

    // 5. Protein similarity
    if (avgOrderProtein > 0 && meal.protein_g) {
      const diff = Math.abs(meal.protein_g - avgOrderProtein) / avgOrderProtein;
      if (diff < 0.3) score += 8;
    }

    // 6. Rating and popularity
    score += (meal.rating / 5) * 10;
    score += Math.min((meal.total_orders || 0) / 100, 10);

    return { ...meal, score: Math.min(99, Math.round(score)), reason };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, 8);
}

// ─── Section 2: Lunch Time / Meal Time (وقت الغداء) ─────────────────────
export function recommendByTime(
  candidates: MealCandidate[],
  _orders: OrderHistoryItem[],
  _healthGoals: HealthGoals | null
): ScoredMeal[] {
  if (candidates.length === 0) return [];

  const currentMealType = getMealTypeByHour();
  const mealTypeLabels: Record<string, string> = {
    breakfast: "إفطار",
    lunch: "غداء",
    snacks: "وجبة خفيفة",
    dinner: "عشاء",
  };

  const scored = candidates.map((meal) => {
    let score = 40;
    let reason = `وقت ${mealTypeLabels[currentMealType] || "الغداء"}`;

    // Strong boost for matching current meal type
    if (
      meal.meal_type &&
      meal.meal_type.toLowerCase() === currentMealType
    ) {
      score += 45;
      reason = `وقت ${mealTypeLabels[currentMealType]} المثالي`;
    }

    // Quick meals during work hours (lunch)
    const hour = getHour();
    if (hour >= 11 && hour <= 14 && meal.meal_type === "lunch") {
      score += 10;
    }

    // Popularity
    score += (meal.rating / 5) * 10;
    score += Math.min((meal.total_orders || 0) / 100, 5);

    return { ...meal, score: Math.min(99, Math.round(score)), reason };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, 6);
}

// ─── Section 3: Protein Goal (حقق هدف البروتين) ────────────────────────
export function recommendForProteinGoal(
  candidates: MealCandidate[],
  _orders: OrderHistoryItem[],
  healthGoals: HealthGoals | null,
  todayLogs: Array<{
    meal_type: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }>
): ScoredMeal[] {
  if (candidates.length === 0) return [];

  const progress = todayProgressFromLogs(todayLogs);
  const proteinTarget = healthGoals?.protein_target_g || 150;
  const proteinRemaining = Math.max(0, proteinTarget - progress.proteinConsumed);

  const scored = candidates.map((meal) => {
    let score = 30;
    let reason = "وجبة صحية متوازنة";

    const protein = meal.protein_g || 0;
    const calories = meal.calories || 0;

    // High protein density (protein per calorie)
    const proteinDensity = calories > 0 ? (protein / calories) * 100 : 0;
    score += Math.min(proteinDensity * 5, 40);

    // If protein is still needed, prioritize meals that help close the gap
    if (proteinRemaining > 0 && protein > 0) {
      const gapFillRatio = Math.min(protein / proteinRemaining, 1);
      score += gapFillRatio * 25;
      if (gapFillRatio > 0.5) {
        reason = `يحتوي على ${Math.round(protein)}g بروتين لمساعدتك في تحقيق هدفك`;
      }
    }

    // Lean protein preference (high protein, moderate calories)
    if (protein > 20 && calories < 600) {
      score += 10;
      if (!reason.includes("بروتين")) {
        reason = "بروتين عالي بسعرات معتدلة";
      }
    }

    // If already close to protein goal, don't over-recommend
    if (proteinRemaining <= 0 && protein > 30) {
      score -= 15;
      reason = "وصلت لهدف البروتين — وجبة متوازنة";
    }

    // General quality
    score += (meal.rating / 5) * 10;

    return { ...meal, score: Math.min(99, Math.round(score)), reason };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, 6);
}

// ─── Master orchestrator ──────────────────────────────────────────────
export interface RecommendationSections {
  forYou: ScoredMeal[];
  byTime: ScoredMeal[];
  forProtein: ScoredMeal[];
  currentMealType: string;
  proteinRemaining: number;
}

export function generateAllRecommendations(
  candidates: MealCandidate[],
  orders: OrderHistoryItem[],
  healthGoals: HealthGoals | null,
  todayLogs: Array<{
    meal_type: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }>
): RecommendationSections {
  return {
    forYou: recommendForYou(candidates, orders, healthGoals),
    byTime: recommendByTime(candidates, orders, healthGoals),
    forProtein: recommendForProteinGoal(candidates, orders, healthGoals, todayLogs),
    currentMealType: getMealTypeByHour(),
    proteinRemaining: Math.max(
      0,
      (healthGoals?.protein_target_g || 150) -
        todayLogs.reduce((s, l) => s + (l.protein_g || 0), 0)
    ),
  };
}
