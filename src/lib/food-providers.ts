import { supabase } from "@/integrations/supabase/client";
import { normalizeNutrition, type NutritionFacts } from "@/lib/nutrition-types";

export type FoodSource = "nutrio" | "recent" | "barcode" | "manual";

export interface FoodSearchItem extends NutritionFacts {
  id: string;
  name: string;
  source: FoodSource;
  image_url?: string | null;
  brand?: string | null;
  serving_label?: string | null;
}

export interface FoodProvider {
  id: FoodSource;
  search(query: string, limit: number): Promise<FoodSearchItem[]>;
}

interface MealHistoryFoodRow {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
  sugar_g?: number;
  sodium_mg?: number;
  image_url?: string | null;
}

const normalizedKey = (item: FoodSearchItem) =>
  `${item.name.trim().toLocaleLowerCase()}|${Math.round(item.calories)}`;

export class FoodProviderRegistry {
  constructor(private readonly providers: FoodProvider[]) {}

  async search(query: string, limit = 20): Promise<FoodSearchItem[]> {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) return [];

    const settled = await Promise.allSettled(
      this.providers.map((provider) => provider.search(normalizedQuery, limit)),
    );
    const seen = new Set<string>();

    return settled
      .flatMap((result) => result.status === "fulfilled" ? result.value : [])
      .sort((a, b) => {
        const aStarts = a.name.toLocaleLowerCase().startsWith(normalizedQuery.toLocaleLowerCase()) ? 1 : 0;
        const bStarts = b.name.toLocaleLowerCase().startsWith(normalizedQuery.toLocaleLowerCase()) ? 1 : 0;
        return bStarts - aStarts || Number(b.source === "recent") - Number(a.source === "recent");
      })
      .filter((item) => {
        const key = normalizedKey(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, limit);
  }
}

export function createFoodProviderRegistry(userId: string): FoodProviderRegistry {
  const recentProvider: FoodProvider = {
    id: "recent",
    async search(query, limit) {
      const { data, error } = await supabase
        .from("meal_history")
        .select("*")
        .eq("user_id", userId)
        .ilike("name", `%${query}%`)
        .order("logged_at", { ascending: false })
        .limit(limit);
      if (error) throw error;

      return ((data || []) as unknown as MealHistoryFoodRow[]).map((row) => ({
        id: `recent:${row.id}`,
        name: row.name,
        source: "recent" as const,
        image_url: row.image_url,
        ...normalizeNutrition(row),
      }));
    },
  };

  const nutrioProvider: FoodProvider = {
    id: "nutrio",
    async search(query, limit) {
      const { data, error } = await supabase
        .from("meals")
        .select("id, name, vendor, calories, protein_g, carbs_g, fat_g, fiber_g, image_url")
        .is("deleted_at", null)
        .eq("is_available", true)
        .ilike("name", `%${query}%`)
        .limit(limit);
      if (error) throw error;

      return (data || []).map((row) => ({
        id: `nutrio:${row.id}`,
        name: row.name,
        source: "nutrio" as const,
        image_url: row.image_url,
        brand: row.vendor,
        serving_label: "1 meal",
        ...normalizeNutrition(row),
      }));
    },
  };

  return new FoodProviderRegistry([recentProvider, nutrioProvider]);
}
