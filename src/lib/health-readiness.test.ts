import { describe, expect, it } from "vitest";
import {
  calculateBodyLoad,
  calculateHealthBaseline,
  calculateRecoveryReadiness,
  getRecoveryPlanKey,
  type HealthDailyMetrics,
} from "./health-readiness";

const metric = (overrides: Partial<HealthDailyMetrics> = {}): HealthDailyMetrics => ({
  metric_date: "2026-06-23",
  steps: 6500,
  workouts_count: 1,
  active_calories: 320,
  resting_heart_rate: 58,
  average_heart_rate: 72,
  hrv: 55,
  sleep_minutes: 470,
  deep_sleep_minutes: 80,
  rem_sleep_minutes: 95,
  respiratory_rate: null,
  spo2: null,
  skin_temperature: null,
  source: "apple_health",
  synced_at: "2026-06-23T06:00:00.000Z",
  ...overrides,
});

describe("health readiness", () => {
  it("returns no-score state when health data is missing", () => {
    const readiness = calculateRecoveryReadiness(null);
    const load = calculateBodyLoad(null);

    expect(readiness.score).toBeNull();
    expect(readiness.enoughData).toBe(false);
    expect(load.score).toBe(0);
  });

  it("detects high body load from steps, workouts, and calories", () => {
    const load = calculateBodyLoad(metric({
      steps: 15000,
      workouts_count: 2,
      active_calories: 900,
    }));

    expect(load.score).toBeGreaterThanOrEqual(15);
    expect(load.labelKey).toBe("body_load_high");
  });

  it("builds a recovery baseline and recommends restore when debt is high", () => {
    const week = [
      metric({ metric_date: "2026-06-17", steps: 16000, workouts_count: 2, active_calories: 850, sleep_minutes: 330, resting_heart_rate: 82 }),
      metric({ metric_date: "2026-06-18", steps: 14000, workouts_count: 2, active_calories: 780, sleep_minutes: 340, resting_heart_rate: 80 }),
      metric({ metric_date: "2026-06-19", steps: 12000, workouts_count: 1, active_calories: 620, sleep_minutes: 360, resting_heart_rate: 78 }),
      metric({ metric_date: "2026-06-20", steps: 8000, workouts_count: 1, active_calories: 420, sleep_minutes: 370, resting_heart_rate: 76 }),
    ];
    const baseline = calculateHealthBaseline(week);
    const today = calculateRecoveryReadiness(week[0]);
    const load = calculateBodyLoad(week[0]);

    expect(baseline.recoveryDebt).toBeGreaterThanOrEqual(90);
    expect(getRecoveryPlanKey(baseline, today, load)).toBe("recovery_plan_restore");
  });
});
