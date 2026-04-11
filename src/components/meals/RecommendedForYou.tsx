import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTastePreferences } from "@/hooks/useTastePreferences";
import { TasteMatchBadge } from "./TasteMatchBadge";

interface Meal {
  id: string;
  name: string;
  image_url: string | null;
  calories: number | null;
  protein_g: number | null;
  price: number | null;
  meal_type: string | null;
  restaurant_id: string | null;
  ingredients: string | null;
  rating: number | null;
}

interface ScoredMeal extends Meal {
  matchScore: number;
  isDiscovery: boolean;
  reason: string;
}

export function RecommendedForYou() {
  const { t, language } = useLanguage();
  const { profile, loading: profileLoading } = useTastePreferences();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMeals() {
      const { data } = await supabase
        .from("meals")
        .select("id, name, image_url, calories, protein_g, price, meal_type, restaurant_id, ingredients, rating")
        .eq("is_available", true)
        .order("rating", { ascending: false })
        .limit(50);
      setMeals((data as Meal[]) || []);
      setLoading(false);
    }
    fetchMeals();
  }, []);

  const scoredMeals = useMemo((): ScoredMeal[] => {
    if (profileLoading || !meals.length) return [];

    const orderedMealIds = new Set<string>();
    const reasons: string[] = [];

    // Safe access to taste profile fields (JSONB may have empty object)
    const favCuisines = profile?.favoriteCuisines || [];
    const topIngredients = profile?.topIngredients || [];
    const favRestaurants = profile?.favoriteRestaurants || [];
    const proteinPref = profile?.proteinPreference || "";

    return meals.map(meal => {
      let score = 50;
      let reason = "";
      const isDiscovery = !orderedMealIds.has(meal.id);

      // Cuisine match (0.3)
      if (favCuisines.length > 0) {
        const text = `${meal.name} ${meal.ingredients || ""}`.toLowerCase();
        const cuisineKeywords: Record<string, string[]> = {
          arabic: ["shawarma", "kebab", "hummus", "falafel", "kabsa", "mandi"],
          mediterranean: ["grilled", "olive", "feta", "tahini"],
          asian: ["sushi", "noodle", "fried rice", "wok", "ramen"],
          american: ["burger", "fries", "sandwich", "steak", "bbq", "wings"],
          italian: ["pasta", "pizza", "risotto"],
          indian: ["biryani", "tikka", "masala", "naan", "curry"],
          mexican: ["taco", "burrito", "quesadilla"],
        };
        let maxCuisineMatch = 0;
        for (const cuisine of favCuisines) {
          const keywords = cuisineKeywords[cuisine] || [];
          const matchCount = keywords.filter(kw => text.includes(kw)).length;
          const matchRatio = matchCount / Math.max(1, keywords.length);
          maxCuisineMatch = Math.max(maxCuisineMatch, matchRatio);
        }
        score += maxCuisineMatch * 30;
        if (maxCuisineMatch > 0.5) reason = language === "ar" ? "يطابق ذوقك في المطبخ" : "Matches your cuisine preference";
      }

      // Ingredient overlap (0.3)
      if (topIngredients.length > 0 && meal.ingredients) {
        const mealIngs = meal.ingredients.toLowerCase().split(",").map(s => s.trim());
        const overlap = topIngredients.filter(ing =>
          mealIngs.some(mi => mi.includes(ing))
        ).length;
        const ingScore = (overlap / Math.max(1, topIngredients.length)) * 30;
        score += ingScore;
        if (overlap > 2 && !reason) reason = language === "ar" ? "يحتوي على مكونات تحبها" : "Contains ingredients you love";
      }

      // Restaurant favor (0.2)
      if (favRestaurants.includes(meal.restaurant_id || "")) {
        score += 20;
        if (!reason) reason = language === "ar" ? "من مطعم مفضل لديك" : "From your favorite restaurant";
      }

      // Macro fit (0.2)
      if (proteinPref === "high" && (meal.protein_g || 0) > 30) {
        score += 15;
        if (!reason) reason = language === "ar" ? "غني بالبروتين" : "High in protein";
      }

      // Discovery boost
      if (isDiscovery) {
        score *= 1.2;
        if (!reason) reason = language === "ar" ? "جرب شيئاً جديداً" : "Try something new";
      }

      return {
        ...meal,
        matchScore: Math.min(99, Math.round(score)),
        isDiscovery,
        reason,
      };
    }).sort((a, b) => b.matchScore - a.matchScore).slice(0, 8);
  }, [meals, profile, profileLoading, language]);

  if (loading || profileLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 w-48 bg-gray-200 rounded" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-48 bg-gray-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (scoredMeals.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className={`text-xl font-bold ${language === "ar" ? "text-right" : ""}`}>
            {language === "ar" ? "مقترح لك" : "Recommended For You"}
          </h2>
          <p className="text-sm text-gray-500">
            {language === "ar" ? "بناءً على ذوقك وتفضيلاتك" : "Based on your taste & preferences"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {scoredMeals.map(meal => (
          <Link
            key={meal.id}
            to={`/meals/${meal.id}`}
            className="group relative bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100"
          >
            <div className="relative h-32">
              {meal.image_url ? (
                <img
                  src={meal.image_url}
                  alt={meal.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center">
                  <span className="text-3xl">🍽️</span>
                </div>
              )}
              <TasteMatchBadge score={meal.matchScore} />
              {meal.isDiscovery && (
                <span className="absolute top-2 right-2 bg-purple-100 text-purple-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  {language === "ar" ? "جديد" : "New"}
                </span>
              )}
            </div>
            <div className="p-3">
              <h3 className="font-semibold text-sm text-gray-900 truncate">{meal.name}</h3>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-500">
                  {meal.calories} {language === "ar" ? "سعرة" : "kcal"}
                </span>
                {meal.price && (
                  <span className="text-sm font-bold text-emerald-600">{meal.price} SAR</span>
                )}
              </div>
              {meal.reason && (
                <p className="text-[10px] text-gray-400 mt-1 truncate" title={meal.reason}>
                  💡 {meal.reason}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
