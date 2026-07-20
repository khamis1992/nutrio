import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260720203000_meal_response_privacy_lifecycle.sql"),
  "utf8",
);

describe("meal-response privacy lifecycle migration", () => {
  it("exposes only authenticated owner RPCs and keeps writes behind definer functions", () => {
    for (const signature of [
      "public.export_my_meal_response_data(UUID)",
      "public.revoke_my_meal_response_scopes(TEXT[], UUID, TEXT)",
      "public.delete_my_meal_response_data(UUID, TEXT)",
    ]) {
      expect(migration).toContain(`REVOKE ALL ON FUNCTION ${signature}`);
      expect(migration).toContain(`GRANT EXECUTE ON FUNCTION ${signature}`);
    }
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("meal_response_privacy_action_request_unique");
    expect(migration).not.toMatch(/GRANT (?:INSERT|UPDATE|DELETE|ALL) ON TABLE public\.meal_response_privacy_actions TO authenticated/);
  });

  it("exports minimized records without raw samples, device IDs, cursors, or credentials", () => {
    const exportStart = migration.indexOf("CREATE OR REPLACE FUNCTION public.export_my_meal_response_data");
    const exportEnd = migration.indexOf("CREATE OR REPLACE FUNCTION public.revoke_my_meal_response_scopes");
    const exportSql = migration.slice(exportStart, exportEnd);

    expect(exportSql).toContain("glucose_sample_summary");
    expect(exportSql).toContain("source_metadata");
    expect(exportSql).not.toContain("sync_cursor");
    expect(exportSql).not.toContain("device_id");
    expect(exportSql).not.toContain("source_app");
    expect(exportSql).not.toContain("samples.raw");
    expect(exportSql).not.toContain("access_token");
    expect(exportSql).not.toContain("refresh_token");
  });

  it("cancels response work and revokes glucose processing on consent withdrawal", () => {
    expect(migration).toContain("meal.response_checkin_due.v1");
    expect(migration).toContain("meal.response_insight_ready.v1");
    expect(migration).toContain("status = 'suppressed'");
    expect(migration).toContain("metric_type = 'blood_glucose'");
    expect(migration).toContain("sync_status = 'revoked'");
    expect(migration).toContain("raw = '{}'::JSONB");
    expect(migration).toContain("DELETE FROM public.meal_response_estimates");
    expect(migration).toContain("DELETE FROM public.meal_response_feature_snapshots");
    expect(migration).toContain("DELETE FROM public.meal_response_episodes");
  });

  it("records revocation and full deletion in the append-only consent ledger", () => {
    expect(migration).toContain("'revoked', p_policy_version");
    expect(migration).toContain("'dataset_deleted', p_policy_version");
    expect(migration).toContain("'meal_response_privacy'");
    expect(migration).toContain("canonical_nutrition_logs_retained");
    expect(migration).toContain("time_precision = 'date_only'");
  });
});
