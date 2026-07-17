export interface Micronutrients {
  fiber_g?: number;
  sugar_g?: number;
  sodium_mg?: number;
  saturated_fat_g?: number;
  cholesterol_mg?: number;
  potassium_mg?: number;
}

export interface NutritionFacts extends Micronutrients {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export const EMPTY_NUTRITION: NutritionFacts = {
  calories: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
};

export function finiteNutritionValue(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function normalizeNutrition(
  facts: Partial<Record<keyof NutritionFacts, unknown>>,
): NutritionFacts {
  return {
    calories: finiteNutritionValue(facts.calories),
    protein_g: finiteNutritionValue(facts.protein_g),
    carbs_g: finiteNutritionValue(facts.carbs_g),
    fat_g: finiteNutritionValue(facts.fat_g),
    fiber_g: finiteNutritionValue(facts.fiber_g),
    sugar_g: finiteNutritionValue(facts.sugar_g),
    sodium_mg: finiteNutritionValue(facts.sodium_mg),
    saturated_fat_g: finiteNutritionValue(facts.saturated_fat_g),
    cholesterol_mg: finiteNutritionValue(facts.cholesterol_mg),
    potassium_mg: finiteNutritionValue(facts.potassium_mg),
  };
}
