import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MealScore {
  meal_id: string;
  name: string;
  description: string | null;
  restaurant_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  image_url: string | null;
  meal_type: string | null;
  match_score: number;
  match_reasons: string[];
  diet_tags: string[];
}

interface NutritionTargets {
  daily_calorie_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
  fiber_target_g: number | null;
}

function scoreMeal(
  meal: any,
  targets: NutritionTargets,
  userDietTagIds: string[],
  mealDietTags: Map<string, string[]>,
  allergenMealIds: Set<string>,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  if (allergenMealIds.has(meal.id)) {
    return { score: 0, reasons: ["Contains allergens"] };
  }

  const idealCal = targets.daily_calorie_target / 3;
  const calRatio = Math.abs(meal.calories - idealCal) / idealCal;
  const calScore = Math.max(0, 40 - calRatio * 40);
  score += calScore;
  if (calScore > 30) reasons.push("Calorie match");
  else if (calScore > 20) reasons.push("Good calorie range");

  const idealP = targets.protein_target_g / 3;
  const pRatio = Math.abs(meal.protein_g - idealP) / Math.max(idealP, 1);
  const pScore = Math.max(0, 35 - pRatio * 35);
  score += pScore;
  if (pScore > 25) reasons.push("High protein");
  else if (pScore > 15) reasons.push("Good protein");

  const mealTags = mealDietTags.get(meal.id) || [];
  const matchedTags = mealTags.filter((t) => userDietTagIds.includes(t));
  const tagBonus = Math.min(matchedTags.length * 5, 15);
  score += tagBonus;
  if (tagBonus > 0) reasons.push("Diet preference match");

  const totalM = meal.protein_g + meal.carbs_g + meal.fat_g;
  if (totalM > 0) {
    const bScore = 10 - Math.abs(meal.protein_g / totalM - 0.3) * 100;
    const balanceScore = Math.max(0, bScore);
    score += balanceScore;
    if (balanceScore > 8) reasons.push("Balanced macros");
  }

  return { score: Math.round(Math.min(score, 100)), reasons };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { limit, cuisine, mealType } = await req.json().catch(() => ({}));

    const { data: activeGoal } = await supabaseClient
      .from("nutrition_goals")
      .select("daily_calorie_target, protein_target_g, carbs_target_g, fat_target_g, fiber_target_g")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    const targets: NutritionTargets = {
      daily_calorie_target: activeGoal?.daily_calorie_target || 2000,
      protein_target_g: activeGoal?.protein_target_g || 120,
      carbs_target_g: activeGoal?.carbs_target_g || 250,
      fat_target_g: activeGoal?.fat_target_g || 65,
      fiber_target_g: activeGoal?.fiber_target_g || null,
    };

    const { data: userPrefs } = await supabaseClient
      .from("user_dietary_preferences")
      .select("diet_tag_id")
      .eq("user_id", user.id);

    const userDietTagIds = (userPrefs || []).map((p) => p.diet_tag_id);

    const { data: userAllergens } = await supabaseClient
      .from("user_allergens")
      .select("allergen_id")
      .eq("user_id", user.id);

    let allergenMealIds = new Set<string>();
    if (userAllergens && userAllergens.length > 0) {
      const allergenIds = userAllergens.map((a) => a.allergen_id);
      const { data: mealAllergens } = await supabaseClient
        .from("meal_allergens")
        .select("meal_id")
        .in("allergen_id", allergenIds);
      allergenMealIds = new Set((mealAllergens || []).map((m) => m.meal_id));
    }

    let query = supabaseClient
      .from("meals")
      .select("id, name, description, calories, protein_g, carbs_g, fat_g, fiber_g, image_url, meal_type, restaurants:restaurant_id(name)")
      .eq("is_available", true);

    if (cuisine) query = query.ilike("meal_type", `%${cuisine}%`);
    if (mealType) query = query.eq("meal_type", mealType);

    const { data: meals, error: mealsError } = await query
      .order("created_at", { ascending: false })
      .limit(limit || 80);

    if (mealsError) throw mealsError;

    const mealIds = (meals || []).map((m: any) => m.id);

    const { data: mealTagsData } = await supabaseClient
      .from("meal_diet_tags")
      .select("meal_id, diet_tag_id")
      .in("meal_id", mealIds);

    const mealDietTags = new Map<string, string[]>();
    for (const mt of mealTagsData || []) {
      const existing = mealDietTags.get(mt.meal_id) || [];
      existing.push(mt.diet_tag_id);
      mealDietTags.set(mt.meal_id, existing);
    }

    const scored: MealScore[] = (meals || []).map((meal: any) => {
      const { score, reasons } = scoreMeal(meal, targets, userDietTagIds, mealDietTags, allergenMealIds);
      return {
        meal_id: meal.id,
        name: meal.name,
        description: meal.description,
        restaurant_name: meal.restaurants?.name || "Unknown",
        calories: meal.calories,
        protein_g: meal.protein_g,
        carbs_g: meal.carbs_g,
        fat_g: meal.fat_g,
        fiber_g: meal.fiber_g,
        image_url: meal.image_url,
        meal_type: meal.meal_type,
        match_score: score,
        match_reasons: reasons,
        diet_tags: mealDietTags.get(meal.id) || [],
      };
    });

    scored.sort((a, b) => b.match_score - a.match_score);

    return new Response(
      JSON.stringify({
        meals: scored,
        targets,
        total: scored.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
