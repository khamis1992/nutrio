// Layer 2: Smart Meal Allocation Engine
// Generates weekly meal plans based on nutrition targets, preferences, and restaurant capacity
// Uses optimization algorithm with variety constraints

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Meal {
  id: string;
  restaurant_id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  cuisine_type?: string;
  macro_category?: string;
  is_available: boolean;
}

interface NutritionTargets {
  daily_calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

interface UserPreferences {
  cuisine_preferences: string[];
  dietary_restrictions: string[];
  allergies: string[];
  disliked_ingredients: string[];
  preferred_meal_times: Record<string, string>;
  variety_preference: number;
}

interface PlanItem {
  day: number; // 0-6 (Sunday-Saturday)
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  meal_id: string;
  restaurant_id: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

interface WeeklyPlan {
  plan_items: PlanItem[];
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fats: number;
  macro_compliance_score: number;
  variety_score: number;
}

// Score a meal based on macro match
function scoreMealMacroMatch(meal: Meal, dailyTargets: NutritionTargets, mealType: string): number {
  // Ideal macros per meal (assuming 3 main meals + 1 snack)
  const mealCalorieShare = mealType === "snack" ? 0.15 : 0.28;
  const targetMealCalories = dailyTargets.daily_calories * mealCalorieShare;
  const targetMealProtein = dailyTargets.protein * mealCalorieShare;
  
  // Calorie match (0-40 points)
  const calorieDiff = Math.abs(meal.calories - targetMealCalories);
  const calorieScore = Math.max(0, 40 - (calorieDiff / targetMealCalories * 40));
  
  // Protein match (0-40 points) - prioritize protein
  const proteinDiff = Math.abs(meal.protein_g - targetMealProtein);
  const proteinScore = Math.max(0, 40 - (proteinDiff / Math.max(targetMealProtein, 1) * 40));
  
  // Macro balance (0-20 points)
  const totalMacros = meal.protein_g + meal.carbs_g + meal.fat_g;
  if (totalMacros === 0) return 0;
  
  const proteinPct = meal.protein_g / totalMacros;
  const idealProteinPct = 0.30; // 30% protein target
  const balanceScore = Math.max(0, 20 - Math.abs(proteinPct - idealProteinPct) * 100);
  
  return calorieScore + proteinScore + balanceScore;
}

// Filter meals based on dietary restrictions and allergies
function filterValidMeals(
  meals: Meal[],
  preferences: UserPreferences
): Meal[] {
  return meals.filter(meal => {
    // Check availability
    if (!meal.is_available) return false;
    
    // Check dietary restrictions
    if (preferences.dietary_restrictions?.includes("vegetarian") && 
        meal.macro_category?.includes("meat")) {
      return false;
    }
    
    // Note: Allergies and ingredients would need more sophisticated checking
    // This is simplified - in production, you'd check meal ingredients
    
    return true;
  });
}

// Score meals for variety
function calculateVarietyScore(
  selectedMeals: PlanItem[],
  newMeal: Meal
): number {
  let score = 100;
  
  // Penalize same restaurant
  const sameRestaurantCount = selectedMeals.filter(
    item => item.restaurant_id === newMeal.restaurant_id
  ).length;
  score -= sameRestaurantCount * 20;
  
  // Penalize same meal
  const sameMealCount = selectedMeals.filter(
    item => item.meal_id === newMeal.id
  ).length;
  score -= sameMealCount * 50;
  
  return Math.max(0, score);
}

// Generate weekly plan using greedy algorithm with backtracking
async function generateWeeklyPlan(
  userId: string,
  weekStartDate: string,
  availableMeals: Meal[],
  dailyTargets: NutritionTargets,
  preferences: UserPreferences,
  supabaseClient: any
): Promise<WeeklyPlan> {
  const planItems: PlanItem[] = [];
  const usedRestaurants = new Map<string, number>(); // Track restaurant usage
  
  // Define meal structure for each day
  const mealStructure = [
    { type: "breakfast", required: true },
    { type: "lunch", required: true },
    { type: "dinner", required: true },
    { type: "snack", required: false }, // Optional
  ];
  
  // Generate for 7 days
  for (let day = 0; day < 7; day++) {
    for (const mealSlot of mealStructure) {
      // Skip snacks on days where calories are tight
      if (mealSlot.type === "snack" && dailyTargets.daily_calories < 1800) {
        continue;
      }
      
      // Filter and score meals for this slot
      const validMeals = filterValidMeals(availableMeals, preferences)
        .filter(meal => {
          // Enforce variety: max 2 meals from same restaurant per week
          const restaurantCount = usedRestaurants.get(meal.restaurant_id) || 0;
          return restaurantCount < 2;
        });
      
      if (validMeals.length === 0) {
        if (mealSlot.required) {
          console.warn(`No valid meals for day ${day}, ${mealSlot.type}`);
        }
        continue;
      }
      
      // Score each meal
      const scoredMeals = validMeals.map(meal => {
        const macroScore = scoreMealMacroMatch(meal, dailyTargets, mealSlot.type);
        const varietyScore = calculateVarietyScore(planItems, meal);
        const totalScore = macroScore * 0.7 + varietyScore * 0.3;
        
        return {
          meal,
          score: totalScore,
          macroScore,
          varietyScore,
        };
      });
      
      // Sort by score descending
      scoredMeals.sort((a, b) => b.score - a.score);
      
      // Select top meal
      const selected = scoredMeals[0];
      
      planItems.push({
        day,
        meal_type: mealSlot.type as "breakfast" | "lunch" | "dinner" | "snack",
        meal_id: selected.meal.id,
        restaurant_id: selected.meal.restaurant_id,
        calories: selected.meal.calories,
        protein: selected.meal.protein_g,
        carbs: selected.meal.carbs_g,
        fats: selected.meal.fat_g,
      });
      
      // Track restaurant usage
      usedRestaurants.set(
        selected.meal.restaurant_id,
        (usedRestaurants.get(selected.meal.restaurant_id) || 0) + 1
      );
    }
  }
  
  // Calculate totals
  const totals = planItems.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      carbs: acc.carbs + item.carbs,
      fats: acc.fats + item.fats,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );
  
