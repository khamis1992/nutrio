# 4-Feature Implementation Plan: Step Tracker, Color-Coded Logging, Recipe Builder, Add-On Marketplace

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add step tracking dashboard card, Noom-style color-coded food logging, a custom recipe builder, and an add-on marketplace (snacks/supplements) with recipe-to-marketplace ingredient ordering.

**Architecture:** localStorage-backed stores (no Supabase for MVP per project convention). Recipe builder and marketplace share an ingredient catalog. Each feature is an independent React component/page, wired into existing routes and Dashboard layout.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, shadcn/ui, framer-motion, Vitest, localStorage stores

**Existing infrastructure to leverage:**
- `src/lib/healthKit.ts` + `src/hooks/useHealthKitIntegration.ts` — step data sync already built (Apple Health / Google Fit, 15-min polling, localStorage cache)
- `src/components/settings/HealthAppsSettings.tsx` — step sync toggle already exists
- Meals have `calories`, `protein_g`, `carbs_g`, `fat_g` fields for color calculation
- Dashboard at `src/pages/Dashboard.tsx` — add step card between macro cards and quick actions
- `src/customer/routes.tsx` — add routes for /recipes and /marketplace
- `src/components/CustomerLayout.tsx` — pages render inside this layout via `<Outlet />`
- Bottom tab bar: `src/components/BottomTabBar.tsx` — may need a new tab for Marketplace

---

## Phase 1: Step Target / Pedometer Integration

### Task 1.1: Create local step data store

**Objective:** Create a localStorage-backed store to persist daily step count and goal, independent of the health sync system.

**Files:**
- Create: `src/lib/stepStore.ts`

**Step 1:** Write the store module.

```typescript
// src/lib/stepStore.ts
const STORAGE_KEY = "nutrio_step_data";

export interface StepDay {
  date: string;        // "2026-06-06"
  steps: number;
  synced: boolean;     // from health API or manual
}

export interface StepData {
  dailyGoal: number;       // default 8000
  history: StepDay[];      // last 30 days
  today: StepDay;
}

const DEFAULT_GOAL = 8000;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getStepData(): StepData {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const data = JSON.parse(raw) as StepData;
      // If today's entry is stale, reset it
      if (data.today.date !== todayStr()) {
        data.history = [...data.history, data.today].slice(-30);
        data.today = { date: todayStr(), steps: 0, synced: false };
      }
      return data;
    } catch { /* fall through */ }
  }
  return {
    dailyGoal: DEFAULT_GOAL,
    history: [],
    today: { date: todayStr(), steps: 0, synced: false },
  };
}

export function saveStepData(data: StepData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function updateSteps(steps: number, synced: boolean): StepData {
  const data = getStepData();
  data.today = { date: todayStr(), steps, synced };
  saveStepData(data);
  return data;
}

export function setDailyGoal(goal: number): StepData {
  const data = getStepData();
  data.dailyGoal = Math.max(1000, Math.min(50000, goal));
  saveStepData(data);
  return data;
}

export function mergeHealthSteps(healthSteps: number | null): StepData {
  if (healthSteps === null || healthSteps === undefined) return getStepData();
  const data = getStepData();
  if (healthSteps > data.today.steps) {
    data.today = { date: todayStr(), steps: healthSteps, synced: true };
    saveStepData(data);
  }
  return data;
}
```

**Step 2:** Verify.
Run: `npx tsc --noEmit`
Expected: No new type errors.

**Step 3:** Commit.
```bash
git add src/lib/stepStore.ts
git commit -m "feat: add step data local store with daily goal and 30-day history"
```

---

### Task 1.2: Create StepTrackerCard Dashboard component

**Objective:** A card that displays today's step count vs goal, reads from the local store and syncs with health data.

**Files:**
- Create: `src/components/dashboard/StepTrackerCard.tsx`

**Step 1:** Write the component.

