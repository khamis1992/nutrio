import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  assertSelfOrAdmin,
  authenticateRequest,
  enforceRateLimit,
  errorResponse,
  getClientIp,
  getServiceClient,
  handlePreflight,
  HttpError,
  jsonResponse,
  readJsonBody,
  recordSecurityEvent,
  requireInternalSecret,
  requirePost,
  type SecurityPrincipal,
} from "../_shared/security.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface ProgressData {
  body_measurements: Array<{ date: string; weight: number }>;
  calorie_logs: Array<{ date: string; calories: number; target: number }>;
  adherence_rate: number;
  weeks_logged: number;
  current_calories: number;
  current_protein: number;
  current_carbs: number;
  current_fat: number;
  goal: string;
  current_weight: number;
  target_weight: number;
}

interface WeeklyCheckInInput {
  energy_rating: number;
  hunger_rating: number;
  recovery_rating: number;
  plan_adherence_rating: number;
  weight_kg: number | null;
  notes: string | null;
}

interface AdjustmentRecommendation {
  new_calories: number;
  new_protein: number;
  new_carbs: number;
  new_fat: number;
  reason: string;
  confidence: number;
  plateau_detected: boolean;
  suggested_action: string;
}

interface WeightPrediction {
  date: string;
  predicted_weight: number;
  confidence_lower: number;
  confidence_upper: number;
}

// Calculate BMR using Mifflin-St Jeor equation
const calculateBMR = (gender: string, weight: number, height: number, age: number): number => {
  if (gender === "male") {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    return 10 * weight + 6.25 * height - 5 * age - 161;
  }
};

