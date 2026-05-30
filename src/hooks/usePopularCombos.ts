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

export function usePopularCombos() {
  const [combos, setCombos] = useState<PopularCombo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch top meals with their restaurant info and review counts
      const { data: meals, error } = await supabase
        .from("meals")
        .select(`
          id,
          name,
          image_url,
          calories,
          protein_g,
          carbs_g,
          fat_g,
          category,
          restaurants (
            name
          )
        `)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error || !meals || meals.length < 3) {
        // Fallback: show featured meals directly
        const { data: anyMeals } = await supabase
          .from("meals")
          .select("id, name, image_url, calories, protein_g, category, restaurants(name)")
          .limit(12);

        if (anyMeals && anyMeals.length >= 3) {
          const combos: PopularCombo[] = [];
          for (let i = 0; i < Math.min(anyMeals.length - 2, 4); i++) {
            const meal = anyMeals[i];
            combos.push({
              id: `combo-${meal.id}`,
              title: meal.name,
              author: (meal as any).restaurants?.name || "Nutrio Chef",
              image: meal.image_url || "",
              likes: 0,
              comments: 0,
              tags: [meal.category || "Healthy"],
              comboMeals: [{
                meal_id: meal.id,
                name: meal.name,
                image_url: meal.image_url,
                restaurant_name: (meal as any).restaurants?.name || "Nutrio",
                calories: meal.calories || 0,
                protein_g: meal.protein_g || 0,
                tag: meal.category || "Healthy",
              }],
            });
          }
          setCombos(combos);
          setLoading(false);
          return;
        }

        setCombos([]);
        setLoading(false);
        return;
      }

      // Create meal combos by pairing complementary meals
      const highProtein = meals.filter((m) => (m.protein_g || 0) >= 25 && (m.calories || 0) <= 600);
      const balanced = meals.filter((m) => (m.protein_g || 0) >= 15 && (m.protein_g || 0) < 25);
      const light = meals.filter((m) => (m.calories || 0) <= 400);

      const combos: PopularCombo[] = [];

      // Generate up to 4 combos
      for (let i = 0; i < 4 && highProtein.length > 0; i++) {
        const main = highProtein[i % highProtein.length];
        const side = balanced[(i + 1) % balanced.length];
        const snack = light[(i + 2) % light.length];

        const tags: string[] = [];
        if (main.protein_g >= 30) tags.push("High Protein");
        if (main.calories <= 400) tags.push("Low Calorie");
        if (!tags.length) tags.push("Balanced");

        combos.push({
          id: `combo-${main.id}`,
          title: main.name,
          author: (main as any).restaurants?.name || "Nutrio Chef",
          image: main.image_url || "",
          likes: 0,
          comments: 0,
          tags: [tags[0]],
          comboMeals: [main, side, snack].map((m) => ({
            meal_id: m.id,
            name: m.name,
            image_url: m.image_url,
            restaurant_name: (m as any).restaurants?.name || "Nutrio",
            calories: m.calories || 0,
            protein_g: m.protein_g || 0,
            tag: m.calories <= 400 ? "Light" : m.protein_g >= 25 ? "Protein" : "Balanced",
          })),
        });
      }

      setCombos(combos);
    } catch (err) {
      console.error("Error fetching popular combos:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { combos, loading, refresh: fetch };
}
