export interface CoachComplianceLog {
  log_date: string;
  calories_consumed: number | null;
  protein_consumed_g: number | null;
}

export interface CoachWaterLog {
  log_date: string;
  glasses: number | null;
}

export interface CoachGoalTargets {
  daily_calorie_target: number | null;
  protein_target_g: number | null;
}

export interface CoachComplianceBreakdown {
  loggedDays: number;
  calorieHitDays: number;
  proteinHitDays: number;
  hydrationHitDays: number;
  macroHitRate: number;
  coachSummary: string;
}

const uniqueDates = <T extends { log_date: string }>(items: T[]) => new Set(items.map((item) => item.log_date));

export function calculateCoachComplianceBreakdown(
  logs: CoachComplianceLog[],
  waterLogs: CoachWaterLog[],
  targets: CoachGoalTargets,
): CoachComplianceBreakdown {
  const calorieTarget = targets.daily_calorie_target || 2000;
  const proteinTarget = targets.protein_target_g || 120;
  const loggedDays = uniqueDates(logs).size;

  const calorieHitDays = logs.filter((log) => {
    const calories = log.calories_consumed || 0;
    return calories >= calorieTarget * 0.85 && calories <= calorieTarget * 1.1;
  }).length;

  const proteinHitDays = logs.filter((log) => (log.protein_consumed_g || 0) >= proteinTarget * 0.85).length;
  const hydrationHitDays = waterLogs.filter((log) => (log.glasses || 0) >= 8).length;
  const denominator = Math.max(loggedDays, 1);
  const macroHitRate = Math.round(((calorieHitDays * 0.45) + (proteinHitDays * 0.4) + (hydrationHitDays * 0.15)) / denominator * 100);

  const coachSummary = proteinHitDays < Math.max(2, loggedDays * 0.5)
    ? "Protein needs attention"
    : hydrationHitDays < Math.max(2, loggedDays * 0.5)
      ? "Hydration is the weak spot"
      : calorieHitDays < Math.max(2, loggedDays * 0.5)
        ? "Calories need tighter control"
        : "Good weekly control";

  return {
    loggedDays,
    calorieHitDays,
    proteinHitDays,
    hydrationHitDays,
    macroHitRate: Math.min(100, Math.max(0, macroHitRate)),
    coachSummary,
  };
}
