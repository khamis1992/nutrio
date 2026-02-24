// Layer 1: Nutrition Profile Engine
// Calculates personalized nutrition targets based on user biometrics
// Mifflin-St Jeor BMR equation with TDEE and macro distribution

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NutritionProfileInput {
  gender: "male" | "female";
  age: number;
  height_cm: number;
  weight_kg: number;
  activity_level: "sedentary" | "light" | "moderate" | "active" | "very_active";
  goal: "fat_loss" | "muscle_gain" | "maintenance";
  training_days_per_week?: number;
  food_preferences?: string[];
  allergies?: string[];
}

interface NutritionProfileOutput {
  bmr: number;
  tdee: number;
  target_calories: number;
  macros: {
    protein: number;
    carbs: number;
    fats: number;
  };
  macro_percentages: {
    protein_pct: number;
    carbs_pct: number;
    fats_pct: number;
  };
  meal_distribution: {
    breakfast: number;
    lunch: number;
    dinner: number;
    snacks: number;
  };
}

// Mifflin-St Jeor BMR Calculation
function calculateBMR(input: NutritionProfileInput): number {
  const { gender, age, height_cm, weight_kg } = input;
  
  // Mifflin-St Jeor Equation
  // Male: (10 × weight) + (6.25 × height) - (5 × age) + 5
  // Female: (10 × weight) + (6.25 × height) - (5 × age) - 161
  let bmr = (10 * weight_kg) + (6.25 * height_cm) - (5 * age);
  
  if (gender === "male") {
    bmr += 5;
  } else {
    bmr -= 161;
  }
  
  return Math.round(bmr);
}

// TDEE Multipliers based on activity level
function getTDEEMultiplier(activityLevel: string): number {
  const multipliers: Record<string, number> = {
    sedentary: 1.2,      // Little to no exercise
    light: 1.375,        // Light exercise 1-3 days/week
    moderate: 1.55,      // Moderate exercise 3-5 days/week
    active: 1.725,       // Heavy exercise 6-7 days/week
    very_active: 1.9,    // Very heavy exercise, physical job
  };
  
  return multipliers[activityLevel] || 1.375;
}

// Calculate TDEE
function calculateTDEE(bmr: number, activityLevel: string): number {
  const multiplier = getTDEEMultiplier(activityLevel);
  return Math.round(bmr * multiplier);
}

// Calculate target calories based on goal
function calculateTargetCalories(tdee: number, goal: string): number {
  const adjustments: Record<string, number> = {
    fat_loss: -500,      // 500 cal deficit for ~0.5kg/week loss
    muscle_gain: 300,    // 300 cal surplus for muscle growth
    maintenance: 0,      // No adjustment
  };
  
  const adjustment = adjustments[goal] || 0;
  return Math.round(tdee + adjustment);
}

// Calculate macro targets based on goal
function calculateMacros(targetCalories: number, goal: string, weightKg: number) {
  let proteinPct: number;
  let carbsPct: number;
  let fatsPct: number;
  
  switch (goal) {
    case "fat_loss":
      // Higher protein for muscle preservation, moderate carbs/fats
      proteinPct = 0.40;
      carbsPct = 0.30;
      fatsPct = 0.30;
      break;
    case "muscle_gain":
      // Moderate protein, higher carbs for energy and growth
      proteinPct = 0.30;
      carbsPct = 0.45;
      fatsPct = 0.25;
      break;
    case "maintenance":
    default:
      // Balanced macros
      proteinPct = 0.30;
      carbsPct = 0.40;
      fatsPct = 0.30;
      break;
  }
  
  // Calculate grams
  const protein = Math.round((targetCalories * proteinPct) / 4); // 4 cal/g
  const carbs = Math.round((targetCalories * carbsPct) / 4);     // 4 cal/g
  const fats = Math.round((targetCalories * fatsPct) / 9);       // 9 cal/g
  
  // Minimum protein check: at least 1.6g per kg bodyweight for active individuals
  const minProtein = Math.round(weightKg * 1.6);
  const finalProtein = Math.max(protein, minProtein);
  
  // Recalculate percentages if protein was adjusted
  const finalProteinPct = (finalProtein * 4) / targetCalories;
  const remainingCals = targetCalories - (finalProtein * 4);
  const finalCarbs = Math.round((remainingCals * 0.6) / 4); // 60% of remaining to carbs
  const finalFats = Math.round((remainingCals * 0.4) / 9);  // 40% of remaining to fats
  
  return {
    protein: finalProtein,
    carbs: finalCarbs,
    fats: finalFats,
    percentages: {
      protein_pct: Math.round(finalProteinPct * 100),
      carbs_pct: Math.round((finalCarbs * 4) / targetCalories * 100),
      fats_pct: Math.round((finalFats * 9) / targetCalories * 100),
    },
  };
}