// Smart adjustment algorithm
async function analyzeProgress(
  data: ProgressData,
  checkIn: WeeklyCheckInInput | null = null,
): Promise<AdjustmentRecommendation> {
  const { 
    body_measurements, 
    adherence_rate, 
    weeks_logged, 
    current_calories, 
    current_protein,
    current_carbs,
    current_fat,
    goal,
    current_weight,
    target_weight 
  } = data;
  
  // Calculate weight change rate
  let weightChange = 0;
  let weeklyWeightChange = 0;
  
  if (body_measurements.length >= 2) {
    const firstWeight = body_measurements[0].weight;
    const lastWeight = body_measurements[body_measurements.length - 1].weight;
    weightChange = lastWeight - firstWeight;
    
    const daysTracked = body_measurements.length;
    const weeksTracked = daysTracked / 7;
    weeklyWeightChange = weeksTracked > 0 ? weightChange / weeksTracked : 0;
  }
  
  let recommendation: AdjustmentRecommendation;
  let confidence = 0.7;
  
  // SCENARIO 1: Plateau detected (no weight change for 3+ weeks)
  if (weeks_logged >= 3 && Math.abs(weeklyWeightChange) < 0.1) {
    confidence = 0.85;
    
    if (goal === 'lose') {
      const newCals = Math.max(current_calories - 100, 1200);
      recommendation = {
        new_calories: newCals,
        new_protein: Math.round((newCals * 0.35) / 4),
        new_carbs: Math.round((newCals * 0.35) / 4),
        new_fat: Math.round((newCals * 0.30) / 9),
        reason: "🔍 Plateau detected! Your weight hasn't changed in 3+ weeks. Reducing calories by 100 to break through.",
        confidence,
        plateau_detected: true,
        suggested_action: "Try reducing portions by 10% or add 30 minutes of walking daily"
      };
    } else if (goal === 'gain') {
      const newCals = Math.min(current_calories + 150, 4000);
      recommendation = {
        new_calories: newCals,
        new_protein: Math.round((newCals * 0.30) / 4),
        new_carbs: Math.round((newCals * 0.45) / 4),
        new_fat: Math.round((newCals * 0.25) / 9),
        reason: "🔍 Plateau detected! Not gaining weight as expected. Increasing calories by 150.",
        confidence,
        plateau_detected: true,
        suggested_action: "Add a protein shake or extra healthy snack daily"
      };
    } else {
      recommendation = {
        new_calories: current_calories,
        new_protein: current_protein,
        new_carbs: current_carbs,
        new_fat: current_fat,
        reason: "✅ You're successfully maintaining your weight! No changes needed.",
        confidence: 0.9,
        plateau_detected: false,
        suggested_action: "Keep doing what you're doing!"
      };
    }
  }
  
  // SCENARIO 2: Losing too fast (>1kg/week)
  else if (goal === 'lose' && weeklyWeightChange < -1.0) {
    confidence = 0.8;
    const newCals = Math.min(current_calories + 150, 4000);
    recommendation = {
      new_calories: newCals,
      new_protein: Math.round((newCals * 0.35) / 4),
      new_carbs: Math.round((newCals * 0.35) / 4),
      new_fat: Math.round((newCals * 0.30) / 9),
      reason: `⚠️ You're losing weight very fast (${Math.abs(weeklyWeightChange).toFixed(1)}kg/week). Increasing calories slightly to ensure healthy, sustainable loss.`,
      confidence,
      plateau_detected: false,
      suggested_action: "Add healthy snacks like nuts or fruit to slow down weight loss"
    };
  }
  
  // SCENARIO 3: Losing too slow (<0.25kg/week when trying to lose)
  else if (goal === 'lose' && weeklyWeightChange > -0.25 && weeklyWeightChange < 0) {
    confidence = 0.75;
    const newCals = Math.max(current_calories - 100, 1200);
    recommendation = {
      new_calories: newCals,
      new_protein: Math.round((newCals * 0.35) / 4),
      new_carbs: Math.round((newCals * 0.35) / 4),
      new_fat: Math.round((newCals * 0.30) / 9),
      reason: "📉 Weight loss is slower than optimal. Small calorie adjustment to accelerate progress.",
      confidence,
      plateau_detected: false,
      suggested_action: "Reduce portions slightly or replace high-calorie foods with vegetables"
    };
  }
  
  // SCENARIO 4: Gaining too fast (>1kg/week when bulking)
  else if (goal === 'gain' && weeklyWeightChange > 1.0) {
    confidence = 0.8;
    const newCals = Math.max(current_calories - 100, 1200);
    recommendation = {
      new_calories: newCals,
      new_protein: Math.round((newCals * 0.30) / 4),
      new_carbs: Math.round((newCals * 0.45) / 4),
      new_fat: Math.round((newCals * 0.25) / 9),
      reason: "⚠️ Gaining weight quickly. Slight adjustment to minimize fat gain.",
      confidence,
      plateau_detected: false,
      suggested_action: "Focus on lean protein sources and reduce empty calories"
    };
  }
  
  // SCENARIO 5: Low adherence (not tracking consistently)
  else if (adherence_rate < 0.5) {
    confidence = 0.6;
    recommendation = {
      new_calories: current_calories,
      new_protein: current_protein,
      new_carbs: current_carbs,
      new_fat: current_fat,
      reason: "📊 You're not logging meals consistently. Focus on tracking first before making changes.",
      confidence,
      plateau_detected: false,
      suggested_action: "Try logging just 3 days this week to build the habit. Every log helps!"
    };
  }
  
  // SCENARIO 6: Goal achieved (for weight loss)
  else if (goal === 'lose' && current_weight <= target_weight + 1) {
    confidence = 0.95;
    recommendation = {
      new_calories: Math.round(current_calories * 1.1),
      new_protein: current_protein,
      new_carbs: Math.round((current_calories * 1.1 * 0.40) / 4),
      new_fat: Math.round((current_calories * 1.1 * 0.30) / 9),
      reason: "🎉 Congratulations! You've reached your target weight! Switching to maintenance calories.",
      confidence,
      plateau_detected: false,
      suggested_action: "Update your goal to 'Maintain' to keep your results"
    };
  }
  
  // DEFAULT: No change needed - good progress
  else {
    confidence = 0.9;
    let message = "✅ Great progress! Your current plan is working well. No adjustments needed.";
    
    if (goal === 'lose' && weeklyWeightChange <= -0.5 && weeklyWeightChange >= -1.0) {
      message = "🎯 Perfect pace! You're losing weight at an ideal rate of 0.5-1kg per week.";
    } else if (goal === 'gain' && weeklyWeightChange >= 0.25 && weeklyWeightChange <= 0.5) {
      message = "🎯 Perfect pace! You're gaining muscle at an ideal rate.";
    }
    
    recommendation = {
      new_calories: current_calories,
      new_protein: current_protein,
      new_carbs: current_carbs,
      new_fat: current_fat,
      reason: message,
      confidence,
      plateau_detected: false,
      suggested_action: "Continue with your current plan. Consistency is key!"
    };
  }
  
  if (checkIn) {
    const lowReadiness = checkIn.energy_rating <= 2 || checkIn.recovery_rating <= 2;
    const highHunger = checkIn.hunger_rating >= 4;
    const lowPlanAdherence = checkIn.plan_adherence_rating <= 2;

    if (lowPlanAdherence) {
      recommendation = {
        new_calories: current_calories,
        new_protein: current_protein,
        new_carbs: current_carbs,
        new_fat: current_fat,
        reason: "Your check-in shows the plan was difficult to follow this week. Keep the current targets while we collect a more consistent week of data.",
        confidence: Math.min(recommendation.confidence, 0.62),
        plateau_detected: false,
        suggested_action: "Focus on logging and following the current plan before changing your targets.",
      };
    } else if ((lowReadiness || highHunger) && recommendation.new_calories < current_calories) {
      recommendation = {
        new_calories: current_calories,
        new_protein: current_protein,
        new_carbs: current_carbs,
        new_fat: current_fat,
        reason: "Your energy, recovery, or hunger check-in suggests that lowering calories this week would be premature. Your current targets are recommended for another week.",
        confidence: Math.min(recommendation.confidence, 0.72),
        plateau_detected: recommendation.plateau_detected,
        suggested_action: "Prioritize recovery and consistent meal logging, then review again next week.",
      };
    }
  }

  return recommendation;
}

