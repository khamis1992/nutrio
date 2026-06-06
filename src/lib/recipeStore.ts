import { getIngredient } from "./ingredientCatalog";

export interface RecipeIngredient {
  ingredientId: string;
  ingredientName: string;
  amount_g: number;
  category: string;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  servings: number;
  ingredients: RecipeIngredient[];
  instructions: string;
  image_emoji: string;
  calories_per_serving: number;
  protein_per_serving: number;
  carbs_per_serving: number;
  fat_per_serving: number;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "nutrio_recipes";

function generateId(): string {
  return `recipe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getRecipes(): Recipe[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch { /* fall through */ }
  }
  return [];
}

function saveRecipes(recipes: Recipe[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
}

function calculateNutrition(ingredients: RecipeIngredient[], servings: number) {
  let totalCal = 0, totalPro = 0, totalCarb = 0, totalFat = 0;
  for (const ri of ingredients) {
    const ing = getIngredient(ri.ingredientId);
    if (!ing) continue;
    const factor = ri.amount_g / 100;
    totalCal += ing.calories_per_100g * factor;
    totalPro += ing.protein_per_100g * factor;
    totalCarb += ing.carbs_per_100g * factor;
    totalFat += ing.fat_per_100g * factor;
  }
  const s = Math.max(1, servings);
  return {
    calories_per_serving: Math.round(totalCal / s),
    protein_per_serving: Math.round(totalPro / s),
    carbs_per_serving: Math.round(totalCarb / s),
    fat_per_serving: Math.round(totalFat / s),
  };
}

export function createRecipe(
  data: Omit<Recipe, "id" | "createdAt" | "updatedAt" | "calories_per_serving" | "protein_per_serving" | "carbs_per_serving" | "fat_per_serving">
): Recipe {
  const nutrition = calculateNutrition(data.ingredients, data.servings);
  const recipe: Recipe = {
    ...data,
    ...nutrition,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const recipes = [recipe, ...getRecipes()];
  saveRecipes(recipes);
  return recipe;
}

export function updateRecipe(id: string, updates: Partial<Recipe>): Recipe | null {
  const recipes = getRecipes();
  const idx = recipes.findIndex((r) => r.id === id);
  if (idx === -1) return null;

  const merged = { ...recipes[idx], ...updates, updatedAt: new Date().toISOString() };
  if (updates.ingredients || updates.servings !== undefined) {
    const nutrition = calculateNutrition(merged.ingredients, merged.servings);
    Object.assign(merged, nutrition);
  }
  recipes[idx] = merged;
  saveRecipes(recipes);
  return merged;
}

export function deleteRecipe(id: string): boolean {
  const recipes = getRecipes().filter((r) => r.id !== id);
  saveRecipes(recipes);
  return true;
}

export function getRecipe(id: string): Recipe | undefined {
  return getRecipes().find((r) => r.id === id);
}
