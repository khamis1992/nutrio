// Layer 2: Smart Meal Allocation Engine
// Generates meal plans based on nutrition targets, preferences, and restaurant capacity
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
  meal_type?: string;
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
function scoreMealMacroMatch(meal: Meal, targetCalories: number, targetProtein: number): number {
  // Calorie match (0-40 points)
  const calorieDiff = Math.abs(meal.calories - targetCalories);
  const calorieScore = Math.max(0, 40 - (calorieDiff / Math.max(targetCalories, 1) * 40));
  
  // Protein match (0-40 points) - prioritize protein
  const proteinDiff = Math.abs(meal.protein_g - targetProtein);
  const proteinScore = Math.max(0, 40 - (proteinDiff / Math.max(targetProtein, 1) * 40));
  
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
    
    // Note: Dietary restrictions, allergies and ingredients would need more sophisticated checking
    // This is simplified - in production, you'd check meal ingredients against user preferences
    
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

// Calculate target macros per meal type based on remaining nutrition
function calculateMealTargets(
  remainingCalories: number,
  remainingProtein: number,
  remainingCarbs: number,
  remainingFats: number,
  mealTypesNeeded: string[]
): Record<string, { calories: number; protein: number; carbs: number; fats: number }> {
  const numMeals = mealTypesNeeded.length;
  if (numMeals === 0) return {};
  
  // Distribution ratios for different meal types
  const ratios: Record<string, number> = {
    breakfast: 0.25,
    lunch: 0.35,
    dinner: 0.30,
    snack: 0.10,
  };
  
  // Normalize ratios for only the meal types we need
  const neededRatio = mealTypesNeeded.reduce((sum, type) => sum + (ratios[type] || 0.25), 0);
  const normalizedRatios: Record<string, number> = {};
  mealTypesNeeded.forEach(type => {
    normalizedRatios[type] = (ratios[type] || 0.25) / neededRatio;
  });
  
  const targets: Record<string, { calories: number; protein: number; carbs: number; fats: number }> = {};
  
  mealTypesNeeded.forEach(type => {
    const ratio = normalizedRatios[type];
    targets[type] = {
      calories: Math.round(remainingCalories * ratio),
      protein: Math.round(remainingProtein * ratio),
      carbs: Math.round(remainingCarbs * ratio),
      fats: Math.round(remainingFats * ratio),
    };
  });
  
  return targets;
}

// Generate daily plan using remaining nutrition targets
async function generateDailyPlan(
  userId: string,
  dateStr: string,
  availableMeals: Meal[],
  nutritionTargets: NutritionTargets,
  preferences: UserPreferences,
  supabaseClient: any,
  options: {
    remaining_calories?: number;
    remaining_protein?: number;
    locked_meal_types?: string[];
  } = {}
): Promise<{ plan_items: PlanItem[]; total_calories: number; total_protein: number }> {
  const planItems: PlanItem[] = [];
  const usedRestaurants = new Map<string, number>();
  
  // Determine which meal types to generate
  const allMealTypes = ["breakfast", "lunch", "dinner", "snack"];
  const lockedTypes = new Set(options.locked_meal_types || []);
  const mealTypesToGenerate = allMealTypes.filter(type => !lockedTypes.has(type));
  
  console.log(`Generating for meal types: ${mealTypesToGenerate.join(", ")}`);
  console.log(`Locked meal types: ${Array.from(lockedTypes).join(", ") || "none"}`);
  
  // Use remaining nutrition if provided, otherwise use full targets
  const remainingCalories = options.remaining_calories ?? nutritionTargets.daily_calories;
  const remainingProtein = options.remaining_protein ?? nutritionTargets.protein;
  const remainingCarbs = nutritionTargets.carbs * (remainingCalories / nutritionTargets.daily_calories);
  const remainingFats = nutritionTargets.fats * (remainingCalories / nutritionTargets.daily_calories);
  
  console.log(`Remaining nutrition: ${remainingCalories} cal, ${remainingProtein}g protein`);
  
  // Calculate targets per meal type
  const mealTargets = calculateMealTargets(
    remainingCalories,
    remainingProtein,
    remainingCarbs,
    remainingFats,
    mealTypesToGenerate
  );
  
  // Generate for each meal type
  for (const mealType of mealTypesToGenerate) {
    // Skip snacks if calories are tight
    if (mealType === "snack" && remainingCalories < 1800) {
      continue;
    }
    
    const targets = mealTargets[mealType];
    if (!targets) continue;
    
    // Filter valid meals
    const validMeals = filterValidMeals(availableMeals, preferences)
      .filter(meal => {
        // Enforce variety: max 2 meals from same restaurant
        const restaurantCount = usedRestaurants.get(meal.restaurant_id) || 0;
        return restaurantCount < 2;
      });
    
    if (validMeals.length === 0) {
      console.warn(`No valid meals for ${mealType}`);
      continue;
    }
    
    // Score each meal based on remaining nutrition targets
    const scoredMeals = validMeals.map(meal => {
      const macroScore = scoreMealMacroMatch(
        meal,
        targets.calories,
        targets.protein
      );
      const varietyScore = calculateVarietyScore(planItems, meal);
      const totalScore = macroScore * 0.7 + varietyScore * 0.3;
      
      return {
        meal,
        score: totalScore,
        macroScore,
        varietyScore,
      };
    });
    
    // Sort by score descending (highest score = best match)
    scoredMeals.sort((a, b) => b.score - a.score);
    
    // Select top meal
    const selected = scoredMeals[0];
    
    planItems.push({
      day: 0, // Single day
      meal_type: mealType as "breakfast" | "lunch" | "dinner" | "snack",
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
  
  // Calculate totals
  const totals = planItems.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
    }),
    { calories: 0, protein: 0 }
  );
  
  return {
    plan_items: planItems,
    total_calories: totals.calories,
    total_protein: totals.protein,
  };
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
    // Calculate targets per meal based on daily targets
    const mealTargets = calculateMealTargets(
      dailyTargets.daily_calories,
      dailyTargets.protein,
      dailyTargets.carbs,
      dailyTargets.fats,
      mealStructure.map(m => m.type)
    );
    
    for (const mealSlot of mealStructure) {
      // Skip snacks on days where calories are tight
      if (mealSlot.type === "snack" && dailyTargets.daily_calories < 1800) {
        continue;
      }
      
      const targets = mealTargets[mealSlot.type];
      if (!targets) continue;
      
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
      
      // Score each meal using proper targets
      const scoredMeals = validMeals.map(meal => {
        const macroScore = scoreMealMacroMatch(
          meal,
          targets.calories,
          targets.protein
        );
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
      save_to_database = true,
      // New parameters for smart refresh
      remaining_calories,
      remaining_protein,
      locked_meal_types = [],
      mode = "weekly", // "weekly" or "daily"
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
      .select("daily_calorie_target, protein_target_g, carbs_target_g, fat_target_g")
      .eq("user_id", user_id)
      .single();

    if (profileError || !profile || !profile.daily_calorie_target) {
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
    console.log("Fetching meals from database...");
    const { data: meals, error: mealsError } = await supabaseClient
      .from("meals")
      .select("id, restaurant_id, name, calories, protein_g, carbs_g, fat_g, is_available, meal_type")
      .eq("is_available", true);

    if (mealsError) {
      console.error("Error fetching meals:", JSON.stringify(mealsError, null, 2));
      return new Response(
        JSON.stringify({ 
          error: "Failed to fetch available meals", 
          details: mealsError.message,
          code: mealsError.code 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetched ${meals?.length || 0} meals`);

    if (!meals || meals.length === 0) {
      return new Response(
        JSON.stringify({ error: "No available meals found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch restaurants for response enrichment
    const { data: restaurants, error: restaurantsError } = await supabaseClient
      .from("restaurants")
      .select("id, name, logo_url");

    if (restaurantsError) {
      console.error("Error fetching restaurants:", restaurantsError);
    }

    const restaurantMap = new Map((restaurants || []).map(r => [r.id, r]));

    // Check if this is a daily refresh with locked meals
    const isDailyRefresh = remaining_calories !== undefined && locked_meal_types.length > 0;
    
    if (isDailyRefresh || mode === "daily") {
      // Generate daily plan with remaining nutrition
      console.log("Generating daily plan with remaining nutrition...");
      
      const dailyPlan = await generateDailyPlan(
        user_id,
        week_start_date,
        meals,
        {
          daily_calories: profile.daily_calorie_target,
          protein: profile.protein_target_g,
          carbs: profile.carbs_target_g,
          fats: profile.fat_target_g,
        },
        userPrefs,
        supabaseClient,
        {
          remaining_calories,
          remaining_protein,
          locked_meal_types,
        }
      );
      
      // Create a meals map for quick lookup
      const mealsMap = new Map(meals.map((m: Meal) => [m.id, m]));
      
      // Enrich with restaurant data and nest meal info properly
      const enrichedItems = dailyPlan.plan_items.map(item => {
        const mealData = mealsMap.get(item.meal_id) as Meal | undefined;
        return {
          ...item,
          scheduled_date: week_start_date,
          restaurant: restaurantMap.get(item.restaurant_id) || null,
          // Nest meal data as expected by MealWizard
          meal: {
            id: item.meal_id,
            name: mealData?.name || "Unknown Meal",
            calories: item.calories,
            protein_g: item.protein,
            carbs_g: item.carbs,
            fat_g: item.fats,
            image_url: (mealData as any)?.image_url || null,
          }
        };
      });
      
      // Log behavior event
      await supabaseClient.from("behavior_events").insert({
        user_id: user_id,
        event_type: "daily_plan_generated",
        metadata: {
          date: week_start_date,
          remaining_calories,
          remaining_protein,
          locked_meal_types,
          items_generated: enrichedItems.length,
        },
      });
      
      return new Response(
        JSON.stringify({
          success: true,
          mode: "daily",
          weekly_plan: {
            items: enrichedItems,
          },
          total_calories: dailyPlan.total_calories,
          total_protein: dailyPlan.total_protein,
          message: `Generated ${enrichedItems.length} meals matching your remaining nutrition targets`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate weekly plan(s)
    const variations: WeeklyPlan[] = [];
    
    for (let i = 0; i < generate_variations; i++) {
      // Shuffle meals slightly for variation
      const shuffledMeals = [...meals].sort(() => Math.random() - 0.5);
      
      const plan = await generateWeeklyPlan(
        user_id,
        week_start_date,
        shuffledMeals,
        {
          daily_calories: profile.daily_calorie_target,
          protein: profile.protein_target_g,
          carbs: profile.carbs_target_g,
          fats: profile.fat_target_g,
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
    
    // Create a meals map for quick lookup
    const weeklyMealsMap = new Map(meals.map((m: Meal) => [m.id, m]));
    
    // Enrich plan items with restaurant and meal data
    const enrichedItems = bestPlan.plan_items.map(item => {
      const scheduledDate = new Date(new Date(week_start_date).getTime() + item.day * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const mealData = weeklyMealsMap.get(item.meal_id) as Meal | undefined;
      return {
        ...item,
        scheduled_date: scheduledDate,
        restaurant: restaurantMap.get(item.restaurant_id) || null,
        // Nest meal data as expected by MealWizard
        meal: {
          id: item.meal_id,
          name: mealData?.name || "Unknown Meal",
          calories: item.calories,
          protein_g: item.protein,
          carbs_g: item.carbs,
          fat_g: item.fats,
          image_url: (mealData as any)?.image_url || null,
        }
      };
    });

    // Save to database if requested (disabled - table doesn't exist yet)
    let planId: string | null = null;
    // Note: weekly_meal_plans table doesn't exist, skipping database save
    // if (save_to_database) {
    //   planId = await saveWeeklyPlan(user_id, week_start_date, bestPlan, supabaseClient);
    // }

    return new Response(
      JSON.stringify({
        success: true,
        plan_id: planId,
        plan: {
          ...bestPlan,
          items: enrichedItems,
        },
        weekly_plan: {
          items: enrichedItems,
        },
        variations: generate_variations > 1 ? variations : undefined,
        message: `Weekly plan generated with ${bestPlan.macro_compliance_score}% macro compliance`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in smart-meal-allocator:", error);
    return new Response(
      JSON.stringify({ 
        error: "An unexpected error occurred", 
        details: error?.message || String(error),
        stack: error?.stack || undefined
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