function sanitizeWeeklyCheckIn(value: unknown): WeeklyCheckInInput | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object") throw new HttpError(400, "invalid_weekly_check_in");
  const input = value as Record<string, unknown>;
  const rating = (key: string) => {
    const parsed = Number(input[key]);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
      throw new HttpError(400, "invalid_weekly_check_in_rating");
    }
    return parsed;
  };
  const weight = input.weight_kg === undefined || input.weight_kg === null || input.weight_kg === ""
    ? null
    : Number(input.weight_kg);
  if (weight !== null && (!Number.isFinite(weight) || weight < 25 || weight > 350)) {
    throw new HttpError(400, "invalid_weekly_check_in_weight");
  }
  const notes = input.notes === undefined || input.notes === null
    ? null
    : String(input.notes).trim().slice(0, 500) || null;

  return {
    energy_rating: rating("energy_rating"),
    hunger_rating: rating("hunger_rating"),
    recovery_rating: rating("recovery_rating"),
    plan_adherence_rating: rating("plan_adherence_rating"),
    weight_kg: weight,
    notes,
  };
}

function normalizeGoal(value: unknown): "lose" | "gain" | "maintain" {
  const goal = String(value || "maintain").toLowerCase();
  if (["lose", "lose_weight", "weight_loss"].includes(goal)) return "lose";
  if (["gain", "gain_weight", "muscle_gain"].includes(goal)) return "gain";
  return "maintain";
}

