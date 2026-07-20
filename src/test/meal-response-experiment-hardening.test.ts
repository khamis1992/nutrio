import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const hardening = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260720204000_meal_response_experiment_hardening.sql"),
  "utf8",
);
const autoLink = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260720204500_auto_link_meal_response_experiments.sql"),
  "utf8",
);
const singleOpen = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260720205500_single_open_meal_response_experiment.sql"),
  "utf8",
);

describe("meal response experiment hardening", () => {
  it("requires four repeats and two real distinct catalog meals", () => {
    expect(hardening).toContain("minimum_repeats_per_arm BETWEEN 4 AND 20");
    expect(hardening).toContain("EXPERIMENT_MEALS_MUST_BE_UNIQUE");
    expect(hardening).toContain("meals.approval_status = 'approved'");
    expect(hardening).toContain("EXPERIMENT_MEAL_CALORIES_MISMATCH");
  });

  it("rejects comparisons with a calorie difference above twenty percent", () => {
    expect(hardening).toContain("/ greatest(v_calories[1], v_calories[2])::NUMERIC > 0.20");
    expect(hardening).toContain("EXPERIMENT_MEALS_MUST_BE_CALORIE_COMPARABLE");
  });

  it("only links a canonical consumption for the assigned meal and never reuses it", () => {
    expect(hardening).toContain("ASSIGNMENT_REQUIRES_EXPECTED_MEAL");
    expect(hardening).toContain("COALESCE(consumptions.substitute_meal_id, consumptions.source_meal_id)");
    expect(hardening).toContain("idx_meal_response_assignment_consumption_unique");
  });

  it("automatically advances the next matching assignment", () => {
    expect(autoLink).toContain("experiments.status = 'active'");
    expect(autoLink).toContain("ORDER BY experiments.started_at, assignments.sequence_number");
    expect(autoLink).toContain("consumed_consumption_id = NEW.id");
    expect(autoLink).toContain("SET status = 'completed'");
  });

  it("allows only one open comparison per user", () => {
    expect(singleOpen).toContain("idx_meal_response_one_open_experiment_per_user");
    expect(singleOpen).toContain("status IN ('draft', 'active', 'paused')");
  });

  it("activates all bounded rollout controls", () => {
    for (const flag of [
      "collection_enabled",
      "episode_building_enabled",
      "insight_display_enabled",
      "ranking_use_enabled",
      "experiments_enabled",
    ]) {
      expect(hardening).toContain(`'${flag}', TRUE`);
    }
  });
});
