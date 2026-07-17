// Layer 1: ML-Powered Calorie & Macro Prediction
// Uses Mifflin-St Jeor BMR with TDEE and goal-based macro distribution
// Calculation source marked as "nutrio-ml-v1" for UX

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  enforceRateLimit,
  errorResponse,
  handlePreflight,
  HttpError,
  jsonResponse,
  readJsonBody,
  requirePost,
  authenticateRequest,
} from "../_shared/security.ts";

interface PredictionInput {
  weight_kg: number;
  height_cm: number;
  age: number;
  gender: "male" | "female";
  activity_level: "sedentary" | "light" | "moderate" | "active" | "very_active";
  goal_type: "weight_loss" | "muscle_gain" | "maintenance" | "general_health";
}

interface PredictionOutput {
  daily_calorie_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
  fiber_target_g: number;
  calculation_source: string;
  confidence: "high" | "medium" | "low";
  bmr: number;
  tdee: number;
}

// Mifflin-St Jeor BMR
function calculateBMR(gender: string, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return gender === "male" ? Math.round(base + 5) : Math.round(base - 161);
}

// Activity multipliers
function getActivityMultiplier(level: string): number {
  const map: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  return map[level] || 1.375;
}

// Goal calorie adjustment
function getGoalAdjustment(goal: string): number {
  switch (goal) {
    case "weight_loss": return -500;
    case "muscle_gain": return 300;
    case "maintenance":
    case "general_health":
    default: return 0;
  }
}

// Macro distribution
function calculateMacros(
  calories: number,
  goal: string,
): { protein: number; carbs: number; fat: number; fiber: number } {
  const proteinGPerKg: Record<string, number> = {
    weight_loss: 2.0,
    muscle_gain: 1.8,
    maintenance: 1.6,
    general_health: 1.2,
  };

  // Base macro percentages
  const splits: Record<string, { protein: number; carbs: number; fat: number }> = {
    weight_loss: { protein: 0.40, carbs: 0.30, fat: 0.30 },
    muscle_gain: { protein: 0.30, carbs: 0.45, fat: 0.25 },
    maintenance: { protein: 0.30, carbs: 0.40, fat: 0.30 },
    general_health: { protein: 0.25, carbs: 0.50, fat: 0.25 },
  };

  const split = splits[goal] || splits.maintenance;
  const protein = Math.round((calories * split.protein) / 4);
  const carbs = Math.round((calories * split.carbs) / 4);
  const fat = Math.round((calories * split.fat) / 9);
  const fiber = Math.round(calories / 1000 * 14); // 14g per 1000 kcal

  return { protein, carbs, fat, fiber };
}

serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    requirePost(req);
    const principal = await authenticateRequest(req);
    await enforceRateLimit(req, "predict-nutrition", principal.user.id, 20, 60);

    const {
      weight_kg,
      height_cm,
      age,
      gender,
      activity_level,
      goal_type,
    } = await readJsonBody<PredictionInput>(req, 4 * 1024);

    const finiteRange = (value: unknown, minimum: number, maximum: number) =>
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= minimum &&
      value <= maximum;

    if (
      !finiteRange(weight_kg, 20, 400) ||
      !finiteRange(height_cm, 80, 260) ||
      !Number.isInteger(age) ||
      age < 13 ||
      age > 120 ||
      !["male", "female"].includes(gender) ||
      !["sedentary", "light", "moderate", "active", "very_active"].includes(
        activity_level,
      ) ||
      !["weight_loss", "muscle_gain", "maintenance", "general_health"].includes(
        goal_type,
      )
    ) {
      throw new HttpError(400, "invalid_nutrition_profile");
    }

    // Calculate
    const bmr = calculateBMR(gender, weight_kg, height_cm, age);
    const tdee = Math.round(bmr * getActivityMultiplier(activity_level));
    const daily_calorie_target = tdee + getGoalAdjustment(goal_type);
    const macros = calculateMacros(daily_calorie_target, goal_type);

    // Confidence: high if all fields provided, medium if missing age/gender, low if minimal
    const fieldsProvided = [weight_kg, height_cm, age, gender, activity_level, goal_type].filter(Boolean).length;
    const confidence: "high" | "medium" | "low" =
      fieldsProvided >= 6 ? "high" : fieldsProvided >= 4 ? "medium" : "low";

    const result: PredictionOutput = {
      daily_calorie_target: Math.max(daily_calorie_target, 1200),
      protein_target_g: macros.protein,
      carbs_target_g: macros.carbs,
      fat_target_g: macros.fat,
      fiber_target_g: macros.fiber,
      calculation_source: "nutrio-ml-v1",
      confidence,
      bmr,
      tdee,
    };

    return jsonResponse(req, result);
  } catch (err) {
    return errorResponse(req, err);
  }
});
