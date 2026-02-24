// Layer 3: Dynamic Adjustment Engine
// Analyzes user progress and automatically adjusts nutrition targets
// Implements evidence-based adjustment logic for weight loss plateaus, adherence issues, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WeightLog {
  id: string;
  user_id: string;
  weight_kg: number;
  logged_at: string;
}

interface WeeklyAdherence {
  week_start: string;
  adherence_rate: number;
  meals_planned: number;
  meals_ordered: number;
}

interface AdjustmentRecommendation {
  type: "calorie" | "macro" | "meal_timing" | "no_change";
  calorie_adjustment: number;
  macro_adjustments: {
    protein?: number;
    carbs?: number;
    fats?: number;
  };
  reasoning: string;
  confidence_score: number;
  suggested_actions: string[];
}

// Calculate weight change velocity (kg per week)
function calculateWeightVelocity(weightLogs: WeightLog[]): number {
  if (weightLogs.length < 2) return 0;
  
  // Sort by date
  const sorted = [...weightLogs].sort((a, b) => 
    new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()
  );
  
  const oldest = sorted[0];
  const newest = sorted[sorted.length - 1];
  
  const weightChange = newest.weight_kg - oldest.weight_kg;
  const daysDiff = (new Date(newest.logged_at).getTime() - new Date(oldest.logged_at).getTime()) / (1000 * 60 * 60 * 24);
  const weeksDiff = daysDiff / 7;
  
  return weeksDiff > 0 ? weightChange / weeksDiff : 0;
}

// Detect plateau (3+ weeks with <0.1kg change)
function detectPlateau(weightLogs: WeightLog[]): boolean {
  if (weightLogs.length < 4) return false;
  
  const sorted = [...weightLogs].sort((a, b) => 
    new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
  );
  
  // Check last 4 logs
  const recentLogs = sorted.slice(0, 4);
  const weights = recentLogs.map(log => log.weight_kg);
  const maxWeight = Math.max(...weights);
  const minWeight = Math.min(...weights);
  
  // Plateau if range is less than 0.2kg over 4 measurements
  return (maxWeight - minWeight) < 0.2;
}

// Calculate average adherence over last N weeks
function calculateAverageAdherence(weeklyAdherence: WeeklyAdherence[]): number {
  if (weeklyAdherence.length === 0) return 100;
  
  const sum = weeklyAdherence.reduce((acc, week) => acc + week.adherence_rate, 0);
  return sum / weeklyAdherence.length;
}

