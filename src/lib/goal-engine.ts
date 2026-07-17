export type NutritionGoalType = "weight_loss" | "muscle_gain" | "maintenance" | "general_health";
export type GoalActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type GoalGender = "male" | "female" | "prefer_not_to_say" | null | undefined;

export interface GoalProfileInput {
  gender?: GoalGender;
  age?: number | null;
  currentWeightKg?: number | null;
  heightCm?: number | null;
  activityLevel?: GoalActivityLevel | null;
}

export interface MedicalNutritionContext {
  hasRecentBloodWork?: boolean;
  abnormalMarkerCount?: number;
  flaggedCategories?: string[];
  flaggedMarkers?: string[];
}

export interface GoalPlanInput extends GoalProfileInput {
  goalType: NutritionGoalType;
  targetWeightKg?: number | null;
  targetDate?: string | null;
  medicalContext?: MedicalNutritionContext | null;
}

export interface GoalPlan {
  goalType: NutritionGoalType;
  bmr: number;
  tdee: number;
  dailyCalorieTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
  fiberTargetG: number;
  weeklyPaceKg: number;
  targetDate: string | null;
  safetyNote: string | null;
  summary: string;
  medicalContextApplied: boolean;
  medicalContextSummary: string | null;
}

const ACTIVITY_MULTIPLIERS: Record<GoalActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const roundTo = (value: number, step: number) => Math.round(value / step) * step;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const normalizeGoalType = (goalType: string | null | undefined): NutritionGoalType => {
  if (goalType === "muscle_gain" || goalType === "maintenance" || goalType === "general_health") return goalType;
  return "weight_loss";
};

