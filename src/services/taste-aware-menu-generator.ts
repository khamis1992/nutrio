import { supabase } from "@/integrations/supabase/client";
import { TasteProfile } from "./taste-profile-calculator";
import type { MealPlanDay } from "@/lib/meal-plan-generator";

async function callOpenRouter(systemPrompt: string, userPrompt: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("proxy-openrouter", {
    body: { systemPrompt, userPrompt },
  });
  if (error || !data?.content) return "";
  return data.content;
}

interface TasteAwareMeal {
  meal_id: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  day_index: number;
  confidence: number;
  reason: string;
}

interface MealOption {
  id: string;
  name: string;
  meal_type: string | null;
  restaurant_id: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  price: number | null;
  ingredients: string | null;
}

/**
 * Generates a taste-aware weekly meal plan using AI.
 * Falls back to the basic algorithm if AI is unavailable.
 */
export async function generateTasteAwareMealPlan(
  tasteProfile: TasteProfile,
  calorieTarget: number = 2000,
  proteinTarget: number = 120
): Promise<{ days: MealPlanDay[]; recommendations: TasteAwareMeal[] }> {
  // Fetch available meals
  const { data: mealsData } = await supabase
    .from("meals")
    .select("*")
    .eq("is_available", true)
    .not("calories", "is", null)
    .order("rating", { ascending: false })
    .limit(200);

  const meals = (mealsData as MealOption[]) || [];
  if (meals.length === 0) return { days: [], recommendations: [] };

  // Build meal summary for AI prompt
  const mealSummaries = meals.slice(0, 60).map(m => ({
    id: m.id,
    name: m.name,
    type: m.meal_type,
    calories: m.calories,
    protein: m.protein_g,
    price: m.price,
    ingredients: m.ingredients,
  }));

  const orderedMealIds = new Set<string>(); // We'd need this from profile, approximate
  const discoveryMeals = mealSummaries.filter(m => !orderedMealIds.has(m.id));

  const systemPrompt = `You are a nutrition AI for Nutrio, a healthy meal delivery app. Generate a 7-day meal plan JSON.
Respond ONLY with valid JSON, no markdown. Format:
{"meals": [{"meal_id": "id", "meal_type": "breakfast"|"lunch"|"dinner"|"snack", "day_index": 0-6, "confidence": 0-100, "reason": "brief reason"}]}`;

  const userPrompt = `User taste profile:
- Favorite cuisines: ${tasteProfile.favoriteCuisines.join(", ") || "none detected yet"}
- Top ingredients: ${tasteProfile.topIngredients.join(", ") || "none yet"}
- Protein preference: ${tasteProfile.proteinPreference}
- Preferred meal types: ${JSON.stringify(tasteProfile.preferredMealTypes)}
- Spice level: ${tasteProfile.spiceLevel}
- Allergies to avoid: ${tasteProfile.allergyAvoidances.join(", ") || "none"}
- Discovery score: ${Math.round(tasteProfile.discoveryScore * 100)}% (${tasteProfile.totalOrders} total orders)

Macro targets: ${calorieTarget} calories/day, ${proteinTarget}g protein/day
Daily split: breakfast 25%, lunch 35%, dinner 30%, snack 10%

Available meals:
${JSON.stringify(mealSummaries)}

Discovery meals to mix in (~20%): ${JSON.stringify(discoveryMeals.slice(0, 10))}

Generate a 7-day plan (28 meals total). Include ~6 discovery meals. Match taste preferences while hitting macro targets. Give each meal a confidence score and brief reason.`;

  // Try AI generation
  const aiResponse = await callOpenRouter(systemPrompt, userPrompt);

  if (aiResponse) {
    try {
      const parsed = JSON.parse(aiResponse.replace(/```json\n?|\n?```/g, ""));
      type ParsedMeal = { meal_id: string; meal_type?: string; day_index?: number; confidence?: number; reason?: string };
      const recommendations = (parsed.meals || []).map((m: ParsedMeal) => ({
        meal_id: m.meal_id,
        meal_type: m.meal_type || "lunch",
        day_index: m.day_index || 0,
        confidence: m.confidence || 70,
        reason: m.reason || "Recommended based on your preferences",
      }));

      // Build MealPlanDay array from recommendations
      const mealMap = new Map(meals.map(m => [m.id, m]));
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const today = new Date();
      const daysUntilNextSunday = 7 - today.getDay();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() + daysUntilNextSunday);

      const dayPlans: MealPlanDay[] = Array.from({ length: 7 }, (_, i) => {
        const currentDate = new Date(weekStart);
        currentDate.setDate(weekStart.getDate() + i);
        const dayRecs = recommendations.filter(r => r.day_index === i);
        return {
          day: days[i],
          date: currentDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          breakfast: buildMeal(dayRecs.find(r => r.meal_type === "breakfast"), mealMap),
          lunch: buildMeal(dayRecs.find(r => r.meal_type === "lunch"), mealMap),
          dinner: buildMeal(dayRecs.find(r => r.meal_type === "dinner"), mealMap),
          snack: buildMeal(dayRecs.find(r => r.meal_type === "snack"), mealMap),
          dailyCalories: 0,
          dailyProtein: 0,
          dailyPrice: 0,
        };
      });

      return { days: dayPlans, recommendations };
    } catch (parseErr) {
      console.error("Failed to parse AI meal plan:", parseErr);
    }
  }

  // Fallback: use basic generation
  const { generateWeeklyMealPlan } = await import("@/lib/meal-plan-generator");
  const days = await generateWeeklyMealPlan(calorieTarget, proteinTarget);
  return {
    days,
    recommendations: days.flatMap((d, i) =>
      [d.breakfast, d.lunch, d.dinner, d.snack]
        .filter(Boolean)
        .map(m => ({
          meal_id: m!.id,
          meal_type: "lunch" as const,
          day_index: i,
          confidence: 60,
          reason: "Based on your nutrition targets",
        }))
    ),
  };
}

type BuildMealResult = {
  id: string; name: string; description: null; calories: number | null; protein_g: number | null;
  carbs_g: number | null; fat_g: number | null; price: number | null; restaurant_name: null;
  meal_type: string | null; rating: null; image_url: null; tags: null;
  is_vegetarian: null; is_vegan: null; is_gluten_free: null;
} | null;
function buildMeal(rec: { meal_id: string } | undefined, mealMap: Map<string, MealOption>): BuildMealResult {
  if (!rec) return null;
  const m = mealMap.get(rec.meal_id);
  if (!m) return null;
  return {
    id: m.id,
    name: m.name,
    description: null,
    calories: m.calories,
    protein_g: m.protein_g,
    carbs_g: m.carbs_g,
    fat_g: m.fat_g,
    price: m.price,
    restaurant_name: null,
    meal_type: m.meal_type,
    rating: null,
    image_url: null,
    tags: null,
    is_vegetarian: null,
    is_vegan: null,
    is_gluten_free: null,
  };
}