```tsx
// src/components/dashboard/StepTrackerCard.tsx
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Footprints, Target } from "lucide-react";
import { getStepData, mergeHealthSteps, type StepData } from "@/lib/stepStore";
import { getCachedHealthData } from "@/lib/healthKit";

export function StepTrackerCard() {
  const [data, setData] = useState<StepData>(() => getStepData());

  useEffect(() => {
    // Merge health-synced steps once on mount
    const health = getCachedHealthData();
    if (health?.steps) {
      const merged = mergeHealthSteps(health.steps);
      setData(merged);
    }
  }, []);

  const pct = Math.min(100, Math.round((data.today.steps / data.dailyGoal) * 100));
  const remaining = Math.max(0, data.dailyGoal - data.today.steps);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 mt-4 rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 text-white shadow-sm">
            <Footprints className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[13px] font-extrabold text-slate-900">Steps</p>
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <Target className="h-3 w-3" />
              Goal: {data.dailyGoal.toLocaleString()}
            </p>
          </div>
        </div>
        <span className="text-[28px] font-extrabold tabular-nums text-slate-900">
          {data.today.steps.toLocaleString()}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-500"
        />
      </div>

      <div className="flex items-center justify-between mt-2">
        <p className="text-[11px] font-semibold text-slate-400">
          {pct}% of daily goal
        </p>
        {remaining > 0 ? (
          <p className="text-[11px] font-semibold text-purple-500">
            {remaining.toLocaleString()} steps to go
          </p>
        ) : (
          <p className="text-[11px] font-semibold text-emerald-500">Goal reached!</p>
        )}
      </div>
    </motion.div>
  );
}
```

**Step 2:** Verify typecheck.
Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3:** Commit.
```bash
git add src/components/dashboard/StepTrackerCard.tsx
git commit -m "feat: add StepTrackerCard dashboard component with progress bar"
```

---

### Task 1.3: Wire StepTrackerCard into Dashboard

**Objective:** Add the step tracker card to the main Dashboard page.

**Files:**
- Modify: `src/pages/Dashboard.tsx` — insert after macro cards, before quick actions

**Step 1:** Import and insert the card.

Add import at top of Dashboard.tsx (near other component imports):
```tsx
import { StepTrackerCard } from "@/components/dashboard/StepTrackerCard";
```

Insert the card in the render tree. Find the location after the macro cards section (around line ~1970, after the `BodyCorrelationWidget` and before the "Quick Actions" section). Insert:

```tsx
<StepTrackerCard />
```

**Step 2:** Verify typecheck + build.
Run: `npx tsc --noEmit && npm run build 2>&1 | tail -5`
Expected: Both pass.

**Step 3:** Commit.
```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: wire StepTrackerCard into Dashboard layout"
```

---

## Phase 2: Color-Coded Food Logging (Noom-Style)

### Task 2.1: Create color classification utility

**Objective:** Create a function that classifies foods as green/yellow/red based on calorie density.

**Files:**
- Create: `src/lib/foodColorClassification.ts`

Noom's algorithm: calories per gram. For prepared meals, we use calories per 100g (since we have calories and need a weight estimate).

