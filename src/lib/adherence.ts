export type AdherenceMetric = "meal_logging" | "activity" | "water";

export interface AdherenceGoalSummary {
  id: string;
  metric: AdherenceMetric;
  frequency_per_week: number;
  target_value: number;
  completed_days: number;
  remaining_days: number;
  strength: number;
  reason_code: "on_track" | "strong_history" | "building" | "getting_started";
}

export interface AdherenceSummary {
  week_start: string;
  today: string;
  goals: AdherenceGoalSummary[];
}

export function clampStrength(value: number) {
  return Math.min(100, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));
}

export function adherenceProgressPercent(goal: AdherenceGoalSummary) {
  if (goal.frequency_per_week <= 0) return 0;
  return Math.min(100, Math.round((goal.completed_days / goal.frequency_per_week) * 100));
}

export function challengeProgressReason(
  challengeType: string,
  progress: number,
  target: number,
  isRTL: boolean,
) {
  const completed = Math.max(0, Math.min(progress, target));
  const remaining = Math.max(0, target - completed);
  const type = challengeType.toLowerCase();

  if (type === "meals" || type === "meal_logging") {
    return isRTL
      ? `احتُسب ${completed} من سجلات الوجبات الموثقة، والمتبقي ${remaining}.`
      : `${completed} verified meal logs counted; ${remaining} remaining.`;
  }
  if (type === "activity" || type === "workout") {
    return isRTL
      ? `احتُسب ${completed} من أيام النشاط الموثقة، والمتبقي ${remaining}.`
      : `${completed} verified activity days counted; ${remaining} remaining.`;
  }
  if (type === "water" || type === "hydration") {
    return isRTL
      ? `احتُسب ${completed} من أيام الترطيب المؤهلة، والمتبقي ${remaining}.`
      : `${completed} qualified hydration days counted; ${remaining} remaining.`;
  }
  return isRTL
    ? `التقدم مبني على أحداث موثقة داخل Nutrio: ${completed}/${target}.`
    : `Progress is based on verified Nutrio events: ${completed}/${target}.`;
}

