import { describe, expect, it } from "vitest";
import { calculateNutritionPerformance, findNutritionMatchedMeal } from "@/lib/nutrition-performance";

const baseInput = {
  caloriesConsumed: 1800,
  calorieTarget: 2000,
  proteinConsumed: 125,
  proteinTarget: 140,
  waterPercent: 90,
  mealsLogged: 3,
  mealsPlanned: 3,
  remainingCalories: 200,
  proteinGap: 15,
  bodyLoad: { score: 8, labelKey: "body_load_balanced", detailKey: "body_load_balanced_desc" },
  readiness: {
    score: 82,
    labelKey: "readiness_ready",
    detailKey: "readiness_ready_desc",
    enoughData: true,
    signals: { movement: 80, cardio: 84, sleep: 82 },
  },
};

describe("calculateNutritionPerformance", () => {
  it("returns a strong score when calories, protein, hydration, and meals are aligned", () => {
    const result = calculateNutritionPerformance(baseInput);

    expect(result.score).toBeGreaterThanOrEqual(82);
    expect(result.label).toBe("Strong fuel");
    expect(result.actionPath).toContain("/meals");
  });

  it("explains low confidence when protein and hydration are behind", () => {
    const result = calculateNutritionPerformance({
      ...baseInput,
      caloriesConsumed: 700,
      proteinConsumed: 35,
      waterPercent: 35,
      mealsLogged: 1,
      remainingCalories: 1300,
      proteinGap: 105,
      bodyLoad: { score: 16, labelKey: "body_load_high", detailKey: "body_load_high_desc" },
      readiness: { ...baseInput.readiness, score: 52 },
    });

    expect(result.score).toBeLessThan(65);
    expect(result.reasons.join(" ")).toContain("protein");
    expect(result.reasons.join(" ")).toContain("Hydration");
    expect(result.mealNeed.protein).toBeGreaterThanOrEqual(40);
  });

  it("matches a real meal candidate to the current protein and calorie need", () => {
    const performance = calculateNutritionPerformance({
      ...baseInput,
      caloriesConsumed: 900,
      proteinConsumed: 70,
      remainingCalories: 600,
      proteinGap: 70,
    });

    const match = findNutritionMatchedMeal([
      {
        id: "light-salad",
        name: "Light Salad",
        image_url: null,
        calories: 220,
        protein_g: 8,
        carbs_g: 20,
        fat_g: 8,
        price: 30,
        meal_type: "snacks",
        restaurant_id: "r1",
        restaurant_name: "Test Kitchen",
        restaurant_logo_url: null,
        rating: 4.3,
        total_orders: 20,
        is_available: true,
        ingredients: null,
      },
      {
        id: "chicken-bowl",
        name: "Grilled Chicken Bowl",
        image_url: "/meal.jpg",
        calories: 610,
        protein_g: 42,
        carbs_g: 55,
        fat_g: 18,
        price: 48,
        meal_type: "lunch",
        restaurant_id: "r2",
        restaurant_name: "Protein House",
        restaurant_logo_url: null,
        rating: 4.8,
        total_orders: 100,
        is_available: true,
        ingredients: null,
      },
    ], performance);

    expect(match?.id).toBe("chicken-bowl");
    expect(match?.matchReason).toContain("42g protein");
  });
});