// Meal distribution throughout the day
function calculateMealDistribution(goal: string) {
  const distributions: Record<string, { breakfast: number; lunch: number; dinner: number; snacks: number }> = {
    fat_loss: {
      breakfast: 0.25,  // 25% - important meal to start metabolism
      lunch: 0.35,      // 35% - largest meal for energy
      dinner: 0.25,     // 25% - lighter dinner
      snacks: 0.15,     // 15% - protein-focused snacks
    },
    muscle_gain: {
      breakfast: 0.30,  // 30% - heavy breakfast
      lunch: 0.30,      // 30% - substantial lunch
      dinner: 0.30,     // 30% - recovery dinner
      snacks: 0.10,     // 10% - minimal snacks
    },
    maintenance: {
      breakfast: 0.25,  // 25% - balanced
      lunch: 0.35,      // 35% - largest
      dinner: 0.30,     // 30% - substantial
      snacks: 0.10,     // 10% - light
    },
  };
  
  return distributions[goal] || distributions.maintenance;
}

// Main calculation function
function calculateNutritionProfile(input: NutritionProfileInput): NutritionProfileOutput {
  const bmr = calculateBMR(input);
  const tdee = calculateTDEE(bmr, input.activity_level);
  const targetCalories = calculateTargetCalories(tdee, input.goal);
  const macros = calculateMacros(targetCalories, input.goal, input.weight_kg);
  const mealDistribution = calculateMealDistribution(input.goal);
  
  return {
    bmr,
    tdee,
    target_calories: targetCalories,
    macros: {
      protein: macros.protein,
      carbs: macros.carbs,
      fats: macros.fats,
    },
    macro_percentages: macros.percentages,
    meal_distribution: mealDistribution,
  };
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Parse request
    const { user_id, profile_data, save_to_database = true } = await req.json();

    // Validate inputs
    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile_data) {
      return new Response(
        JSON.stringify({ error: "profile_data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate required fields
    const requiredFields = ["gender", "age", "height_cm", "weight_kg", "activity_level", "goal"];
    const missingFields = requiredFields.filter(field => !profile_data[field]);
    
    if (missingFields.length > 0) {
      return new Response(
        JSON.stringify({ error: `Missing required fields: ${missingFields.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate ranges
    if (profile_data.age < 13 || profile_data.age > 100) {
      return new Response(
        JSON.stringify({ error: "Age must be between 13 and 100" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (profile_data.weight_kg < 30 || profile_data.weight_kg > 300) {
      return new Response(
        JSON.stringify({ error: "Weight must be between 30kg and 300kg" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (profile_data.height_cm < 100 || profile_data.height_cm > 250) {
      return new Response(
        JSON.stringify({ error: "Height must be between 100cm and 250cm" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate nutrition profile
    const nutritionProfile = calculateNutritionProfile(profile_data as NutritionProfileInput);

    // Save to database if requested
    if (save_to_database) {
      const { error: updateError } = await supabaseClient
        .from("profiles")
        .update({
          bmr: nutritionProfile.bmr,
          tdee: nutritionProfile.tdee,
          target_calories: nutritionProfile.target_calories,
          target_protein: nutritionProfile.macros.protein,
          target_carbs: nutritionProfile.macros.carbs,
          target_fats: nutritionProfile.macros.fats,
          nutrition_profile_version: 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user_id);

      if (updateError) {
        console.error("Error saving nutrition profile:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to save nutrition profile" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Save user preferences if provided
      if (profile_data.food_preferences || profile_data.allergies) {
        const { error: prefError } = await supabaseClient
          .from("user_preferences")
          .upsert({
            user_id: user_id,
            cuisine_preferences: profile_data.food_preferences || [],
            allergies: profile_data.allergies || [],
            updated_at: new Date().toISOString(),
          }, {
            onConflict: "user_id",
          });

        if (prefError) {
          console.error("Error saving user preferences:", prefError);
        }
      }

      // Log behavior event
      await supabaseClient.from("behavior_events").insert({
        user_id: user_id,
        event_type: "nutrition_profile_created",
        metadata: {
          bmr: nutritionProfile.bmr,
          tdee: nutritionProfile.tdee,
          target_calories: nutritionProfile.target_calories,
          goal: profile_data.goal,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        nutrition_profile: nutritionProfile,
        message: "Nutrition profile calculated successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in nutrition-profile-engine:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
