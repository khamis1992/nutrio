import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(
  process.cwd(),
  "supabase/migrations/20260720203500_meal_response_model_governance.sql",
), "utf8");

describe("meal-response model governance migration", () => {
  it("requires admin AAL2 for every management and operations RPC", () => {
    expect(sql).toContain("auth.jwt() ->> 'aal'");
    expect(sql).toContain("v_aal <> 'aal2'");
    expect(sql).toContain("public.has_role(v_actor, 'admin')");
    expect(sql.match(/require_meal_response_model_admin_aal2\(\)/g)?.length).toBeGreaterThanOrEqual(6);
  });

  it("locks registry and audit tables away from end users", () => {
    expect(sql).toContain("FORCE ROW LEVEL SECURITY");
    expect(sql).toContain("REVOKE ALL ON public.meal_response_model_registry FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("GRANT ALL ON public.meal_response_model_registry TO service_role");
    expect(sql).not.toMatch(/CREATE POLICY[\s\S]+meal_response_model_registry/);
  });

  it("enforces one champion and challenger and provides atomic lifecycle operations", () => {
    expect(sql).toContain("uq_meal_response_model_champion");
    expect(sql).toContain("uq_meal_response_model_challenger");
    expect(sql).toContain("admin_register_meal_response_model_candidate");
    expect(sql).toContain("admin_promote_meal_response_model");
    expect(sql).toContain("admin_retire_meal_response_model");
    expect(sql).toContain("admin_rollback_meal_response_model");
    expect(sql).toContain("meal_response_model_governance_audit");
  });

  it("returns aggregate operations data without selecting identifiers or raw samples", () => {
    const operationFunction = sql.slice(sql.indexOf("admin_get_meal_response_operations"));
    expect(operationFunction).toContain("lag_seconds_p95");
    expect(operationFunction).toContain("exclusion_rate");
    expect(operationFunction).toContain("abstention_rate");
    expect(operationFunction).toContain("accuracy_feedback");
    expect(operationFunction).not.toContain("s.user_id");
    expect(operationFunction).not.toContain("wearable_metric_samples");
  });
});
