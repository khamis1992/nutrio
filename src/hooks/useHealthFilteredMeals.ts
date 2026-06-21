import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { computeMealHealthTags, type HealthTag, type MealNutritionData } from "@/lib/meal-health-tagger";

interface MealRow {
  id: string;
  name: string;
  description: string | null;
  ingredients: string | null;
  category: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  image_url: string | null;
  price: number | null;
  restaurant_id: string | null;
  meal_type: string | null;
}

function toNutritionData(row: MealRow): MealNutritionData {
  return {
    calories: row.calories,
    protein_g: row.protein_g,
    carbs_g: row.carbs_g,
    fat_g: row.fat_g,
    fiber_g: row.fiber_g,
    ingredients: row.ingredients,
    name: row.name,
    description: row.description,
    category: row.category,
  };
}

export interface TaggedMeal extends MealRow {
  healthTags: HealthTag[];
}

export function useHealthFilteredMeals(tags: HealthTag[]) {
  const [meals, setMeals] = useState<TaggedMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMeals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("meals")
        .select("id, name, description, ingredients, category, calories, protein_g, carbs_g, fat_g, fiber_g, image_url, price, restaurant_id, meal_type")
        .eq("is_available", true)
        .order("order_count", { ascending: false })
        .limit(200);

      if (fetchError) throw fetchError;
      if (!data) return;

      const tagged: TaggedMeal[] = (data as MealRow[]).map(meal => ({
        ...meal,
        healthTags: computeMealHealthTags(toNutritionData(meal)),
      }));

      if (tags.length === 0) {
        setMeals(tagged);
      } else {
        setMeals(tagged.filter(m => tags.every(t => m.healthTags.includes(t))));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load meals";
      console.error("useHealthFilteredMeals:", err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [tags]);

  useEffect(() => {
    fetchMeals();
  }, [fetchMeals]);

  return { meals, loading, error, refresh: fetchMeals };
}