// Generate adjustment recommendations
function generateAdjustmentRecommendation(
  currentCalories: number,
  currentProtein: number,
  currentCarbs: number,
  currentFats: number,
  weightVelocity: number,
  isPlateau: boolean,
  avgAdherence: number,
  goal: string
): AdjustmentRecommendation {
  let recommendation: AdjustmentRecommendation = {
    type: "no_change",
    calorie_adjustment: 0,
    macro_adjustments: {},
    reasoning: "No adjustment needed at this time.",
    confidence_score: 0.8,
    suggested_actions: [],
  };
  
  // Case 1: Weight loss too slow (goal = fat_loss)
  if (goal === "fat_loss" && weightVelocity > -0.25 && !isPlateau) {
    recommendation = {
      type: "calorie",
      calorie_adjustment: -150,
      macro_adjustments: {
        protein: 10, // Increase protein to preserve muscle
        carbs: -25,
        fats: -5,
      },
      reasoning: "Weight loss has been slower than optimal (<0.25kg/week). Reducing calories by 150 while maintaining protein to preserve lean mass.",
      confidence_score: 0.75,
      suggested_actions: [
        "Consider increasing daily steps to 8,000-10,000",
        "Focus on protein-rich meals to maintain satiety",
        "Ensure adequate hydration (2-3L water daily)",
      ],
    };
  }
  
  // Case 2: Weight loss too fast (risk of muscle loss)
  else if (goal === "fat_loss" && weightVelocity < -1.0) {
    recommendation = {
      type: "calorie",
      calorie_adjustment: 100,
      macro_adjustments: {
        protein: 10,
        carbs: 10,
        fats: 0,
      },
      reasoning: "Weight loss is too rapid (>1kg/week), which may lead to muscle loss. Increasing calories slightly to ensure sustainable progress.",
      confidence_score: 0.85,
      suggested_actions: [
        "Add one small healthy snack (150-200 calories)",
        "Prioritize strength training 3x per week",
        "Monitor energy levels and recovery",
      ],
    };
  }
  
  // Case 3: Plateau detected
  else if (isPlateau) {
    if (avgAdherence < 70) {
      // Adherence issue
      recommendation = {
        type: "meal_timing",
        calorie_adjustment: 0,
        macro_adjustments: {},
        reasoning: "Weight plateau detected but adherence is low (" + Math.round(avgAdherence) + "%). Focus on consistency before adjusting targets.",
        confidence_score: 0.7,
        suggested_actions: [
          "Review meal plan and swap less-preferred meals",
          "Set up meal reminders on your phone",
          "Consider meal prepping on weekends",
          "Try ordering meals 2-3 days in advance",
        ],
      };
    } else {
      // True plateau despite good adherence
      recommendation = {
        type: "calorie",
        calorie_adjustment: -100,
        macro_adjustments: {
          protein: 5,
          carbs: -20,
          fats: 0,
        },
        reasoning: "Weight plateau detected despite good adherence. Implementing a small calorie reduction to break through the plateau.",
        confidence_score: 0.8,
        suggested_actions: [
          "Try intermittent fasting (16:8) if appropriate",
          "Add 20-30 minutes of light cardio daily",
          "Ensure 7-8 hours of quality sleep",
          "Consider a 'diet break' week at maintenance calories",
        ],
      };
    }
  }
  
  // Case 4: Low adherence
  else if (avgAdherence < 60) {
    recommendation = {
      type: "meal_timing",
      calorie_adjustment: 0,
      macro_adjustments: {},
      reasoning: "Plan adherence is low (" + Math.round(avgAdherence) + "%). Let's adjust your meal schedule and preferences to better fit your lifestyle.",
      confidence_score: 0.65,
      suggested_actions: [
        "Schedule a call with our nutritionist",
        "Regenerate your meal plan with updated preferences",
        "Try flexible meal timing (eat when hungry)",
        "Focus on just 2-3 consistent days per week first",
      ],
    };
  }
  
  // Case 5: Muscle gain goal - progress check
  else if (goal === "muscle_gain") {
    if (weightVelocity < 0.1) {
      recommendation = {
        type: "calorie",
        calorie_adjustment: 200,
        macro_adjustments: {
          protein: 15,
          carbs: 30,
          fats: 5,
        },
        reasoning: "Weight gain is minimal. Increasing calories to support muscle growth with emphasis on protein and carbs for training.",
        confidence_score: 0.8,
        suggested_actions: [
          "Ensure you're training with progressive overload",
          "Add a post-workout protein shake",
          "Increase meal frequency to 4-5 meals/day",
          "Prioritize sleep for recovery (7-9 hours)",
        ],
      };
    } else if (weightVelocity > 0.5) {
      recommendation = {
        type: "calorie",
        calorie_adjustment: -100,
        macro_adjustments: {
          carbs: -20,
        },
        reasoning: "Weight gain is rapid (" + weightVelocity.toFixed(2) + "kg/week). Some may be fat. Reducing slightly to optimize muscle-to-fat ratio.",
        confidence_score: 0.75,
        suggested_actions: [
          "Focus on high-quality protein sources",
          "Track body measurements, not just weight",
          "Ensure intensity during resistance training",
        ],
      };
    }
  }
  
  return recommendation;
}