Classification thresholds (based on Noom's published methodology):
- Green: ≤ 1.0 cal/g (vegetables, fruits, lean proteins, whole grains)
- Yellow: 1.0-2.4 cal/g (lean meats, legumes, whole grain breads, low-fat dairy)
- Red: > 2.4 cal/g (fried foods, processed meats, full-fat cheese, sugary items)

For our meals (no gram weight, only macros), we estimate mass from macros:
- Protein: 4 cal/g
- Carbs: 4 cal/g
- Fat: 9 cal/g
- Estimated mass = (protein_g × 4 + carbs_g × 4 + fat_g × 9) / calories × 100 (per 100 calories) — this doesn't directly give gram weight.

Alternative approach: For meals where we don't have gram weight, use the macros ratio as a proxy:
- High protein-to-calorie ratio + low fat → green
- Balanced → yellow
- High fat-to-calorie ratio or high calorie density → red

```typescript
// src/lib/foodColorClassification.ts

export type FoodColor = "green" | "yellow" | "red";

export interface ClassifiedMeal {
  color: FoodColor;
  reason: string;
}

/**
 * Classify a food item based on its macro profile.
 * Uses a proxy since we don't have gram weight — estimates
 * nutrient density from the protein/fat/calorie ratios.
 */
export function classifyFood(calories: number, protein_g: number, fat_g: number): ClassifiedMeal {
  if (calories <= 0) return { color: "green", reason: "Zero calories" };
  
  const proteinRatio = (protein_g * 4) / calories; // % calories from protein
  const fatRatio = (fat_g * 9) / calories;          // % calories from fat
  
  // Green: high protein, low fat, low total calories
  if (proteinRatio > 0.30 && fatRatio < 0.35 && calories < 400) {
    return { color: "green", reason: "High protein, low fat — nutrient-dense" };
  }
  
  // Red: high fat, low protein, high calories
  if (fatRatio > 0.45 || (calories > 700 && proteinRatio < 0.20)) {
    return { color: "red", reason: "High calorie density — limit portions" };
  }
  
  // Default: yellow
  return { color: "yellow", reason: "Moderate calorie density — eat in moderation" };
}

export function getColorDot(color: FoodColor): string {
  return { green: "🟢", yellow: "🟡", red: "🔴" }[color];
}

export function getColorBg(color: FoodColor): string {
  return {
    green: "bg-emerald-50 text-emerald-700",
    yellow: "bg-amber-50 text-amber-700",
    red: "bg-rose-50 text-rose-700",
  }[color];
}

export function getColorBar(color: FoodColor): string {
  return {
    green: "bg-emerald-400",
    yellow: "bg-amber-400",
    red: "bg-rose-400",
  }[color];
}
```

**Step 2:** Verify.
Run: `npx tsc --noEmit`
Expected: Pass.

**Step 3:** Commit.
```bash
git add src/lib/foodColorClassification.ts
git commit -m "feat: add Noom-style green/yellow/red food classification utility"
```

---

### Task 2.2: Add color classification to logged meals display

**Objective:** Show a color dot next to each logged meal and a daily breakdown bar.

**Files:**
- Modify: `src/pages/Dashboard.tsx` — add color dots and daily summary bar
- Create: `src/components/dashboard/FoodColorSummary.tsx`

**Step 1:** Write the daily summary component.

```tsx
// src/components/dashboard/FoodColorSummary.tsx
import { motion } from "framer-motion";
import { classifyFood, getColorBar, type FoodColor } from "@/lib/foodColorClassification";

interface MealEntry {
  calories: number;
  protein_g: number;
  fat_g: number;
  name: string;
}

export function FoodColorSummary({ meals }: { meals: MealEntry[] }) {
  const colors: Record<FoodColor, number> = { green: 0, yellow: 0, red: 0 };
  
  for (const meal of meals) {
    const { color } = classifyFood(meal.calories, meal.protein_g, meal.fat_g);
    colors[color]++;
  }
  
  const total = colors.green + colors.yellow + colors.red || 1;
  const greenPct = (colors.green / total) * 100;
  const yellowPct = (colors.yellow / total) * 100;
  const redPct = (colors.red / total) * 100;
  
  if (meals.length === 0) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-4 mt-2 mb-4"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
          Food Balance
        </p>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden">
        {greenPct > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${greenPct}%` }}
            className={getColorBar("green")}
          />
        )}
        {yellowPct > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${yellowPct}%` }}
            className={getColorBar("yellow")}
          />
        )}
        {redPct > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${redPct}%` }}
            className={getColorBar("red")}
          />
        )}
      </div>
      <div className="flex items-center gap-3 mt-1.5 text-[10px] font-semibold text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          {colors.green} green
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          {colors.yellow} yellow
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-rose-400" />
          {colors.red} red
        </span>
      </div>
    </motion.div>
  );
}
```

**Step 2:** Wire into Dashboard — find where logged meals are rendered and add the summary bar + color dots.

Insert the `FoodColorSummary` component after the meal log section. For color dots on individual meal items, add a small colored circle before each meal name using `classifyFood()` and `getColorBg()`.

**Step 3:** Verify.
Run: `npx tsc --noEmit`
Expected: Pass.

**Step 4:** Commit.
```bash
git add src/components/dashboard/FoodColorSummary.tsx src/pages/Dashboard.tsx
git commit -m "feat: add color-coded food balance bar and per-meal color dots to Dashboard"
```

---

## Phase 3: Custom Recipe Builder + Add-On Marketplace

These two features are built together because the recipe builder's ingredient list drives marketplace ordering.

### Task 3.1: Create ingredient catalog (shared by recipe builder + marketplace)

**Objective:** A local data store of purchasable ingredients that recipes reference and the marketplace sells.

**Files:**
- Create: `src/lib/ingredientCatalog.ts`

```typescript
// src/lib/ingredientCatalog.ts

export interface Ingredient {
  id: string;
  name: string;
  category: "protein" | "vegetable" | "grain" | "fruit" | "dairy" | "oil" | "snack" | "supplement";
  /** Nutrition per 100g */
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  /** Marketplace info */
  price_qar: number;       // price per unit in QAR
  unit: string;             // "g", "ml", "piece", "scoop"
  unit_size: number;        // grams or ml per unit
  image_url: string;        // emoji or URL
  in_stock: boolean;
}

