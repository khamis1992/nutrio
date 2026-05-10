import { supabase } from "@/integrations/supabase/client";

export interface TasteProfile {
  favoriteCuisines: string[];
  favoriteRestaurants: string[];
  avoidedMeals: string[];
  preferredMealTypes: Record<string, string>;
  proteinPreference: string;
  spiceLevel: string;
  allergyAvoidances: string[];
  portionPreference: string;
  orderFrequency: { weekday: string; weekend: string };
  topIngredients: string[];
  avoidedIngredients: string[];
  discoveryScore: number;
  totalOrders: number;
  lastCalculated: string;
}

const DEFAULT_PROFILE: TasteProfile = {
  favoriteCuisines: [],
  favoriteRestaurants: [],
  avoidedMeals: [],
  preferredMealTypes: {},
  proteinPreference: "medium",
  spiceLevel: "medium",
  allergyAvoidances: [],
  portionPreference: "standard",
  orderFrequency: { weekday: "unknown", weekend: "unknown" },
  topIngredients: [],
  avoidedIngredients: [],
  discoveryScore: 0,
  totalOrders: 0,
  lastCalculated: "",
};

interface OrderRecord {
  id: string;
  meal_id: string | null;
  restaurant_id: string | null;
  created_at: string;
  status: string;
}

interface MealRecord {
  id: string;
  name: string;
  meal_type: string | null;
  restaurant_id: string | null;
  ingredients: string | null;
  calories: number | null;
  protein_g: number | null;
  restaurant?: { cuisine_type?: string | null };
}

/**
 * Calculates a user's taste profile from their order history.
 * Should be called after every order completion.
 */