export function calculateGoalPlan(input: GoalPlanInput): GoalPlan {
  const goalType = normalizeGoalType(input.goalType);
  const weight = input.currentWeightKg && input.currentWeightKg > 0 ? input.currentWeightKg : 75;
  const height = input.heightCm && input.heightCm > 0 ? input.heightCm : 170;
  const age = input.age && input.age > 0 ? input.age : 30;
  const activityLevel = input.activityLevel || "moderate";
  const gender = input.gender === "female" ? "female" : "male";
  const medicalContext = input.medicalContext;
  const flaggedCategories = new Set(
    (medicalContext?.flaggedCategories || []).map((category) => category.toLowerCase()),
  );
  const hasMedicalFlags = Boolean(
    medicalContext?.hasRecentBloodWork &&
      (medicalContext.abnormalMarkerCount || flaggedCategories.size),
  );

  const bmr = gender === "female"
    ? 10 * weight + 6.25 * height - 5 * age - 161
    : 10 * weight + 6.25 * height - 5 * age + 5;
  const tdee = bmr * ACTIVITY_MULTIPLIERS[activityLevel];

  let calorieDelta = goalType === "weight_loss"
    ? -450
    : goalType === "muscle_gain"
      ? 250
      : goalType === "maintenance"
        ? 0
        : -100;
  const safetyNotes: string[] = [];

  if (hasMedicalFlags && goalType === "weight_loss" && calorieDelta < -350) {
    calorieDelta = -350;
    safetyNotes.push("Calorie deficit was moderated because a recent health report has flagged markers.");
  }

  if (
    hasMedicalFlags &&
    goalType === "muscle_gain" &&
    (flaggedCategories.has("kidney") || flaggedCategories.has("liver") || flaggedCategories.has("metabolic"))
  ) {
    calorieDelta = Math.min(calorieDelta, 150);
    safetyNotes.push("Calorie surplus was kept conservative because of recent health-report context.");
  }

  const minCalories = gender === "female" ? 1200 : 1500;
  const maxCalories = 4200;
  const dailyCalorieTarget = roundTo(clamp(tdee + calorieDelta, minCalories, maxCalories), 50);

  let proteinMultiplier = goalType === "muscle_gain" ? 2.0 : goalType === "weight_loss" ? 1.8 : 1.5;
  if (hasMedicalFlags && flaggedCategories.has("kidney")) {
    proteinMultiplier = Math.min(proteinMultiplier, 1.5);
    safetyNotes.push("Protein target was capped conservatively due to kidney-related markers.");
  }
  const proteinTargetG = roundTo(clamp(weight * proteinMultiplier, 70, 240), 5);
  const fatTargetG = roundTo(clamp((dailyCalorieTarget * (goalType === "muscle_gain" ? 0.25 : 0.28)) / 9, 35, 120), 5);
  const caloriesAfterProteinFat = Math.max(0, dailyCalorieTarget - proteinTargetG * 4 - fatTargetG * 9);
  const carbsTargetG = roundTo(clamp(caloriesAfterProteinFat / 4, 80, 450), 5);
  let fiberTargetG = goalType === "weight_loss" ? 35 : 30;
  if (
    hasMedicalFlags &&
    (flaggedCategories.has("lipid") || flaggedCategories.has("metabolic") || flaggedCategories.has("inflammation"))
  ) {
    fiberTargetG = Math.max(fiberTargetG, 38);
  }

  const targetWeight = input.targetWeightKg ?? null;
  const currentWeight = input.currentWeightKg ?? null;
  const remainingKg = targetWeight && currentWeight ? Math.abs(currentWeight - targetWeight) : 0;
  const weeklyPaceKg = goalType === "weight_loss" ? 0.45 : goalType === "muscle_gain" ? 0.25 : 0;
  const estimatedWeeks = weeklyPaceKg > 0 && remainingKg > 0 ? Math.ceil(remainingKg / weeklyPaceKg) : 0;
  const estimatedTargetDate = estimatedWeeks > 0
    ? new Date(Date.now() + estimatedWeeks * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : null;

  if (tdee + calorieDelta < minCalories) {
    safetyNotes.unshift("Calories were raised to the safe minimum for this profile.");
  }

  const baseSummary = goalType === "weight_loss"
    ? "Designed for steady fat loss while protecting protein intake."
    : goalType === "muscle_gain"
      ? "Designed for a controlled calorie surplus and higher protein."
      : goalType === "maintenance"
        ? "Designed to keep weight stable while improving consistency."
        : "Designed for balanced nutrition and habit quality.";
  const medicalContextSummary = hasMedicalFlags
    ? `Adjusted with ${medicalContext?.abnormalMarkerCount || flaggedCategories.size} flagged marker${(medicalContext?.abnormalMarkerCount || flaggedCategories.size) === 1 ? "" : "s"} from the latest health report.`
    : medicalContext?.hasRecentBloodWork
      ? "Latest health report available; no abnormal markers were used to modify targets."
      : null;
  const summary = medicalContextSummary
    ? `${baseSummary} ${medicalContextSummary}`
    : baseSummary;

  return {
    goalType,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    dailyCalorieTarget,
    proteinTargetG,
    carbsTargetG,
    fatTargetG,
    fiberTargetG,
    weeklyPaceKg,
    targetDate: input.targetDate || estimatedTargetDate,
    safetyNote: safetyNotes.length ? safetyNotes.join(" ") : null,
    summary,
    medicalContextApplied: hasMedicalFlags,
    medicalContextSummary,
  };
}

export function getGoalAlignmentLabel(score: number) {
  if (score >= 85) return "Strong fit";
  if (score >= 65) return "On track";
  if (score >= 40) return "Needs tuning";
  return "Needs setup";
}

export function getGoalAlignmentLabelKey(score: number) {
  if (score >= 85) return "goal_alignment_strong";
  if (score >= 65) return "goal_alignment_on_track";
  if (score >= 40) return "goal_alignment_needs_tuning";
  return "goal_alignment_needs_setup";
}

export function calculateGoalAlignmentScore(params: {
  caloriePct?: number;
  proteinPct?: number;
  consistencyPct?: number;
}) {
  const caloriePct = params.caloriePct ?? 0;
  const proteinPct = params.proteinPct ?? 0;
  const consistencyPct = params.consistencyPct ?? 0;
  const calorieScore = Math.max(0, 100 - Math.abs(100 - caloriePct));
  return Math.round(calorieScore * 0.42 + Math.min(100, proteinPct) * 0.38 + Math.min(100, consistencyPct) * 0.2);
}

export function reviewGoalProgress(params: {
  goalType?: string | null;
  caloriePct?: number;
  proteinPct?: number;
  consistencyPct?: number;
  daysLogged?: number;
}) {
  const goalType = normalizeGoalType(params.goalType);
  const caloriePct = params.caloriePct ?? 0;
  const proteinPct = params.proteinPct ?? 0;
  const consistencyPct = params.consistencyPct ?? 0;
  const daysLogged = params.daysLogged ?? 0;

  if (daysLogged < 3) {
    return {
      status: "needs_data" as const,
      titleKey: "goal_review_need_data",
      detailKey: "goal_review_need_data_desc",
      actionKey: "goal_review_action_log",
    };
  }

  if (goalType === "weight_loss" && caloriePct > 112) {
    return {
      status: "adjust" as const,
      titleKey: "goal_review_reduce_calories",
      detailKey: "goal_review_reduce_calories_desc",
      actionKey: "goal_review_action_adjust",
    };
  }

  if (goalType === "muscle_gain" && caloriePct < 90) {
    return {
      status: "adjust" as const,
      titleKey: "goal_review_raise_calories",
      detailKey: "goal_review_raise_calories_desc",
      actionKey: "goal_review_action_adjust",
    };
  }

  if (proteinPct < 75) {
    return {
      status: "protein" as const,
      titleKey: "goal_review_raise_protein",
      detailKey: "goal_review_raise_protein_desc",
      actionKey: "goal_review_action_protein",
    };
  }

  if (consistencyPct >= 80 && caloriePct >= 85 && caloriePct <= 110 && proteinPct >= 85) {
    return {
      status: "strong" as const,
      titleKey: "goal_review_keep_plan",
      detailKey: "goal_review_keep_plan_desc",
      actionKey: "goal_review_action_keep",
    };
  }

  return {
    status: "watch" as const,
    titleKey: "goal_review_watch_week",
    detailKey: "goal_review_watch_week_desc",
    actionKey: "goal_review_action_review",
  };
}

export function scoreMealForGoal(params: {
  goalType?: string | null;
  mealCalories?: number | null;
  mealProteinG?: number | null;
  dailyCalories?: number | null;
  dailyProteinG?: number | null;
}) {
  const goalType = normalizeGoalType(params.goalType);
  const mealCalories = params.mealCalories ?? 0;
  const mealProtein = params.mealProteinG ?? 0;
  const dailyCalories = params.dailyCalories || 2000;
  const dailyProtein = params.dailyProteinG || 120;
  const calorieShare = mealCalories / Math.max(dailyCalories, 1);
  const proteinShare = mealProtein / Math.max(dailyProtein, 1);
  const proteinDensity = mealCalories > 0 ? (mealProtein * 4) / mealCalories : 0;

  let score = 55;
  if (calorieShare >= 0.18 && calorieShare <= 0.35) score += 18;
  if (proteinShare >= 0.22) score += 18;
  if (proteinDensity >= 0.25) score += 10;
  if (goalType === "weight_loss" && calorieShare > 0.38) score -= 18;
  if (goalType === "muscle_gain" && proteinShare >= 0.28) score += 10;
  if (goalType === "maintenance" && calorieShare >= 0.2 && calorieShare <= 0.33) score += 8;
  score = clamp(Math.round(score), 0, 100);

  return {
    score,
    calorieShare,
    proteinShare,
    labelKey: score >= 80 ? "goal_fits_you" : proteinShare >= 0.25 ? "goal_high_protein_pick" : calorieShare <= 0.2 ? "goal_light_pick" : "goal_review_watch_week",
  };
}
