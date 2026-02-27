import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DietTag {
  id: string;
  name: string;
  description: string | null;
  category: "preference" | "allergy" | "diet";
}

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