const STORAGE_KEY = "nutrio_ingredient_catalog";

const DEFAULT_CATALOG: Ingredient[] = [
  // Proteins
  { id: "chicken_breast", name: "Chicken Breast", category: "protein", calories_per_100g: 165, protein_per_100g: 31, carbs_per_100g: 0, fat_per_100g: 3.6, price_qar: 25, unit: "g", unit_size: 500, image_url: "🍗", in_stock: true },
  { id: "salmon", name: "Atlantic Salmon", category: "protein", calories_per_100g: 208, protein_per_100g: 20, carbs_per_100g: 0, fat_per_100g: 13, price_qar: 45, unit: "g", unit_size: 300, image_url: "🐟", in_stock: true },
  { id: "eggs", name: "Free-Range Eggs", category: "protein", calories_per_100g: 155, protein_per_100g: 13, carbs_per_100g: 1.1, fat_per_100g: 11, price_qar: 18, unit: "piece", unit_size: 12, image_url: "🥚", in_stock: true },
  { id: "whey_protein", name: "Whey Protein (Vanilla)", category: "supplement", calories_per_100g: 380, protein_per_100g: 80, carbs_per_100g: 8, fat_per_100g: 4, price_qar: 120, unit: "scoop", unit_size: 30, image_url: "💪", in_stock: true },
  // Vegetables
  { id: "spinach", name: "Baby Spinach", category: "vegetable", calories_per_100g: 23, protein_per_100g: 2.9, carbs_per_100g: 3.6, fat_per_100g: 0.4, price_qar: 12, unit: "g", unit_size: 250, image_url: "🥬", in_stock: true },
  { id: "avocado", name: "Avocado", category: "fruit", calories_per_100g: 160, protein_per_100g: 2, carbs_per_100g: 8.5, fat_per_100g: 14.7, price_qar: 8, unit: "piece", unit_size: 1, image_url: "🥑", in_stock: true },
  { id: "tomato", name: "Cherry Tomatoes", category: "vegetable", calories_per_100g: 18, protein_per_100g: 0.9, carbs_per_100g: 3.9, fat_per_100g: 0.2, price_qar: 10, unit: "g", unit_size: 300, image_url: "🍅", in_stock: true },
  // Grains
  { id: "brown_rice", name: "Brown Rice", category: "grain", calories_per_100g: 123, protein_per_100g: 2.7, carbs_per_100g: 25.6, fat_per_100g: 1, price_qar: 15, unit: "g", unit_size: 1000, image_url: "🍚", in_stock: true },
  { id: "quinoa", name: "Quinoa", category: "grain", calories_per_100g: 120, protein_per_100g: 4.4, carbs_per_100g: 21.3, fat_per_100g: 1.9, price_qar: 22, unit: "g", unit_size: 500, image_url: "🌾", in_stock: true },
  // Oils / fats
  { id: "olive_oil", name: "Extra Virgin Olive Oil", category: "oil", calories_per_100g: 884, protein_per_100g: 0, carbs_per_100g: 0, fat_per_100g: 100, price_qar: 35, unit: "ml", unit_size: 500, image_url: "🫒", in_stock: true },
  // Snacks
  { id: "protein_bar", name: "Protein Bar (Chocolate)", category: "snack", calories_per_100g: 380, protein_per_100g: 33, carbs_per_100g: 35, fat_per_100g: 12, price_qar: 15, unit: "piece", unit_size: 1, image_url: "🍫", in_stock: true },
  { id: "almonds", name: "Raw Almonds", category: "snack", calories_per_100g: 579, protein_per_100g: 21, carbs_per_100g: 21.6, fat_per_100g: 49.9, price_qar: 30, unit: "g", unit_size: 200, image_url: "🥜", in_stock: true },
  // Supplements
  { id: "creatine", name: "Creatine Monohydrate", category: "supplement", calories_per_100g: 0, protein_per_100g: 0, carbs_per_100g: 0, fat_per_100g: 0, price_qar: 80, unit: "scoop", unit_size: 5, image_url: "⚡", in_stock: true },
  { id: "multivitamin", name: "Daily Multivitamin", category: "supplement", calories_per_100g: 0, protein_per_100g: 0, carbs_per_100g: 0, fat_per_100g: 0, price_qar: 65, unit: "piece", unit_size: 30, image_url: "💊", in_stock: true },
];