// Save adjustment to database
async function saveAdjustment(
  userId: string,
  recommendation: AdjustmentRecommendation,
  currentValues: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  },
  weightVelocity: number,
  adherenceRate: number,
  supabaseClient: any
): Promise<void> {
  const newValues = {
    calories: currentValues.calories + recommendation.calorie_adjustment,
    protein: currentValues.protein + (recommendation.macro_adjustments.protein || 0),
    carbs: currentValues.carbs + (recommendation.macro_adjustments.carbs || 0),
    fats: currentValues.fats + (recommendation.macro_adjustments.fats || 0),
  };
  
  await supabaseClient.from("ai_nutrition_adjustments").insert({
    user_id: userId,
    adjustment_type: recommendation.type,
    previous_values: currentValues,
    new_values: newValues,
    ai_reason: recommendation.reasoning,
    confidence_score: recommendation.confidence_score,
    user_adherence_rate: adherenceRate,
    weight_velocity: weightVelocity,
  });
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
      auto_apply = false,
      weeks_of_history = 4 
    } = await req.json();

    // Validation
    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch user's current nutrition profile
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("target_calories, target_protein, target_carbs, target_fats, goal, weight_kg")
      .eq("id", user_id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch weight logs for last N weeks
    const weeksAgo = new Date();
    weeksAgo.setDate(weeksAgo.getDate() - (weeks_of_history * 7));
    
    const { data: weightLogs, error: weightError } = await supabaseClient
      .from("weight_logs")
      .select("id, weight_kg, logged_at")
      .eq("user_id", user_id)
      .gte("logged_at", weeksAgo.toISOString())
      .order("logged_at", { ascending: false });

    if (weightError) {
      console.error("Error fetching weight logs:", weightError);
    }

    // Fetch weekly adherence data
    const { data: adherenceData, error: adherenceError } = await supabaseClient
      .from("weekly_adherence")
      .select("week_start, adherence_rate, meals_planned, meals_ordered")
      .eq("user_id", user_id)
      .order("week_start", { ascending: false })
      .limit(4);

    if (adherenceError) {
      console.error("Error fetching adherence data:", adherenceError);
    }

    // Calculate metrics
    const weightVelocity = weightLogs && weightLogs.length >= 2
      ? calculateWeightVelocity(weightLogs)
      : 0;
    
    const isPlateau = weightLogs ? detectPlateau(weightLogs) : false;
    
    const avgAdherence = adherenceData
      ? calculateAverageAdherence(adherenceData)
      : 100;

    // Generate recommendation
    const recommendation = generateAdjustmentRecommendation(
      profile.target_calories,
      profile.target_protein,
      profile.target_carbs,
      profile.target_fats,
      weightVelocity,
      isPlateau,
      avgAdherence,
      profile.goal || "maintenance"
    );

    // Save adjustment record
    await saveAdjustment(
      user_id,
      recommendation,
      {
        calories: profile.target_calories,
        protein: profile.target_protein,
        carbs: profile.target_carbs,
        fats: profile.target_fats,
      },
      weightVelocity,
      avgAdherence,
      supabaseClient
    );

    // Apply adjustment if requested and confidence is high enough
    let applied = false;
    if (auto_apply && recommendation.confidence_score >= 0.7 && recommendation.type !== "no_change") {
      const newCalories = profile.target_calories + recommendation.calorie_adjustment;
      const newProtein = profile.target_protein + (recommendation.macro_adjustments.protein || 0);
      const newCarbs = profile.target_carbs + (recommendation.macro_adjustments.carbs || 0);
      const newFats = profile.target_fats + (recommendation.macro_adjustments.fats || 0);

      const { error: updateError } = await supabaseClient
        .from("profiles")
        .update({
          target_calories: newCalories,
          target_protein: newProtein,
          target_carbs: newCarbs,
          target_fats: newFats,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user_id);

      if (!updateError) {
        applied = true;
        
        // Mark adjustment as accepted
        await supabaseClient
          .from("ai_nutrition_adjustments")
          .update({
            was_accepted: true,
            accepted_at: new Date().toISOString(),
          })
          .eq("user_id", user_id)
          .is("was_accepted", null)
          .order("created_at", { ascending: false })
          .limit(1);
      }
    }

    // Log behavior event
    await supabaseClient.from("behavior_events").insert({
      user_id: user_id,
      event_type: "ai_adjustment_generated",
      metadata: {
        adjustment_type: recommendation.type,
        calorie_adjustment: recommendation.calorie_adjustment,
        confidence_score: recommendation.confidence_score,
        weight_velocity: weightVelocity,
        adherence_rate: avgAdherence,
        was_applied: applied,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        recommendation: recommendation,
        metrics: {
          weight_velocity: weightVelocity,
          is_plateau: isPlateau,
          average_adherence: avgAdherence,
          weight_logs_count: weightLogs?.length || 0,
        },
        applied: applied,
        message: applied 
          ? "Adjustment applied successfully" 
          : "Adjustment recommendation generated (review and approve to apply)",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in dynamic-adjustment-engine:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