// Predict weight 4 weeks in the future
async function predictFutureWeight(
  bodyMeasurements: Array<{ date: string; weight: number }>,
  currentCalories: number,
  targetCalories: number,
  goal: string
): Promise<WeightPrediction[]> {
  if (bodyMeasurements.length < 7) {
    return []; // Not enough data
  }
  
  // Simple trend-based prediction
  const recentLogs = bodyMeasurements.slice(-14); // Last 2 weeks
  const weightChange = recentLogs[recentLogs.length - 1].weight - recentLogs[0].weight;
  const weeklyChange = weightChange / 2;
  
  const currentWeight = bodyMeasurements[bodyMeasurements.length - 1].weight;
  const predictions: WeightPrediction[] = [];
  
  for (let i = 1; i <= 4; i++) {
    const predictedWeight = currentWeight + (weeklyChange * i);
    const confidence = Math.max(0.5, 0.95 - (i * 0.1)); // Decreasing confidence
    const variance = (1 - confidence) * 2; // 2kg variance at lowest confidence
    
    predictions.push({
      date: new Date(Date.now() + i * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      predicted_weight: Math.round(predictedWeight * 10) / 10,
      confidence_lower: Math.round((predictedWeight - variance) * 10) / 10,
      confidence_upper: Math.round((predictedWeight + variance) * 10) / 10
    });
  }
  
  return predictions;
}

// Store weekly adherence data
async function storeWeeklyAdherence(
  supabase: any,
  userId: string,
  weekStart: Date
): Promise<void> {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  
  // Calculate adherence stats
  const { data: logs } = await supabase
    .from("progress_logs")
    .select("calories_consumed, log_date")
    .eq("user_id", userId)
    .gte("log_date", weekStart.toISOString().split('T')[0])
    .lte("log_date", weekEnd.toISOString().split('T')[0]);

  const { data: bodyMeasurements } = await supabase
    .from("body_measurements")
    .select("weight_kg, log_date")
    .eq("user_id", userId)
    .gte("log_date", weekStart.toISOString().split('T')[0])
    .lte("log_date", weekEnd.toISOString().split('T')[0])
    .not("weight_kg", "is", null)
    .order("log_date", { ascending: true });
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("daily_calorie_target")
    .eq("user_id", userId)
    .single();
  
  const targetCalories = profile?.daily_calorie_target || 2000;
  const daysLogged = logs?.length || 0;
  const daysOnTarget = logs?.filter((log: any) => 
    Math.abs(log.calories_consumed - targetCalories) <= targetCalories * 0.1
  ).length || 0;
  
  const avgCalories = logs?.length > 0 
    ? Math.round(logs.reduce((sum: number, log: any) => sum + (log.calories_consumed || 0), 0) / logs.length)
    : 0;
  
  const weights = bodyMeasurements?.filter((row: any) => row.weight_kg).map((row: any) => row.weight_kg);
  const weightStart = weights?.length > 0 ? weights[0] : null;
  const weightEnd = weights?.length > 0 ? weights[weights.length - 1] : null;
  
  await supabase.from("weekly_adherence").upsert({
    user_id: userId,
    week_start: weekStart.toISOString().split('T')[0],
    week_end: weekEnd.toISOString().split('T')[0],
    days_logged: daysLogged,
    days_on_target: daysOnTarget,
    avg_calories_consumed: avgCalories,
    target_calories: targetCalories,
    adherence_rate: daysLogged > 0 ? daysOnTarget / 7 : 0,
    weight_start: weightStart,
    weight_end: weightEnd,
    weight_change: weightStart && weightEnd ? weightEnd - weightStart : null
  }, { onConflict: 'user_id,week_start' });
}

function getSundayWeekStart(): string {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() - now.getUTCDay());
  return now.toISOString().split("T")[0];
}