  // Calculate compliance score
  const targetCalories = dailyTargets.daily_calories * 7;
  const targetProtein = dailyTargets.protein * 7;
  
  const calorieCompliance = 100 - Math.min(100, Math.abs(totals.calories - targetCalories) / targetCalories * 100);
  const proteinCompliance = 100 - Math.min(100, Math.abs(totals.protein - targetProtein) / targetProtein * 100);
  const macroComplianceScore = Math.round((calorieCompliance + proteinCompliance) / 2);
  
  // Calculate variety score
  const uniqueRestaurants = new Set(planItems.map(item => item.restaurant_id)).size;
  const uniqueMeals = new Set(planItems.map(item => item.meal_id)).size;
  const varietyScore = Math.round(
    (uniqueRestaurants / Math.max(1, planItems.length * 0.4)) * 50 +
    (uniqueMeals / planItems.length) * 50
  );
  
  return {
    plan_items: planItems,
    total_calories: totals.calories,
    total_protein: totals.protein,
    total_carbs: totals.carbs,
    total_fats: totals.fats,
    macro_compliance_score: macroComplianceScore,
    variety_score: Math.min(100, varietyScore),
  };
}

// Save plan to database
async function saveWeeklyPlan(
  userId: string,
  weekStartDate: string,
  plan: WeeklyPlan,
  supabaseClient: any
): Promise<string> {
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  
  // Create weekly plan record
  const { data: planData, error: planError } = await supabaseClient
    .from("weekly_meal_plans")
    .insert({
      user_id: userId,
      week_start_date: weekStartDate,
      week_end_date: weekEndDate.toISOString().split("T")[0],
      plan_status: "draft",
      total_calories: plan.total_calories,
      total_protein: plan.total_protein,
      total_carbs: plan.total_carbs,
      total_fats: plan.total_fats,
      ai_confidence_score: plan.macro_compliance_score / 100,
      user_accepted: false,
      user_modified: false,
    })
    .select()
    .single();
  
  if (planError || !planData) {
    throw new Error(`Failed to create weekly plan: ${planError?.message}`);
  }
  
  // Create plan items
  const planItems = plan.plan_items.map(item => ({
    plan_id: planData.id,
    meal_id: item.meal_id,
    restaurant_id: item.restaurant_id,
    scheduled_date: new Date(new Date(weekStartDate).getTime() + item.day * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    meal_type: item.meal_type,
    calories: item.calories,
    protein: item.protein,
    carbs: item.carbs,
    fats: item.fats,
    is_ai_suggested: true,
    user_swapped: false,
  }));
  
  const { error: itemsError } = await supabaseClient
    .from("weekly_meal_plan_items")
    .insert(planItems);
  
  if (itemsError) {
    throw new Error(`Failed to create plan items: ${itemsError.message}`);
  }
  
  return planData.id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { 
      user_id, 
      week_start_date,
      generate_variations = 1,
      save_to_database = true 
    } = await req.json();

    // Validation
    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!week_start_date) {
      return new Response(
        JSON.stringify({ error: "week_start_date is required (YYYY-MM-DD)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch user's nutrition profile
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("target_calories, target_protein, target_carbs, target_fats")
      .eq("id", user_id)
      .single();

    if (profileError || !profile || !profile.target_calories) {
      return new Response(
        JSON.stringify({ error: "User nutrition profile not found. Please complete onboarding first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch user preferences
    const { data: preferences, error: prefError } = await supabaseClient
      .from("user_preferences")
      .select("*")
      .eq("user_id", user_id)
      .single();

    const userPrefs: UserPreferences = preferences || {
      cuisine_preferences: [],
      dietary_restrictions: [],
      allergies: [],
      disliked_ingredients: [],
      preferred_meal_times: {},
      variety_preference: 3,
    };

    // Fetch available meals with macros
    const { data: meals, error: mealsError } = await supabaseClient
      .from("meals")
      .select("id, restaurant_id, name, calories, protein_g, carbs_g, fat_g, is_available, cuisine_type, macro_category")
      .eq("is_available", true);

    if (mealsError) {
      console.error("Error fetching meals:", mealsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch available meals" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!meals || meals.length === 0) {
      return new Response(
        JSON.stringify({ error: "No available meals found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate plan(s)
    const variations: WeeklyPlan[] = [];
    
    for (let i = 0; i < generate_variations; i++) {
      // Shuffle meals slightly for variation
      const shuffledMeals = [...meals].sort(() => Math.random() - 0.5);
      
      const plan = await generateWeeklyPlan(
        user_id,
        week_start_date,
        shuffledMeals,
        {
          daily_calories: profile.target_calories,
          protein: profile.target_protein,
          carbs: profile.target_carbs,
          fats: profile.target_fats,
        },
        userPrefs,
        supabaseClient
      );
      
      variations.push(plan);
    }

    // Select best plan (highest compliance score)
    const bestPlan = variations.reduce((best, current) => 
      current.macro_compliance_score > best.macro_compliance_score ? current : best
    );

    // Save to database if requested
    let planId: string | null = null;
    if (save_to_database) {
      planId = await saveWeeklyPlan(user_id, week_start_date, bestPlan, supabaseClient);
      
      // Log behavior event
      await supabaseClient.from("behavior_events").insert({
        user_id: user_id,
        event_type: "plan_generated",
        metadata: {
          plan_id: planId,
          week_start_date,
          compliance_score: bestPlan.macro_compliance_score,
          variety_score: bestPlan.variety_score,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        plan_id: planId,
        plan: bestPlan,
        variations: generate_variations > 1 ? variations : undefined,
        message: `Weekly plan generated with ${bestPlan.macro_compliance_score}% macro compliance`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in smart-meal-allocator:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
