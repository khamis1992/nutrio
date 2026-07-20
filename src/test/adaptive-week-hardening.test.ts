import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = source("supabase/migrations/20260720230000_harden_adaptive_week.sql");
const legacyHook = source("src/hooks/useAdaptiveGoals.ts");

describe("adaptive week safety contract", () => {
  it("uses robust trend windows and a minimum data-quality gate", () => {
    expect(migration).toContain("percentile_cont(0.5)");
    expect(migration).toContain("two_window_median");
    expect(migration).toContain("v_prior_weight_count >= 2");
    expect(migration).toContain("v_recent_weight_count >= 2");
    expect(migration).toContain("v_weight_span_days >= 14");
    expect(migration).toContain("v_days_logged >= 4");
    expect(migration).toContain("outliers_removed");
  });

  it("holds changes for recent health context and active health protocols", () => {
    expect(migration).toContain("public.health_context_preferences");
    expect(migration).toContain("preferences.recommendation_context_enabled");
    expect(migration).toContain("public.health_program_enrollments");
    expect(migration).toContain("public.health_program_safety_events");
    expect(migration).toContain("program.active_health_protocol");
    expect(migration).toContain("WEEKLY_CHECK_IN_SAFETY_CONTEXT_CHANGED");
  });

  it("binds a proposal to an expiring goal snapshot and rechecks it under lock", () => {
    expect(migration).toContain("goal_id_snapshot");
    expect(migration).toContain("goal_version_snapshot");
    expect(migration).toContain("proposal_fingerprint");
    expect(migration).toContain("expires_at");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("WEEKLY_CHECK_IN_STALE_REFRESH_REQUIRED");
    expect(migration).toContain("WEEKLY_CHECK_IN_EXPIRED");
  });

  it("caps calorie changes and protects protein", () => {
    expect(migration).toContain("abs(v_calories - v_current_calories)::NUMERIC / greatest(v_current_calories, 1) > 0.05");
    expect(migration).toContain("v_current_calories - v_calories > 100");
    expect(migration).toContain("abs(v_calories - v_current_calories) > 150");
    expect(migration).toContain("v_protein < v_current_protein");
    expect(migration).toContain("protein stays unchanged");
  });

  it("removes the legacy browser-side target mutation path", () => {
    expect(legacyHook).not.toContain("daily_calorie_target: recommendation.new_calories");
    expect(legacyHook).not.toContain("protein_target_g: recommendation.new_protein");
    expect(legacyHook).toContain("resolve_weekly_ai_check_in");
  });
});