export async function calculateTasteProfile(userId: string): Promise<TasteProfile> {
  try {
    // Fetch all completed orders for this user
    const { data: orders, error: orderError } = await supabase
      .from("orders")
      .select("id, meal_id, restaurant_id, created_at, status")
      .eq("user_id", userId)
      .in("status", ["delivered", "completed"])
      .order("created_at", { ascending: false })
      .limit(500);

    if (orderError) throw orderError;

    const orderList = (orders as OrderRecord[]) || [];
    if (orderList.length === 0) {
      return { ...DEFAULT_PROFILE, discoveryScore: 0, totalOrders: 0, lastCalculated: new Date().toISOString() };
    }

    // Get unique meal IDs ordered
    const mealIds = [...new Set(orderList.map(o => o.meal_id).filter(Boolean))] as string[];

    // Fetch meal details
    const { data: meals, error: mealError } = await supabase
      .from("meals")
      .select("id, name, meal_type, restaurant_id, ingredients, calories, protein_g")
      .in("id", mealIds);

    if (mealError) throw mealError;
    const mealMap = new Map<string, MealRecord>();
    (meals || []).forEach(m => mealMap.set(m.id, m));

    // Get all available meals for discovery calculation
    const { count: totalAvailableMeals } = await supabase
      .from("meals")
      .select("*", { count: "exact", head: true })
      .eq("is_available", true);

    // --- Calculate preferences ---

    // 1. Meal frequency
    const mealFrequency = new Map<string, number>();
    orderList.forEach(o => {
      if (o.meal_id) {
        mealFrequency.set(o.meal_id, (mealFrequency.get(o.meal_id) || 0) + 1);
      }
    });

    // 2. Restaurant frequency
    const restaurantFrequency = new Map<string, number>();
    orderList.forEach(o => {
      if (o.restaurant_id) {
        restaurantFrequency.set(o.restaurant_id, (restaurantFrequency.get(o.restaurant_id) || 0) + 1);
      }
    });

    // 3. Favorite restaurants (top 5)
    const favoriteRestaurants = [...restaurantFrequency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    // 4. Meal type preferences
    const mealTypeFrequency: Record<string, number> = {};
    orderList.forEach(o => {
      const meal = o.meal_id ? mealMap.get(o.meal_id) : null;
      const type = meal?.meal_type || "unknown";
      mealTypeFrequency[type] = (mealTypeFrequency[type] || 0) + 1;
    });
    const topMealType = Object.entries(mealTypeFrequency).sort((a, b) => b[1] - a[1])[0];
    const preferredMealTypes: Record<string, string> = {};
    if (topMealType) {
      preferredMealTypes[topMealType[0]] = topMealType[0];
    }

    // 5. Ingredient analysis
    const ingredientCount = new Map<string, number>();
    const orderedMealIds = new Set(mealIds);
    mealMap.forEach(meal => {
      if (meal.ingredients) {
        meal.ingredients.split(",").forEach(ing => {
          const clean = ing.trim().toLowerCase();
          if (clean) ingredientCount.set(clean, (ingredientCount.get(clean) || 0) + 1);
        });
      }
    });
    const topIngredients = [...ingredientCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name]) => name);

    // 6. Protein preference based on ordered meals
    const orderedMeals = [...mealMap.values()];
    const avgProtein = orderedMeals.length > 0
      ? orderedMeals.reduce((sum, m) => sum + (m.protein_g || 0), 0) / orderedMeals.length
      : 0;
    const proteinPreference = avgProtein > 35 ? "high" : avgProtein > 20 ? "medium" : "low";

    // 7. Cuisine detection from meal names/ingredients
    const cuisineKeywords: Record<string, string[]> = {
      arabic: ["shawarma", "kebab", "hummus", "falafel", "tabbouleh", "fattoush", "kabsa", "mandi", "kunafa", "baklava", "machboos", "thareed"],
      mediterranean: ["grilled", "olive", "feta", "tahini", "tzatziki", "tabouleh", "greek", "salad"],
      asian: ["sushi", "noodle", "fried rice", "wok", "teriyaki", "dim sum", "ramen", "curry"],
      american: ["burger", "fries", "sandwich", "steak", "bbq", "wings", "mac and cheese"],
      italian: ["pasta", "pizza", "risotto", "lasagna", "carbonara", "bruschetta"],
      indian: ["biryani", "tikka", "masala", "samosa", "naan", "curry", "paneer"],
      mexican: ["taco", "burrito", "quesadilla", "nachos", "guacamole", "enchilada"],
    };

    const cuisineScores: Record<string, number> = {};
    orderedMeals.forEach(meal => {
      const text = `${meal.name} ${meal.ingredients || ""}`.toLowerCase();
      for (const [cuisine, keywords] of Object.entries(cuisineKeywords)) {
        for (const kw of keywords) {
          if (text.includes(kw)) {
            cuisineScores[cuisine] = (cuisineScores[cuisine] || 0) + 1;
          }
        }
      }
    });
    const favoriteCuisines = Object.entries(cuisineScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cuisine]) => cuisine);

    // 8. Order frequency patterns
    const weekdayOrders = orderList.filter(o => {
      const day = new Date(o.created_at).getDay();
      return day >= 1 && day <= 5;
    }).length;
    const weekendOrders = orderList.length - weekdayOrders;
    const totalDays = Math.max(1, Math.ceil(
      (Date.now() - new Date(orderList[orderList.length - 1].created_at).getTime()) / (1000 * 60 * 60 * 24)
    ));

    const orderFrequency = {
      weekday: weekdayOrders > totalDays * 0.3 / 5 ? "daily" : weekdayOrders > totalDays * 0.1 / 5 ? "frequent" : "occasional",
      weekend: weekendOrders > totalDays * 0.3 / 2 ? "daily" : weekendOrders > totalDays * 0.1 / 2 ? "frequent" : "skip",
    };

    // 9. Discovery score (0 = new, 1 = tried everything)
    const discoveryScore = totalAvailableMeals ? Math.min(1, orderedMealIds.size / totalAvailableMeals) : 0;

    // 10. Detect avoided items (meals shown but never ordered - simplified)
    // We'll mark meals that appeared in the menu often but were never ordered
    const avoidedMeals: string[] = []; // Will be populated by comparing with viewed/browsed meals

    const profile: TasteProfile = {
      favoriteCuisines,
      favoriteRestaurants,
      avoidedMeals,
      preferredMealTypes,
      proteinPreference,
      spiceLevel: "medium", // Default, can be inferred from cuisine
      allergyAvoidances: [], // User-reported, not inferred
      portionPreference: "standard",
      orderFrequency,
      topIngredients,
      avoidedIngredients: [],
      discoveryScore,
      totalOrders: orderList.length,
      lastCalculated: new Date().toISOString(),
    };

    // Save to profiles table
    await supabase
      .from("profiles")
      .update({ taste_profile: profile })
      .eq("user_id", userId);

    return profile;
  } catch (error) {
    console.error("Error calculating taste profile:", error);
    return DEFAULT_PROFILE;
  }
}

export async function getTasteProfile(userId: string): Promise<TasteProfile> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("taste_profile")
      .eq("user_id", userId)
      .single();

    if (error) return DEFAULT_PROFILE;
    return (data?.taste_profile as unknown as TasteProfile) || DEFAULT_PROFILE;
  } catch {
    return DEFAULT_PROFILE;
  }
}
