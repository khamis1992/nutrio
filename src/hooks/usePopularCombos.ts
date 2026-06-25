import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ComboItem {
  meal_id: string;
  name: string;
  image_url: string | null;
  restaurant_name: string;
  calories: number;
  protein_g: number;
  tag: string;
}

interface PopularCombo {
  id: string;
  title: string;
  author: string;
  image: string;
  likes: number;
  comments: number;
  tags: string[];
  comboMeals: ComboItem[];
}

type MealRow = {
  id: string;
  name: string;
  image_url: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  meal_type: string | null;
  restaurants?: { name: string | null; is_active?: boolean | null; approval_status?: string | null } | null;
};

type ScheduleComboRow = {
  meal_id: string;
  user_id: string;
  scheduled_date: string;
};

const restaurantName = (meal: MealRow) => meal.restaurants?.name || "Nutrio Chef";

const tagForMeal = (meal: MealRow) => {
  const calories = meal.calories || 0;
  const protein = meal.protein_g || 0;
  if (protein >= 30) return "High Protein";
  if (calories > 0 && calories <= 400) return "Light";
  return meal.meal_type || "Balanced";
};

const toComboItem = (meal: MealRow): ComboItem => ({
  meal_id: meal.id,
  name: meal.name,
  image_url: meal.image_url,
  restaurant_name: restaurantName(meal),
  calories: meal.calories || 0,
  protein_g: meal.protein_g || 0,
  tag: tagForMeal(meal),
});

const countByMealId = (rows: Array<{ meal_id: string }> | null | undefined) =>
  (rows || []).reduce<Record<string, number>>((acc, row) => {
    acc[row.meal_id] = (acc[row.meal_id] || 0) + 1;
    return acc;
  }, {});

async function fetchEngagement(mealIds: string[]) {
  if (!mealIds.length) return { favoriteCounts: {}, reviewCounts: {} };

  const [favoritesResult, reviewsResult] = await Promise.all([
    supabase.from("favorites").select("meal_id").in("meal_id", mealIds),
    supabase.from("meal_reviews").select("meal_id").in("meal_id", mealIds).eq("is_approved", true),
  ]);

  return {
    favoriteCounts: countByMealId(favoritesResult.data),
    reviewCounts: countByMealId(reviewsResult.data),
  };
}

function makeCombo(meals: MealRow[], favoriteCounts: Record<string, number>, reviewCounts: Record<string, number>): PopularCombo | null {
  const validMeals = meals.filter(Boolean);
  const main = validMeals[0];
  if (!main) return null;

  const tags = Array.from(new Set(validMeals.map(tagForMeal))).slice(0, 3);

  return {
    id: `combo-${main.id}`,
    title: main.name,
    author: restaurantName(main),
    image: main.image_url || "",
    likes: validMeals.reduce((sum, meal) => sum + (favoriteCounts[meal.id] || 0), 0),
    comments: validMeals.reduce((sum, meal) => sum + (reviewCounts[meal.id] || 0), 0),
    tags: tags.length ? tags : ["Balanced"],
    comboMeals: validMeals.map(toComboItem),
  };
}

async function fetchScheduleDerivedCombos(): Promise<PopularCombo[]> {
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const { data: schedules, error } = await supabase
    .from("meal_schedules")
    .select("meal_id,user_id,scheduled_date")
    .not("meal_id", "is", null)
    .neq("order_status", "cancelled")
    .gte("scheduled_date", since.toISOString().slice(0, 10))
    .order("scheduled_date", { ascending: false })
    .limit(700);

  if (error || !schedules?.length) return [];

  const grouped = (schedules as ScheduleComboRow[]).reduce<Record<string, string[]>>((acc, row) => {
    const key = `${row.user_id}-${row.scheduled_date}`;
    acc[key] ||= [];
    if (!acc[key].includes(row.meal_id)) acc[key].push(row.meal_id);
    return acc;
  }, {});

  const comboCounts = Object.values(grouped).reduce<Record<string, number>>((acc, ids) => {
    if (ids.length < 2) return acc;
    const key = ids.slice(0, 4).sort().join(",");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const topComboKeys = Object.entries(comboCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([key]) => key);

  if (!topComboKeys.length) return [];

  const mealIds = Array.from(new Set(topComboKeys.flatMap((key) => key.split(","))));
  const { data: meals, error: mealsError } = await supabase
    .from("meals")
    .select("id,name,image_url,calories,protein_g,carbs_g,fat_g,meal_type,restaurants:restaurant_id(name,is_active,approval_status)")
    .in("id", mealIds)
    .eq("is_available", true)
    .eq("approval_status", "approved")
    .eq("restaurants.is_active", true)
    .eq("restaurants.approval_status", "approved");

  if (mealsError || !meals?.length) return [];

  const mealMap = (meals as MealRow[]).reduce<Record<string, MealRow>>((acc, meal) => {
    acc[meal.id] = meal;
    return acc;
  }, {});
  const { favoriteCounts, reviewCounts } = await fetchEngagement(mealIds);

  return topComboKeys
    .map((key) => makeCombo(key.split(",").map((id) => mealMap[id]).filter(Boolean), favoriteCounts, reviewCounts))
    .filter((combo): combo is PopularCombo => Boolean(combo));
}

async function fetchNutritionGeneratedCombos(): Promise<PopularCombo[]> {
  const { data: meals, error } = await supabase
    .from("meals")
    .select("id,name,image_url,calories,protein_g,carbs_g,fat_g,meal_type,restaurants:restaurant_id(name,is_active,approval_status)")
    .eq("is_available", true)
    .eq("approval_status", "approved")
    .eq("restaurants.is_active", true)
    .eq("restaurants.approval_status", "approved")
    .order("created_at", { ascending: false })
    .limit(24);

  if (error || !meals?.length) return [];

  const rows = meals as MealRow[];
  const highProtein = rows.filter((meal) => (meal.protein_g || 0) >= 25 && (meal.calories || 0) <= 650);
  const balanced = rows.filter((meal) => (meal.protein_g || 0) >= 15 && (meal.protein_g || 0) < 30);
  const light = rows.filter((meal) => (meal.calories || 0) > 0 && (meal.calories || 0) <= 450);
  const mains = highProtein.length ? highProtein : rows;
  const engagementMealIds = Array.from(new Set(rows.map((meal) => meal.id)));
  const { favoriteCounts, reviewCounts } = await fetchEngagement(engagementMealIds);

  return mains.slice(0, 4).map((main, index) => {
    const side = balanced.find((meal) => meal.id !== main.id) || rows[(index + 1) % rows.length];
    const snack = light.find((meal) => meal.id !== main.id && meal.id !== side?.id) || rows[(index + 2) % rows.length];
    const comboMeals = [main, side, snack].filter((meal, mealIndex, arr) => meal && arr.findIndex((item) => item?.id === meal.id) === mealIndex);
    return makeCombo(comboMeals, favoriteCounts, reviewCounts);
  }).filter((combo): combo is PopularCombo => Boolean(combo));
}

export function usePopularCombos() {
  const [combos, setCombos] = useState<PopularCombo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const scheduleCombos = await fetchScheduleDerivedCombos();
      const nextCombos = scheduleCombos.length ? scheduleCombos : await fetchNutritionGeneratedCombos();
      setCombos(nextCombos);
    } catch (err) {
      console.error("Error fetching popular combos:", err);
      setCombos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { combos, loading, refresh: fetch };
}