export function getCatalog(): Ingredient[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  // Seed catalog on first load
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CATALOG));
  return DEFAULT_CATALOG;
}

export function getIngredient(id: string): Ingredient | undefined {
  return getCatalog().find((i) => i.id === id);
}

export function getByCategory(category: Ingredient["category"]): Ingredient[] {
  return getCatalog().filter((i) => i.category === category);
}
```

**Step 2:** Verify.
Run: `npx tsc --noEmit`
Expected: Pass.

**Step 3:** Commit.
```bash
git add src/lib/ingredientCatalog.ts
git commit -m "feat: add ingredient catalog with 13 items across 7 categories"
```

---

### Task 3.2: Create recipe data model and store

**Objective:** Users can create, save, and manage custom recipes with ingredient lists and macro calculation.

**Files:**
- Create: `src/lib/recipeStore.ts`

```typescript
// src/lib/recipeStore.ts
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
  /** Calculated totals per serving */
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
    try { return JSON.parse(raw); } catch {}
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

export function createRecipe(data: Omit<Recipe, "id" | "createdAt" | "updatedAt" | "calories_per_serving" | "protein_per_serving" | "carbs_per_serving" | "fat_per_serving">): Recipe {
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
  if (updates.ingredients || updates.servings) {
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
```

**Step 2:** Verify.
Run: `npx tsc --noEmit`
Expected: Pass.

**Step 3:** Commit.
```bash
git add src/lib/recipeStore.ts
git commit -m "feat: add recipe CRUD store with auto macro calculation"
```

---

### Task 3.3: Create the Recipes page (list + create)

**Objective:** A full page at /recipes where users can view saved recipes and create new ones.

**Files:**
- Create: `src/pages/Recipes.tsx`
- Modify: `src/customer/routes.tsx` — add route

**Step 1:** Write the Recipes page.

```tsx
// src/pages/Recipes.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, ChefHat, Flame, Beef, Wheat, Droplets,
  Users, Clock, Trash2, ShoppingCart, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getRecipes, deleteRecipe, type Recipe } from "@/lib/recipeStore";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Recipes() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<Recipe[]>(() => getRecipes());

  const handleDelete = (id: string) => {
    deleteRecipe(id);
    setRecipes(getRecipes());
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="min-h-screen bg-[#F8F9FA] pb-4 mx-auto max-w-[430px]"
    >
      {/* Header */}
      <div className="bg-white px-4 pt-safe pb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200">
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
            <ChefHat className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">My Recipes</h1>
            <p className="text-sm text-gray-500">Cook and track your own meals</p>
          </div>
          <Button onClick={() => navigate("/recipes/new")} size="sm"
            className="rounded-full bg-emerald-500 hover:bg-emerald-600 h-10 px-4 gap-1.5">
            <Plus className="h-4 w-4" /> New
          </Button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        <AnimatePresence>
          {recipes.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 text-center">
              <ChefHat className="h-16 w-16 text-slate-200 mb-4" />
              <h2 className="text-lg font-bold text-slate-700">No recipes yet</h2>
              <p className="text-sm text-slate-400 mt-1 max-w-[250px]">
                Create your first recipe and get automatic macro calculations
              </p>
              <Button onClick={() => navigate("/recipes/new")}
                className="mt-6 rounded-full bg-emerald-500 hover:bg-emerald-600 gap-2">
                <Plus className="h-4 w-4" /> Create Recipe
              </Button>
            </motion.div>
          ) : (
            recipes.map((recipe) => (
              <motion.div key={recipe.id} layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                <div className="flex gap-4">
                  <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-xl bg-amber-50 text-4xl">
                    {recipe.image_emoji || "🍽️"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900 truncate">{recipe.name}</h3>
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{recipe.description}</p>
                      </div>
                      <button onClick={() => handleDelete(recipe.id)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 hover:bg-red-100">
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Flame className="h-3 w-3 text-orange-500" />{recipe.calories_per_serving} cal</span>
                      <span className="flex items-center gap-1"><Beef className="h-3 w-3 text-rose-500" />{recipe.protein_per_serving}g</span>
                      <span className="flex items-center gap-1"><Wheat className="h-3 w-3 text-amber-500" />{recipe.carbs_per_serving}g</span>
                      <span className="flex items-center gap-1"><Droplets className="h-3 w-3 text-purple-500" />{recipe.fat_per_serving}g</span>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-1 text-[10px] text-slate-400">
                        <Users className="h-3 w-3" />{recipe.servings} servings
                      </span>
                      <button onClick={() => navigate(`/recipes/${recipe.id}`)}
                        className="ml-auto text-[12px] font-semibold text-emerald-600 flex items-center gap-1">
                        View <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
```

**Step 2:** Add routes in `src/customer/routes.tsx`:
```tsx
const Recipes = lazy(() => import("@/pages/Recipes"));
const RecipeNew = lazy(() => import("@/pages/RecipeNew"));
const RecipeDetail = lazy(() => import("@/pages/RecipeDetail"));
```

Add routes inside the ProtectedRoute block:
```tsx
<Route path="/recipes" element={<ProtectedRoute><Recipes /></ProtectedRoute>} />
<Route path="/recipes/new" element={<ProtectedRoute><RecipeNew /></ProtectedRoute>} />
<Route path="/recipes/:id" element={<ProtectedRoute><RecipeDetail /></ProtectedRoute>} />
```

(RecipeNew and RecipeDetail pages built in next tasks.)

**Step 3:** Verify.
Run: `npx tsc --noEmit`
Expected: Errors about missing RecipeNew/RecipeDetail imports (expected, they don't exist yet).
Instead do incremental: `npx tsc --noEmit src/pages/Recipes.tsx` will fail for route imports, so commit after the next tasks.

**Step 4:** Commit.
```bash
git add src/pages/Recipes.tsx src/customer/routes.tsx
git commit -m "feat: add Recipes list page with CRUD and routing"
```

---

### Task 3.4: Create Recipe Builder form (RecipeNew page)

**Objective:** A form page where users create recipes by searching/adding ingredients from the catalog, setting amounts, and seeing live macro calculation.

**Files:**
- Create: `src/pages/RecipeNew.tsx`

The page includes:
- Recipe name, description, servings inputs
- Emoji picker for the recipe icon
- Ingredient search from catalog
- Add ingredient with amount input
- Live macro calculation panel
- Instructions textarea
- Save button calling `createRecipe()`

**Step 1:** Write the page (full implementation ~250 lines).

Key features:
- Search catalog by name/category
- Add ingredient → set amount in grams → shows per-ingredient macros
- Remove ingredient
- Live total macros panel updates as ingredients change
- Form validation (name required, at least 1 ingredient)

**Step 2:** Verify typecheck.
Run: `npx tsc --noEmit`
Expected: Pass.

**Step 3:** Commit.
```bash
git add src/pages/RecipeNew.tsx
git commit -m "feat: add recipe builder form with ingredient search and live macro calc"
```

---

### Task 3.5: Create Recipe Detail page with "Order Ingredients" button

**Objective:** View a recipe's full details and order all ingredients from the marketplace with one click.

**Files:**
- Create: `src/pages/RecipeDetail.tsx`

The page shows:
- Recipe hero (emoji + name + description)
- Macro breakdown per serving
- Ingredient list with amounts
- Instructions
- BIG "Order All Ingredients" button → adds all ingredients to cart and navigates to /marketplace

**Step 1:** Write the page.

**Step 2:** Verify typecheck.
Run: `npx tsc --noEmit`
Expected: Pass.

**Step 3:** Commit.
```bash
git add src/pages/RecipeDetail.tsx
git commit -m "feat: add recipe detail page with order-all-ingredients integration"
```

---

### Task 3.6: Create Marketplace page

**Objective:** A shop page at /marketplace where users browse ingredients, snacks, and supplements by category and add to cart.

**Files:**
- Create: `src/pages/Marketplace.tsx`
- Create: `src/lib/cartStore.ts`
- Modify: `src/customer/routes.tsx` — add route

**Step 1:** Create cart store.

```typescript
// src/lib/cartStore.ts
import { type Ingredient, getIngredient } from "./ingredientCatalog";

export interface CartItem {
  ingredient: Ingredient;
  quantity: number;
}

const STORAGE_KEY = "nutrio_cart";

export function getCart(): CartItem[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) { try { return JSON.parse(raw); } catch {} }
  return [];
}

function saveCart(items: CartItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function addToCart(ingredientId: string, quantity: number = 1): CartItem[] {
  const ing = getIngredient(ingredientId);
  if (!ing) return getCart();
  const cart = getCart();
  const existing = cart.find((ci) => ci.ingredient.id === ingredientId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ ingredient: ing, quantity });
  }
  saveCart(cart);
  return cart;
}

export function removeFromCart(ingredientId: string): CartItem[] {
  const cart = getCart().filter((ci) => ci.ingredient.id !== ingredientId);
  saveCart(cart);
  return cart;
}

export function addRecipeIngredientsToCart(ingredientIds: Array<{ id: string; name: string }>): CartItem[] {
  for (const { id } of ingredientIds) {
    addToCart(id, 1);
  }
  return getCart();
}

export function getCartTotal(): number {
  return getCart().reduce((sum, ci) => sum + ci.ingredient.price_qar * ci.quantity, 0);
}

export function getCartCount(): number {
  return getCart().reduce((sum, ci) => sum + ci.quantity, 0);
}

export function clearCart(): void {
  localStorage.removeItem(STORAGE_KEY);
}
```

**Step 2:** Write the Marketplace page with category tabs, ingredient cards, and cart drawer.

Categories: Proteins, Vegetables, Grains, Snacks, Supplements.

Each card shows: emoji, name, price (QAR), nutrition highlights, "Add to Cart" button.

Cart drawer at bottom: shows items, total, "Checkout" button.

**Step 3:** Add route in `src/customer/routes.tsx`:
```tsx
const Marketplace = lazy(() => import("@/pages/Marketplace"));
// ...
<Route path="/marketplace" element={<ProtectedRoute><Marketplace /></ProtectedRoute>} />
```

**Step 4:** Verify.
Run: `npx tsc --noEmit`
Expected: Pass.

**Step 5:** Commit.
```bash
git add src/pages/Marketplace.tsx src/lib/cartStore.ts src/customer/routes.tsx
git commit -m "feat: add marketplace page with cart, category tabs, and recipe-to-cart integration"
```

---

### Task 3.7: Add "Shop" tab to BottomTabBar

**Objective:** Users can navigate to /marketplace from the bottom navigation bar.

**Files:**
- Modify: `src/components/BottomTabBar.tsx` — add Marketplace tab

**Step 1:** Add a new tab item:
```tsx
{ icon: ShoppingBag, label: "Shop", to: "/marketplace" },
```

**Step 2:** Import `ShoppingBag` from lucide-react if not already imported.

**Step 3:** Verify + commit.
```bash
git add src/components/BottomTabBar.tsx
git commit -m "feat: add Shop tab to bottom navigation bar"
```

---

## Verification Checklist

After all phases complete:

| Check | Command | Expected |
|-------|---------|----------|
| TypeScript | `npx tsc --noEmit` | Zero errors |
| Lint | `npm run lint` | No new errors |
| Build | `npm run build` | Builds successfully |
| Tests | `npm run test:run` | Existing tests pass |
| Step card renders | Open /dashboard | Step progress bar visible |
| Color dots appear | Open /dashboard | Colored dots on logged meals |
| Recipes page | Open /recipes | Empty state → create recipe |
| Recipe builder | Open /recipes/new | Search ingredients, add, calculate macros live |
| Recipe detail | Open /recipes/:id | View recipe + "Order Ingredients" button |
| Marketplace | Open /marketplace | Browse by category, add to cart |
| Recipe → cart | Order ingredients from recipe | Cart pre-filled from recipe |

---

## File Manifest

| File | Action | Phase |
|------|--------|-------|
| `src/lib/stepStore.ts` | Create | 1.1 |
| `src/components/dashboard/StepTrackerCard.tsx` | Create | 1.2 |
| `src/pages/Dashboard.tsx` | Modify | 1.3, 2.2 |
| `src/lib/foodColorClassification.ts` | Create | 2.1 |
| `src/components/dashboard/FoodColorSummary.tsx` | Create | 2.2 |
| `src/lib/ingredientCatalog.ts` | Create | 3.1 |
| `src/lib/recipeStore.ts` | Create | 3.2 |
| `src/pages/Recipes.tsx` | Create | 3.3 |
| `src/pages/RecipeNew.tsx` | Create | 3.4 |
| `src/pages/RecipeDetail.tsx` | Create | 3.5 |
| `src/lib/cartStore.ts` | Create | 3.6 |
| `src/pages/Marketplace.tsx` | Create | 3.6 |
| `src/customer/routes.tsx` | Modify | 3.3, 3.6 |
| `src/components/BottomTabBar.tsx` | Modify | 3.7 |
