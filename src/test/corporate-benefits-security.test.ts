import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260720247000_corporate_benefits_foundation.sql"), "utf8");

describe("Corporate benefit launch contract", () => {
  it("separates organization eligibility from Nutrio health and meal data", () => {
    expect(migration).toContain("corporate_organizations");
    expect(migration).toContain("corporate_memberships");
    expect(migration).toContain("eligibility_reference_hash");
    expect(migration).not.toContain("health_context");
    expect(migration).not.toContain("nutrition_snapshot");
  });

  it("requires customer consent before atomic, idempotent redemption", () => {
    expect(migration).toContain("accept_my_corporate_benefit");
    expect(migration).toContain("consented_at IS NULL");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("ON CONFLICT (schedule_id, event_type) DO NOTHING");
    expect(migration).toContain("CORPORATE_ALLOWANCE_EXHAUSTED");
    expect(migration).toContain("schedule_corporate_meals_atomic");
    expect(migration).toContain("SCHEDULE_BENEFICIARY_MISMATCH");
  });

  it("exposes aggregate sponsor reporting without individual rows", () => {
    expect(migration).toContain("get_corporate_sponsor_aggregate");
    expect(migration).toContain("Aggregate benefit utilization only; no meals, health goals, or individual member rows are exposed.");
    expect(migration).not.toContain("jsonb_agg(to_jsonb(m)");
    expect(migration).toContain("sponsor_aggregate_consent");
    expect(migration).toContain("SPONSOR_AAL2_REQUIRED");
    expect(migration).toContain("COALESCE(auth.jwt() ->> 'aal', 'aal1') <> 'aal2'");
    expect(migration).toContain("allowance_period_start");
    expect(migration).toContain("CORPORATE_REDEMPTION_MEMBERSHIP_MISMATCH");
  });

  it("enforces AAL2 administration and immutable issued invoices", () => {
    expect(migration).toContain("ADMIN_AAL2_REQUIRED");
    expect(migration).toContain("admin_generate_corporate_invoice");
    expect(migration).toContain("ISSUED_INVOICE_IS_IMMUTABLE");
    expect(migration).toContain("FORCE ROW LEVEL SECURITY");
  });
});
