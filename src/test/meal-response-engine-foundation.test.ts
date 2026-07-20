import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720200000_meal_response_engine_foundation.sql",
  ),
  "utf8",
);

describe("meal-response engine database foundation", () => {
  it("keeps the legacy order RPC and exposes stable JSON client contracts", () => {
    expect(migration).not.toContain(
      "CREATE OR REPLACE FUNCTION public.record_order_meal_consumption",
    );

    for (const signature of [
      "public.set_meal_consumption_timing(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, SMALLINT)",
      "public.get_my_meal_response_dashboard()",
      "public.get_my_meal_response_ranking_input()",
      "public.set_meal_response_preferences(BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, UUID)",
      "public.submit_meal_response_check_in(UUID, UUID, SMALLINT, SMALLINT, SMALLINT, TEXT[], SMALLINT, TEXT[], TIMESTAMPTZ)",
      "public.record_meal_response_insight_feedback(UUID, UUID, BOOLEAN, TEXT, TEXT)",
    ]) {
      expect(migration).toContain(`GRANT EXECUTE ON FUNCTION ${signature}`);
    }

    expect(migration.match(/RETURNS JSONB/g)?.length).toBeGreaterThanOrEqual(6);
  });

  it("adds precise timing and all compatible consumption sources", () => {
    for (const field of [
      "started_consuming_at",
      "finished_consuming_at",
      "time_precision",
      "portion_confirmed_at",
      "timezone_name",
      "utc_offset_minutes",
      "consumed_item_snapshot",
    ]) {
      expect(migration).toContain(field);
    }
    for (const source of [
      "'order'",
      "'meal_schedule'",
      "'manual_log'",
      "'barcode_product'",
      "'custom_food'",
      "'coach_program'",
    ]) {
      expect(migration).toContain(source);
    }
  });

  it("stores normalized high-frequency glucose with strict validation", () => {
    expect(migration).toContain("'blood_glucose'");
    expect(migration).toContain("'heart_rate_sample'");
    expect(migration).toContain("sample_kind = 'instant'");
    expect(migration).toContain("unit = 'mg/dL'");
    expect(migration).toContain("v_original_value * 18.0182");
    expect(migration).toContain("INVALID_SAMPLE_BATCH_SIZE");
    expect(migration).toContain("GLUCOSE_VALUE_OUT_OF_RANGE");
    expect(migration).toContain("GLUCOSE_ANALYSIS_OPT_IN_REQUIRED");
    expect(migration).toContain("ON CONFLICT (user_id, dedupe_key) DO UPDATE");
  });

  it("creates complete lineage with forced RLS and RPC-only writes", () => {
    for (const table of [
      "meal_response_check_ins",
      "meal_response_episodes",
      "meal_response_feature_snapshots",
      "meal_response_estimates",
      "meal_response_model_registry",
      "meal_response_experiments",
      "meal_response_experiment_assignments",
      "meal_response_insight_feedback",
      "meal_response_glucose_ingest_batches",
    ]) {
      expect(migration).toContain(`'public.${table}'::REGCLASS`);
    }
    expect(migration).toContain("FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("USING (user_id = (SELECT auth.uid()))");
    expect(migration).not.toMatch(
      /GRANT (INSERT|UPDATE|DELETE) ON (?:TABLE )?public\.meal_response_.* TO authenticated/,
    );
  });

  it("indexes active sample time and response foreign keys", () => {
    expect(migration).toContain(
      "(user_id, metric_type, start_at DESC)",
    );
    for (const index of [
      "idx_meal_response_checkins_consumption",
      "idx_meal_response_episodes_consumption",
      "idx_meal_response_features_episode",
      "idx_meal_response_estimates_feature",
      "idx_meal_response_estimates_model",
      "idx_meal_response_assignments_experiment",
      "idx_meal_response_feedback_estimate",
    ]) {
      expect(migration).toContain(index);
    }
  });
});
