export interface Micronutrients {
  fiber_g?: number | null;
  sugar_g?: number | null;
  sodium_mg?: number | null;
  saturated_fat_g?: number | null;
  cholesterol_mg?: number | null;
  potassium_mg?: number | null;
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

export function finiteOptionalNutritionValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function normalizeNutrition(
  facts: Partial<Record<keyof NutritionFacts, unknown>>,
): NutritionFacts {
  return {
    calories: finiteNutritionValue(facts.calories),
    protein_g: finiteNutritionValue(facts.protein_g),
    carbs_g: finiteNutritionValue(facts.carbs_g),
    fat_g: finiteNutritionValue(facts.fat_g),
    fiber_g: finiteOptionalNutritionValue(facts.fiber_g),
    sugar_g: finiteOptionalNutritionValue(facts.sugar_g),
    sodium_mg: finiteOptionalNutritionValue(facts.sodium_mg),
    saturated_fat_g: finiteOptionalNutritionValue(facts.saturated_fat_g),
    cholesterol_mg: finiteOptionalNutritionValue(facts.cholesterol_mg),
    potassium_mg: finiteOptionalNutritionValue(facts.potassium_mg),
  };
}
