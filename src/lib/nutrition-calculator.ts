export type Goal = "lose" | "gain" | "maintain";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Gender = "male" | "female";

// Calculate BMR using Mifflin-St Jeor equation
export const calculateBMR = (gender: Gender, weight: number, height: number, age: number): number => {
  if (gender === "male") {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    return 10 * weight + 6.25 * height - 5 * age - 161;
  }
};

// Calculate TDEE based on activity level
export const calculateTDEE = (bmr: number, activityLevel: ActivityLevel): number => {
  const multipliers: Record<ActivityLevel, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  return Math.round(bmr * multipliers[activityLevel]);
};

// Adjust calories based on goal
export const calculateTargetCalories = (tdee: number, goal: Goal): number => {
  switch (goal) {
    case "lose":
      return Math.round(tdee * 0.8); // 20% deficit
    case "gain":
      return Math.round(tdee * 1.15); // 15% surplus
    case "maintain":
    default:
      return tdee;
  }
};

// Calculate macro targets
export const calculateMacros = (calories: number, goal: Goal) => {
  let proteinRatio: number, carbsRatio: number, fatRatio: number;
  
  switch (goal) {
    case "lose":
      proteinRatio = 0.35;
      carbsRatio = 0.35;
      fatRatio = 0.30;
      break;
    case "gain":
      proteinRatio = 0.30;
      carbsRatio = 0.45;
      fatRatio = 0.25;
      break;
    case "maintain":
    default:
      proteinRatio = 0.30;
      carbsRatio = 0.40;
      fatRatio = 0.30;
  }

  return {
    protein: Math.round((calories * proteinRatio) / 4), // 4 cal per gram
    carbs: Math.round((calories * carbsRatio) / 4), // 4 cal per gram
    fat: Math.round((calories * fatRatio) / 9), // 9 cal per gram
  };
};

// Calculate all nutrition targets at once
export const calculateNutritionTargets = (
  gender: Gender,
  weight: number,
  height: number,
  age: number,
  activityLevel: ActivityLevel,
  goal: Goal
) => {
  const bmr = calculateBMR(gender, weight, height, age);
  const tdee = calculateTDEE(bmr, activityLevel);
  const dailyCalories = calculateTargetCalories(tdee, goal);
  const macros = calculateMacros(dailyCalories, goal);

  return {
    bmr,
    tdee,
    dailyCalories,
    ...macros,
  };
};

export const activityLevelLabels: Record<ActivityLevel, { title: string; description: string }> = {
  sedentary: { title: "Sedentary", description: "Little or no exercise" },
  light: { title: "Lightly Active", description: "Light exercise 1-3 days/week" },
  moderate: { title: "Moderately Active", description: "Moderate exercise 3-5 days/week" },
  active: { title: "Very Active", description: "Hard exercise 6-7 days/week" },
  very_active: { title: "Extra Active", description: "Very hard exercise & physical job" },
};

export const goalLabels: Record<Goal, { title: string; description: string }> = {
  lose: { title: "Lose Weight", description: "Reduce body fat while maintaining muscle" },
  gain: { title: "Build Muscle", description: "Gain lean muscle mass with proper nutrition" },
  maintain: { title: "Maintain", description: "Keep your current weight and improve health" },
};