async function persistWeeklyCheckIn(
  supabase: any,
  userId: string,
  checkIn: WeeklyCheckInInput,
  current: ProgressData,
  recommendation: AdjustmentRecommendation,
  adjustmentId: string | null,
  daysLogged: number,
  weightChange: number | null,
) {
  const { data, error } = await supabase
    .from("weekly_ai_check_ins")
    .upsert({
      user_id: userId,
      week_start: getSundayWeekStart(),
      ...checkIn,
      status: "reviewed",
      adjustment_id: adjustmentId,
      current_targets: {
        calories: current.current_calories,
        protein: current.current_protein,
        carbs: current.current_carbs,
        fat: current.current_fat,
      },
      proposed_targets: {
        calories: recommendation.new_calories,
        protein: recommendation.new_protein,
        carbs: recommendation.new_carbs,
        fat: recommendation.new_fat,
      },
      review_summary: recommendation.reason,
      confidence: recommendation.confidence,
      days_logged: daysLogged,
      adherence_rate: current.adherence_rate,
      weight_change_kg: weightChange,
      updated_at: new Date().toISOString(),
      resolved_at: null,
    }, { onConflict: "user_id,week_start" })
    .select("id, status, week_start, adjustment_id, current_targets, proposed_targets, review_summary, confidence, days_logged, adherence_rate, weight_change_kg")
    .single();

  if (error) {
    console.error("Weekly AI check-in persistence failed", { code: error.code });
    throw new HttpError(503, "weekly_check_in_persistence_failed");
  }
  return data;
}

serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    requirePost(req);
    let principal: SecurityPrincipal | null = null;
    let internalRequest = false;
    if (req.headers.has("x-internal-secret")) {
      await requireInternalSecret(req, "ADAPTIVE_GOALS_CRON_SECRET");
      internalRequest = true;
      await enforceRateLimit(
        req,
        "adaptive-goals:internal-ip",
        getClientIp(req) || "unknown",
        1000,
        3600,
      );
    } else {
      principal = await authenticateRequest(req);
      await enforceRateLimit(
        req,
        "adaptive-goals:user",
        principal.user.id,
        12,
        3600,
      );
    }

    const { user_id, dry_run = false } = await readJsonBody<{
      user_id?: string;
      dry_run?: boolean;
    }>(req, 8 * 1024);
    const check_in: unknown = undefined;

    if (!user_id || !UUID_PATTERN.test(user_id)) {
      throw new HttpError(400, "valid_user_id_required");
    }

    if (principal) await assertSelfOrAdmin(req, principal, user_id);

    if (internalRequest) {
      await enforceRateLimit(
        req,
        "adaptive-goals:internal-user",
        user_id,
        4,
        3600,
      );
    }

    const supabase = getServiceClient();
    const weeklyCheckIn = sanitizeWeeklyCheckIn(check_in);

    if (weeklyCheckIn) {
      const { data: resolvedCheckIn } = await supabase
        .from("weekly_ai_check_ins")
        .select("id, status, week_start, adjustment_id, current_targets, proposed_targets, review_summary, confidence, days_logged, adherence_rate, weight_change_kg")
        .eq("user_id", user_id)
        .eq("week_start", getSundayWeekStart())
        .in("status", ["applied", "dismissed"])
        .maybeSingle();
      if (resolvedCheckIn) {
        return jsonResponse(req, {
          message: "This week's check-in has already been resolved.",
          check_in: resolvedCheckIn,
          already_resolved: true,
        });
      }
    }

    // Check if user has adaptive goals enabled
    const { data: settings } = await supabase
      .from("adaptive_goal_settings")
      .select("auto_adjust_enabled, adjustment_frequency")
      .eq("user_id", user_id)
      .maybeSingle();
    
    if (!settings || !settings.auto_adjust_enabled) {
      return jsonResponse(req, {
        message: "Adaptive goals not enabled for this user",
        recommendation: null,
      });
    }

    // Fetch user's profile data
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("current_weight_kg, target_weight_kg, health_goal, daily_calorie_target, protein_target_g, carbs_target_g, fat_target_g, gender, age, height_cm")
      .eq("user_id", user_id)
      .single();

    if (profileError || !profile) {
      throw new HttpError(404, "profile_not_found");
    }

    const { data: activeGoal } = await supabase
      .from("nutrition_goals")
      .select("daily_calorie_target, protein_target_g, carbs_target_g, fat_target_g, goal_type, target_weight_kg")
      .eq("user_id", user_id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentCalories = activeGoal?.daily_calorie_target ?? profile.daily_calorie_target ?? 2000;
    const currentProtein = activeGoal?.protein_target_g ?? profile.protein_target_g ?? 150;
    const currentCarbs = activeGoal?.carbs_target_g ?? profile.carbs_target_g ?? 200;
    const currentFat = activeGoal?.fat_target_g ?? profile.fat_target_g ?? 65;
    const goalType = normalizeGoal(activeGoal?.goal_type ?? profile.health_goal);
    const targetWeight = activeGoal?.target_weight_kg ?? profile.target_weight_kg ?? profile.current_weight_kg ?? 70;

    // Fetch canonical body measurements (last 12 weeks)
    const { data: bodyMeasurements } = await supabase
      .from("body_measurements")
      .select("log_date, weight_kg")
      .eq("user_id", user_id)
      .not("weight_kg", "is", null)
      .gte("log_date", new Date(Date.now() - 12 * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order("log_date", { ascending: true });

    // Fetch calorie logs (last 4 weeks)
    const { data: calorieLogs } = await supabase
      .from("progress_logs")
      .select("log_date, calories_consumed")
      .eq("user_id", user_id)
      .not("calories_consumed", "is", null)
      .gte("log_date", new Date(Date.now() - 4 * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order("log_date", { ascending: true });

    // Store weekly adherence for this week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)
    await storeWeeklyAdherence(supabase, user_id, weekStart);

    // Calculate adherence rate
    const { data: adherenceData } = await supabase
      .from("weekly_adherence")
      .select("adherence_rate, days_logged")
      .eq("user_id", user_id)
      .order("week_start", { ascending: false })
      .limit(4);
    
    const avgAdherence = adherenceData && adherenceData.length > 0
      ? adherenceData.reduce((sum: number, row: any) => sum + (row.adherence_rate || 0), 0) / adherenceData.length
      : 0;
    const currentWeekDaysLogged = Number(adherenceData?.[0]?.days_logged || 0);

    const progressData: ProgressData = {
      body_measurements: bodyMeasurements?.map((w: any) => ({ date: w.log_date, weight: w.weight_kg })) ?? [],
      calorie_logs: calorieLogs?.map((c: any) => ({ date: c.log_date, calories: c.calories_consumed, target: currentCalories })) ?? [],
      adherence_rate: avgAdherence,
      weeks_logged: Math.floor((bodyMeasurements?.length || 0) / 7),
      current_calories: currentCalories,
      current_protein: currentProtein,
      current_carbs: currentCarbs,
      current_fat: currentFat,
      goal: goalType,
      current_weight: profile.current_weight_kg ?? 70,
      target_weight: targetWeight,
    };

    // Generate recommendation
    const recommendation = await analyzeProgress(progressData, weeklyCheckIn);
    
    // Generate predictions
    const predictions = await predictFutureWeight(
      progressData.body_measurements,
      currentCalories,
      recommendation.new_calories,
      goalType,
    );

    if (!dry_run && (
      recommendation.new_calories !== currentCalories ||
      recommendation.new_protein !== currentProtein ||
      recommendation.new_carbs !== currentCarbs ||
      recommendation.new_fat !== currentFat ||
      recommendation.plateau_detected
    )) {
      const adjustmentDate = new Date().toISOString().split("T")[0];
      const weightChange = progressData.body_measurements.length >= 2
        ? progressData.body_measurements[progressData.body_measurements.length - 1].weight -
          progressData.body_measurements[0].weight
        : null;
      const { data: persistence, error: persistenceError } = await supabase.rpc(
        "persist_adaptive_goal_recommendation",
        {
          p_user_id: user_id,
          p_adjustment_date: adjustmentDate,
          p_previous_calories: currentCalories,
          p_new_calories: recommendation.new_calories,
          p_previous_macros: {
            protein: currentProtein,
            carbs: currentCarbs,
            fat: currentFat,
          },
          p_new_macros: {
            protein: recommendation.new_protein,
            carbs: recommendation.new_carbs,
            fat: recommendation.new_fat,
          },
          p_reason: recommendation.reason,
          p_weight_change_kg: weightChange,
          p_adherence_rate: avgAdherence,
          p_plateau_detected: recommendation.plateau_detected,
          p_ai_confidence: recommendation.confidence,
          p_predictions: predictions.map((prediction) => ({
            prediction_date: prediction.date,
            predicted_weight: prediction.predicted_weight,
            confidence_lower: prediction.confidence_lower,
            confidence_upper: prediction.confidence_upper,
          })),
          p_suggested_action: recommendation.suggested_action,
        },
      );
      if (persistenceError) {
        console.error("Adaptive goal persistence failed", {
          code: persistenceError.code,
        });
        throw new HttpError(503, "adaptive_goal_persistence_failed");
      }

      const persistenceResult = persistence && typeof persistence === "object"
        ? persistence as Record<string, unknown>
        : {};
      const duplicate = persistenceResult.duplicate === true;
      const adjustmentId = typeof persistenceResult.adjustment_id === "string"
        ? persistenceResult.adjustment_id
        : null;

      if (duplicate) {
        const savedCheckIn = weeklyCheckIn
          ? await persistWeeklyCheckIn(
            supabase, user_id, weeklyCheckIn, progressData, recommendation,
            adjustmentId, currentWeekDaysLogged, weightChange,
          )
          : null;
        return jsonResponse(req, {
          recommendation,
          predictions: [],
          adjustment_id: adjustmentId,
          check_in: savedCheckIn,
          duplicate: true,
          should_notify: false,
          message: "Recommendation already saved for today.",
        });
      }

      await recordSecurityEvent(req, {
        eventType: "nutrition.adaptive_goal.recommendation_created",
        category: "data_change",
        severity: "medium",
        outcome: "success",
        principal,
        actorType: principal ? undefined : "system",
        action: "create_goal_adjustment",
        resourceType: "auth.user",
        resourceId: user_id,
        metadata: { adjustment_created: true },
      });

      const savedCheckIn = weeklyCheckIn
        ? await persistWeeklyCheckIn(
          supabase, user_id, weeklyCheckIn, progressData, recommendation,
          adjustmentId, currentWeekDaysLogged, weightChange,
        )
        : null;

      return jsonResponse(req, {
        recommendation,
        predictions,
        adjustment_id: adjustmentId,
        check_in: savedCheckIn,
        duplicate: false,
        should_notify: recommendation.plateau_detected || recommendation.confidence > 0.8,
        message: "Analysis complete. Recommendation saved.",
      });
    }

    const noChangeCheckIn = weeklyCheckIn && !dry_run
      ? await persistWeeklyCheckIn(
        supabase, user_id, weeklyCheckIn, progressData, recommendation,
        null, currentWeekDaysLogged,
        progressData.body_measurements.length >= 2
          ? progressData.body_measurements[progressData.body_measurements.length - 1].weight - progressData.body_measurements[0].weight
          : null,
      )
      : null;

    // Dry run or no change needed
    return jsonResponse(req, {
      recommendation,
      predictions,
      check_in: noChangeCheckIn,
      should_notify: false,
      message: dry_run
        ? "Analysis complete (dry run - no changes saved)"
        : "No adjustment needed at this time.",
    });

  } catch (error) {
    console.error("Adaptive goals request failed", {
      code: error instanceof HttpError ? error.code : "internal_error",
    });
    return errorResponse(req, error);
  }
});
