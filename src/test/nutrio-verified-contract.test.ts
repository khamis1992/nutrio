import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = source("supabase/migrations/20260720220000_nutrio_verified_nutrition.sql");
const portalContracts = source("supabase/migrations/20260720221000_nutrio_verified_portal_contracts.sql");
const resubmission = source("supabase/migrations/20260720222000_resubmit_nutrio_verified_request.sql");
const viewHardening = source("supabase/migrations/20260720249000_harden_nutrio_verified_view.sql");
const customer = source("src/components/meal/NutrioVerifiedBadge.tsx");
const partner = source("src/components/partner/PartnerNutritionVerificationControl.tsx");
const admin = source("src/components/admin/NutritionVerificationOperations.tsx");

describe("Nutrio Verified launch contract", () => {
  it("binds every claim to a measured nutrition version and invalidates it on change", () => {
    expect(migration).toContain("nutrition_version INTEGER NOT NULL");
    expect(migration).toContain("supersede_meal_nutrition_verification_trigger");
    expect(migration).toContain("v.nutrition_version = m.nutrition_version");
    expect(migration).toContain("v.expires_at > clock_timestamp()");
  });

  it("requires complete sourced nutrition and independent evidence for stronger claims", () => {
    expect(migration).toContain("NUTRITION_DATA_INCOMPLETE");
    expect(migration).toContain("NUTRITION_SOURCE_REFERENCE_REQUIRED");
    expect(migration).toContain("INDEPENDENT_EVIDENCE_REQUIRED");
    expect(migration).toContain("dietitian_reviewed");
    expect(migration).toContain("lab_tested");
  });

  it("keeps review, suspension, and sampling behind AAL2 admin authorization", () => {
    expect(migration.match(/ADMIN_AAL2_REQUIRED/g)?.length).toBeGreaterThanOrEqual(3);
    expect(migration).toContain("public.has_role(v_actor, 'admin'::public.app_role)");
    expect(migration).toContain("admin_record_meal_nutrition_verification_sample");
    expect(migration).toContain("admin_suspend_meal_nutrition_verification");
  });

  it("exposes only privacy-safe fields to customers while keeping evidence in admin operations", () => {
    const publicRpc = portalContracts.slice(
      portalContracts.indexOf("get_current_meal_nutrition_verification"),
      portalContracts.indexOf("partner_list_meal_nutrition_verification_statuses"),
    );
    expect(publicRpc).toContain("public_summary");
    expect(publicRpc).not.toContain("verified_by");
    expect(publicRpc).not.toContain("evidence_reference");
    expect(portalContracts).toContain("ADMIN_AAL2_REQUIRED");
  });

  it("keeps the internal verification view behind scoped RPC contracts", () => {
    expect(viewHardening).toContain("security_invoker = true");
    expect(viewHardening).toContain("security_barrier = true");
    expect(viewHardening).toContain("FROM PUBLIC, anon, authenticated");
    expect(viewHardening).toContain("GRANT SELECT ON public.current_meal_nutrition_verifications TO service_role");
    expect(viewHardening).not.toContain("TO anon, authenticated");
  });

  it("supports an owned needs-info resubmission without creating a duplicate request", () => {
    expect(resubmission).toContain("q.requested_by = v_actor");
    expect(resubmission).toContain("r.owner_id = v_actor");
    expect(resubmission).toContain("q.status = 'needs_info'");
    expect(resubmission).toContain("SET status = 'pending'");
    expect(resubmission).not.toContain("INSERT INTO public.meal_nutrition_verification_requests");
  });

  it("connects the customer, partner, and admin portals to server RPCs", () => {
    expect(customer).toContain('"get_current_meal_nutrition_verification"');
    expect(partner).toContain('"request_meal_nutrition_verification"');
    expect(partner).toContain('"resubmit_meal_nutrition_verification_request"');
    expect(admin).toContain('"admin_get_nutrition_verification_operations"');
    expect(admin).toContain('"admin_review_meal_nutrition_verification"');
  });
});
