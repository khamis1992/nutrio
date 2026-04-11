import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";

export interface MealIngredient {
  id: string;
  meal_id: string;
  name: string;
  is_default: boolean;
  allergen_tags?: string[];
}

interface IngredientListProps {
  mealId: string;
  removedIngredients: Set<string>;
  onToggle: (ingredientId: string, ingredientName: string) => void;
}

const ALLERGEN_KEYWORDS = [
  "nut", "peanut", "almond", "cashew", "walnut",
  "dairy", "milk", "cheese", "cream", "butter",
  "egg", "wheat", "gluten", "soy", "fish",
  "shellfish", "shrimp", "crab", "lactose",
];

export function IngredientList({ mealId, removedIngredients, onToggle }: IngredientListProps) {
  const { t } = useLanguage();
  const [ingredients, setIngredients] = useState<MealIngredient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mealId) return;

    const fetchIngredients = async () => {
      try {
        const { data, error } = await supabase
          .from("meal_ingredients")
          .select("*")
          .eq("meal_id", mealId)
          .order("is_default", { ascending: false });

        if (error) throw error;
        setIngredients(data || []);
      } catch (err) {
        console.error("Error fetching ingredients:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchIngredients();
  }, [mealId]);

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-muted rounded-xl" />
        ))}
      </div>
    );
  }

  if (ingredients.length === 0) return null;

  return (
    <div className="space-y-2">
      {ingredients.map((ingredient, idx) => {
        const isRemoved = removedIngredients.has(ingredient.id);
        const allergens = ingredient.allergen_tags || [];
        const detectedAllergens = ALLERGEN_KEYWORDS.filter(k =>
          ingredient.name.toLowerCase().includes(k)
        );

        return (
          <motion.div
            key={ingredient.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.03 }}
            onClick={() => onToggle(ingredient.id, ingredient.name)}
            className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border-2 cursor-pointer transition-all ${
              isRemoved
                ? "bg-muted/50 border-border/30 opacity-60"
                : "bg-card border-border/50 hover:border-primary/40"
            }`}
          >
            {/* Checkbox */}
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
              isRemoved
                ? "bg-muted border-muted-foreground/30"
                : "bg-primary border-primary"
            }`}>
              {!isRemoved && (
                <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>

            {/* Name */}
            <span className={`text-sm flex-1 transition-all ${isRemoved ? "line-through text-muted-foreground" : "text-foreground"}`}>
              {ingredient.name}
            </span>

            {/* Allergen warning */}
            {allergens.length > 0 && !isRemoved && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 flex items-center gap-0.5">
                <ShieldAlert className="w-2.5 h-2.5" />
                {allergens[0]}
              </Badge>
            )}

            {/* Removed badge */}
            {isRemoved && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {t("customization_removed", "Removed")}
              </Badge>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
