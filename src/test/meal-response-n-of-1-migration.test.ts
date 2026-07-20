import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260720202500_meal_response_n_of_1_experiments.sql"),
  "utf8",
);

describe("meal response N-of-1 experiment database contract", () => {
  it("requires exactly two arms and at least three repeats per arm", () => {
    expect(migration).toContain("jsonb_array_length(arms) = 2");
    expect(migration).toContain("minimum_repeats_per_arm BETWEEN 3 AND 20");
    expect(migration).toContain("EXACTLY_TWO_ARMS_REQUIRED");
  });

  it("creates a balanced immutable alternating sequence after a random first arm", () => {
    expect(migration).toContain("get_byte(uuid_send(gen_random_uuid()), 0) % 2");
    expect(migration).toContain("v_experiment.minimum_repeats_per_arm * 2");
    expect(migration).toContain("CASE WHEN v_index % 2 = 1 THEN v_first_key ELSE v_second_key END");
    expect(migration).toContain("ACTIVE_EXPERIMENT_SEQUENCE_IS_IMMUTABLE");
    expect(migration).toContain("BEFORE INSERT OR UPDATE OR DELETE");
    expect(migration).toContain("ASSIGNMENTS_MUST_BE_COMPLETED_IN_SEQUENCE");
  });

  it("gates writes by consent and the experiments rollout flag", () => {
    expect(migration).toContain("preferences.meal_response_enabled");
    expect(migration).toContain("settings.value ->> 'experiments_enabled'");
    expect(migration).toContain("MEAL_RESPONSE_EXPERIMENTS_NOT_AVAILABLE");
  });

  it("links only completed canonical consumptions and summarizes eligible episodes", () => {
    expect(migration).toContain("COMPLETED_CANONICAL_CONSUMPTION_REQUIRED");
    expect(migration).toContain("consumptions.status IN ('full', 'partial', 'substituted')");
    expect(migration).toContain("candidate.eligibility = 'eligible'");
    expect(migration).toContain("candidate.superseded_at IS NULL");
    expect(migration).toContain("ORDER BY candidate.built_at DESC");
    expect(migration).toContain("count(DISTINCT eligible.response_start_at::DATE)");
  });

  it("allows causal wording only after balanced distinct-day repeats", () => {
    expect(migration).toContain("v_arm_zero_days >= GREATEST(3, v_experiment.minimum_repeats_per_arm)");
    expect(migration).toContain("abs(v_arm_zero_repeats - v_arm_one_repeats) <= 1");
    expect(migration).toContain("abs(v_arm_zero_days - v_arm_one_days) <= 1");
    expect(migration).toContain("INSUFFICIENT_ELIGIBLE_DISTINCT_DAY_REPEATS");
    expect(migration).toContain("'personal_n_of_1_association'");
  });

  it("uses owner RLS, idempotent request UUIDs, and explicit grants", () => {
    expect(migration).toContain("UNIQUE (user_id, request_id)");
    expect(migration).toContain("FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("USING (user_id = (SELECT auth.uid()))");
    expect(migration).not.toMatch(/GRANT (INSERT|UPDATE|DELETE).* TO authenticated/);
    for (const signature of [
      "public.create_meal_response_experiment(UUID, TEXT, TEXT, JSONB, SMALLINT, TEXT)",
      "public.start_meal_response_experiment(UUID, UUID)",
      "public.pause_meal_response_experiment(UUID, UUID)",
      "public.cancel_meal_response_experiment(UUID, UUID)",
      "public.link_meal_response_experiment_consumption(UUID, UUID, UUID, UUID)",
      "public.get_my_meal_response_experiment(UUID)",
    ]) {
      expect(migration).toContain(`GRANT EXECUTE ON FUNCTION ${signature} TO authenticated`);
    }
  });
});
