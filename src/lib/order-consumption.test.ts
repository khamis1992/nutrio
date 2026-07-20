import { describe, expect, it } from "vitest";

import { scaleNutrition, type NutritionSnapshot } from "@/lib/order-consumption";

const meal: NutritionSnapshot = {
  meal_name: "Protein bowl",
  calories: 521,
  protein_g: 43,
  carbs_g: 61,
  fat_g: 17,
  fiber_g: 9,
  sugar_g: 6,
  sodium_mg: 480,
};

describe("scaleNutrition", () => {
  it("scales every tracked nutrient using the same portion", () => {
    expect(scaleNutrition(meal, 50)).toEqual({
      calories: 261,
      protein_g: 22,
      carbs_g: 31,
      fat_g: 9,
      fiber_g: 5,
      sugar_g: 3,
      sodium_mg: 240,
      saturated_fat_g: 0,
      cholesterol_mg: 0,
      potassium_mg: 0,
    });
  });

  it("clamps portions to the supported range", () => {
    expect(scaleNutrition(meal, -10).calories).toBe(0);
    expect(scaleNutrition(meal, 150).calories).toBe(521);
  });
});
