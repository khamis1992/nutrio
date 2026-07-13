import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DietTag {
  id: string;
  name: string;
  description: string | null;
  category: "preference" | "allergy" | "diet";
}

export interface AllergenTag {
  id: string;
  name: string;
  name_ar: string | null;
  icon: string | null;
  severity: string | null;
  description: string | null;
}

export interface MealAllergen {
  id: string;
  allergen: AllergenTag;
  severity: string;
  notes: string | null;
}

type MealAllergenRow = {
  id: string;
  severity: string | null;
  notes: string | null;
  allergen: AllergenTag | null;
};

type MealAllergenResult = {
  data: MealAllergenRow[] | null;
  error: { message: string } | null;
};

type MealAllergenTable = {
  select: (columns: string) => {
    eq: (column: "meal_id", value: string) => PromiseLike<MealAllergenResult>;
  };
};

export const useDietTags = () => {
  const [dietTags, setDietTags] = useState<DietTag[]>([]);
  const [allergyTags, setAllergyTags] = useState<DietTag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDietTags = async () => {
      try {
        const { data, error } = await supabase
          .from("diet_tags")
          .select("id, name, description")
          .order("name");

        if (error) throw error;

        // Categorize tags based on name patterns
        const tags = (data || []).map(tag => {
          const name = tag.name.toLowerCase();
          let category: "preference" | "allergy" | "diet" = "diet";

          // Allergies
          if (name.includes("nut") || name.includes("dairy") || name.includes("shellfish") ||
              name.includes("egg") || name.includes("wheat") || name.includes("soy") ||
              name.includes("fish") || name.includes("gluten") || name.includes("lactose")) {
            category = "allergy";
          }
          // Dietary preferences (restrictions)
          else if (name.includes("halal") || name.includes("kosher") || name.includes("organic")) {
            category = "preference";
          }

          return {
            id: tag.id,
            name: tag.name,
            description: tag.description,
            category,
          };
        });

        setDietTags(tags.filter(t => t.category !== "allergy"));
        setAllergyTags(tags.filter(t => t.category === "allergy"));
      } catch (err) {
        console.error("Error fetching diet tags:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDietTags();
  }, []);

  return { dietTags, allergyTags, loading };
};

/**
 * Fetch all structured allergen tags from the allergen_tags table.
 */
export const useAllergenTags = () => {
  const [allergens, setAllergens] = useState<AllergenTag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllergens = async () => {
      try {
        const { data, error } = await supabase
          .from("allergen_tags")
          .select("*")
          .order("name");

        if (error) throw error;
        setAllergens(data || []);
      } catch (err) {
        console.error("Error fetching allergen tags:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllergens();
  }, []);

  return { allergens, loading };
};

/**
 * Fetch all allergens linked to a specific meal via the meal_allergens junction table.
 */
export const useMealAllergens = (mealId: string | undefined) => {
  const [mealAllergens, setMealAllergens] = useState<MealAllergen[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!mealId) {
      setMealAllergens([]);
      return;
    }

    const fetchMealAllergens = async () => {
      setLoading(true);
      try {
        const mealAllergenTable = (supabase as unknown as {
          from: (table: "meal_allergens") => MealAllergenTable;
        }).from("meal_allergens");
        const { data, error } = await mealAllergenTable
          .select("id, severity, notes, allergen:allergen_id(*)")
          .eq("meal_id", mealId);

        if (error) throw error;
        setMealAllergens((data ?? [])
          .filter((item): item is MealAllergenRow & { allergen: AllergenTag } => Boolean(item.allergen))
          .map(item => ({
            id: item.id,
            allergen: item.allergen,
            severity: item.severity || "moderate",
            notes: item.notes,
          })));
      } catch (err) {
        console.error("Error fetching meal allergens:", err);
        setMealAllergens([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMealAllergens();
  }, [mealId]);

  return { mealAllergens, loading };
};
