import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260720100000_explainable_meal_ranking_audits.sql"),
  "utf8",
);

describe("meal ranking audit security", () => {
  it("keeps audit rows private and blocks direct authenticated writes", () => {
    expect(migration).toMatch(/ENABLE ROW LEVEL SECURITY;[\s\S]*FORCE ROW LEVEL SECURITY;/);
    expect(migration).toMatch(/REVOKE ALL ON public\.meal_ranking_audits FROM PUBLIC, anon, authenticated/);
    expect(migration).toMatch(/FOR SELECT TO authenticated[\s\S]*user_id = \(SELECT auth\.uid\(\)\)/);
    expect(migration).not.toMatch(/GRANT (?:INSERT|UPDATE|DELETE|ALL) ON public\.meal_ranking_audits TO authenticated/);
  });

  it("uses a bounded authenticated RPC without storing raw health inputs", () => {
    expect(migration).toContain("v_user_id UUID := auth.uid()");
    expect(migration).toContain("jsonb_array_length(p_ranked) > 50");
    expect(migration).toContain("octet_length(p_context::TEXT) > 8192");
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.record_meal_ranking_audit[\s\S]*TO authenticated/);
    expect(migration).not.toMatch(/medication|allergen_name|health_sample/i);
  });

  it("is replay-safe without mutating an existing audit row", () => {
    expect(migration).toContain("ON CONFLICT (user_id, request_id) DO NOTHING");
    expect(migration).not.toMatch(/ON CONFLICT[\s\S]{0,100}DO UPDATE/);
  });
});
