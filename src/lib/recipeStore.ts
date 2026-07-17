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

const LEGACY_STORAGE_KEY = "nutrio_recipes";
const STORAGE_PREFIX = "nutrio:recipes:v2:";
const MAX_RECIPES = 100;

function storageKey(userId: string | null | undefined): string | null {
  return userId && /^[A-Za-z0-9_-]{1,160}$/.test(userId)
    ? `${STORAGE_PREFIX}${userId}`
    : null;
}

function isRecipe(value: unknown): value is Recipe {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const recipe = value as Partial<Recipe>;
  return typeof recipe.id === "string" && recipe.id.length <= 160 &&
    typeof recipe.name === "string" && recipe.name.length <= 160 &&
    typeof recipe.description === "string" && recipe.description.length <= 2_000 &&
    Number.isSafeInteger(recipe.servings) && Number(recipe.servings) >= 1 &&
    Number(recipe.servings) <= 100 && Array.isArray(recipe.ingredients) &&
    recipe.ingredients.length <= 100 && typeof recipe.instructions === "string" &&
    recipe.instructions.length <= 10_000 && typeof recipe.createdAt === "string" &&
    typeof recipe.updatedAt === "string";
}

function generateId(): string {
  return `recipe_${crypto.randomUUID()}`;
}

export function getRecipes(userId?: string | null): Recipe[] {
  if (typeof localStorage === "undefined") return [];
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  const key = storageKey(userId);
  if (!key) return [];
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.filter(isRecipe).slice(0, MAX_RECIPES) : [];
    } catch { /* fall through */ }
  }
  return [];
}

function saveRecipes(userId: string, recipes: Recipe[]): void {
  const key = storageKey(userId);
  if (!key || typeof localStorage === "undefined") return;
  localStorage.setItem(key, JSON.stringify(recipes.filter(isRecipe).slice(0, MAX_RECIPES)));
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
  userId: string,
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
  const recipes = [recipe, ...getRecipes(userId)];
  saveRecipes(userId, recipes);
  return recipe;
}

export function updateRecipe(userId: string, id: string, updates: Partial<Recipe>): Recipe | null {
  const recipes = getRecipes(userId);
  const idx = recipes.findIndex((r) => r.id === id);
  if (idx === -1) return null;

  const merged = { ...recipes[idx], ...updates, updatedAt: new Date().toISOString() };
  if (updates.ingredients || updates.servings !== undefined) {
    const nutrition = calculateNutrition(merged.ingredients, merged.servings);
    Object.assign(merged, nutrition);
  }
  recipes[idx] = merged;
  saveRecipes(userId, recipes);
  return merged;
}

export function deleteRecipe(userId: string, id: string): boolean {
  const recipes = getRecipes(userId).filter((r) => r.id !== id);
  saveRecipes(userId, recipes);
  return true;
}

export function getRecipe(userId: string | null | undefined, id: string): Recipe | undefined {
  return getRecipes(userId).find((r) => r.id === id);
}
