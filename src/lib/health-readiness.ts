export interface HealthDailyMetrics {
  id?: string;
  user_id?: string;
  metric_date: string;
  steps: number;
  workouts_count: number;
  active_calories: number;
  resting_heart_rate: number | null;
  average_heart_rate: number | null;
  hrv: number | null;
  sleep_minutes: number | null;
  deep_sleep_minutes: number | null;
  rem_sleep_minutes: number | null;
  respiratory_rate: number | null;
  spo2: number | null;
  skin_temperature: number | null;
  source: string;
  synced_at: string;
}

export interface RecoveryReadiness {
  score: number | null;
  labelKey: string;
  detailKey: string;
  enoughData: boolean;
  signals: {
    movement: number;
    cardio: number | null;
    sleep: number | null;
  };
}

export interface BodyLoadResult {
  score: number;
  labelKey: string;
  detailKey: string;
}

export interface HealthBaseline {
  avgReadiness: number | null;
  avgBodyLoad: number;
  avgSleepMinutes: number | null;
  avgRestingHeartRate: number | null;
  avgHrv: number | null;
  highLoadDays: number;
  lowReadinessDays: number;
  recoveryDebt: number;
}

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function calculateBodyLoad(metrics: HealthDailyMetrics | null | undefined): BodyLoadResult {
  if (!metrics) {
    return {
      score: 0,
      labelKey: "body_load_low",
      detailKey: "body_load_need_sync",
    };
  }

  const stepLoad = clamp((metrics.steps / 10000) * 9, 0, 9);
  const workoutLoad = clamp(metrics.workouts_count * 4, 0, 8);
  const calorieLoad = clamp((metrics.active_calories / 600) * 4, 0, 4);
  const score = Math.round(stepLoad + workoutLoad + calorieLoad);

  if (score >= 15) {
    return { score, labelKey: "body_load_high", detailKey: "body_load_high_desc" };
  }
  if (score >= 8) {
    return { score, labelKey: "body_load_balanced", detailKey: "body_load_balanced_desc" };
  }
  return { score, labelKey: "body_load_low", detailKey: "body_load_low_desc" };
}

export function calculateRecoveryReadiness(metrics: HealthDailyMetrics | null | undefined): RecoveryReadiness {
  if (!metrics) {
    return {
      score: null,
      labelKey: "need_health_data",
      detailKey: "sync_health_to_unlock",
      enoughData: false,
      signals: { movement: 0, cardio: null, sleep: null },
    };
  }

  const hasHeartSignal = Boolean(metrics.average_heart_rate || metrics.resting_heart_rate || metrics.hrv);
  const hasSleepSignal = Boolean(metrics.sleep_minutes);
  const hasMovementSignal = metrics.steps > 0 || metrics.workouts_count > 0 || metrics.active_calories > 0;

  const movementPenalty = clamp((metrics.steps / 12000) * 18 + metrics.workouts_count * 7, 0, 28);
  const movementScore = Math.round(clamp(88 - movementPenalty, 52, 94));

  const heartRate = metrics.resting_heart_rate ?? metrics.average_heart_rate;
  const cardioScore = heartRate
    ? Math.round(clamp(102 - ((heartRate - 58) * 1.2), 45, 96))
    : null;

  const sleepScore = metrics.sleep_minutes
    ? Math.round(clamp((metrics.sleep_minutes / 480) * 100, 45, 100))
    : null;

  const weightedSignals = [
    { value: movementScore, weight: hasMovementSignal ? 0.35 : 0.18 },
    { value: cardioScore, weight: cardioScore === null ? 0 : 0.35 },
    { value: sleepScore, weight: sleepScore === null ? 0 : 0.3 },
  ];
  const totalWeight = weightedSignals.reduce((sum, signal) => sum + signal.weight, 0);
  const score = totalWeight > 0
    ? Math.round(weightedSignals.reduce((sum, signal) => sum + ((signal.value ?? 0) * signal.weight), 0) / totalWeight)
    : null;

  const enoughData = hasHeartSignal || hasSleepSignal || hasMovementSignal;
  if (!enoughData || score === null) {
    return {
      score: null,
      labelKey: "need_health_data",
      detailKey: "sync_health_to_unlock",
      enoughData: false,
      signals: { movement: movementScore, cardio: cardioScore, sleep: sleepScore },
    };
  }

  if (score >= 80) {
    return {
      score,
      labelKey: "readiness_ready",
      detailKey: "readiness_ready_desc",
      enoughData,
      signals: { movement: movementScore, cardio: cardioScore, sleep: sleepScore },
    };
  }
  if (score >= 60) {
    return {
      score,
      labelKey: "readiness_balanced",
      detailKey: "readiness_balanced_desc",
      enoughData,
      signals: { movement: movementScore, cardio: cardioScore, sleep: sleepScore },
    };
  }
  return {
    score,
    labelKey: "readiness_recover",
    detailKey: "readiness_recover_desc",
    enoughData,
    signals: { movement: movementScore, cardio: cardioScore, sleep: sleepScore },
  };
}

export function buildReadinessFoodTip(readiness: RecoveryReadiness, bodyLoad: BodyLoadResult): string {
  if (!readiness.enoughData) return "readiness_tip_sync";
  if ((readiness.score ?? 0) < 60 || bodyLoad.score >= 15) return "readiness_tip_recovery_meal";
  if ((readiness.score ?? 0) >= 80 && bodyLoad.score <= 8) return "readiness_tip_high_protein";
  return "readiness_tip_balanced";
}

function average(values: Array<number | null | undefined>): number | null {
  const clean = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  if (!clean.length) return null;
  return Math.round(clean.reduce((sum, value) => sum + value, 0) / clean.length);
}

export function calculateHealthBaseline(metrics: HealthDailyMetrics[]): HealthBaseline {
  const readinessScores = metrics
    .map((item) => calculateRecoveryReadiness(item).score)
    .filter((score): score is number => typeof score === "number");
  const bodyLoads = metrics.map((item) => calculateBodyLoad(item).score);
  const avgReadiness = average(readinessScores);
  const avgBodyLoad = average(bodyLoads) ?? 0;
  const lowReadinessDays = readinessScores.filter((score) => score < 60).length;
  const highLoadDays = bodyLoads.filter((score) => score >= 15).length;
  const avgSleepMinutes = average(metrics.map((item) => item.sleep_minutes));
  const sleepDebt = avgSleepMinutes ? Math.max(0, 480 - avgSleepMinutes) : 0;

  return {
    avgReadiness,
    avgBodyLoad,
    avgSleepMinutes,
    avgRestingHeartRate: average(metrics.map((item) => item.resting_heart_rate)),
    avgHrv: average(metrics.map((item) => item.hrv)),
    highLoadDays,
    lowReadinessDays,
    recoveryDebt: Math.round(sleepDebt + (highLoadDays * 18) + (lowReadinessDays * 12)),
  };
}

export function getRecoveryPlanKey(baseline: HealthBaseline, today: RecoveryReadiness, load: BodyLoadResult) {
  if (!today.enoughData) return "recovery_plan_sync";
  if (baseline.recoveryDebt >= 90 || (today.score ?? 100) < 55) return "recovery_plan_restore";
  if (load.score >= 15) return "recovery_plan_refuel";
  if ((today.score ?? 0) >= 80 && baseline.avgBodyLoad < 10) return "recovery_plan_build";
  return "recovery_plan_maintain";
}
