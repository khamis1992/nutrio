import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readWorkspaceFile = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("partner banking source boundaries", () => {
  it("keeps AdminRestaurantDetail on an explicit non-sensitive select", () => {
    const source = readWorkspaceFile(
      "src/pages/admin/AdminRestaurantDetail.tsx",
    );
    const detailsQueryStart = source.indexOf('.from("restaurant_details")');
    const detailsQuery = source.slice(
      detailsQueryStart,
      detailsQueryStart + 500,
    );

    expect(detailsQueryStart).toBeGreaterThan(-1);
    expect(detailsQuery).toContain(
      "id, restaurant_id, alternate_phone, avg_prep_time_minutes, max_meals_per_day, operating_hours, website_url",
    );
    expect(detailsQuery).not.toContain('.select("*")');
    expect(source).not.toMatch(
      /restaurantDetails\.bank_account_number(?!_masked)/,
    );
    expect(source).not.toMatch(
      /restaurantDetails\.bank_account_name(?!_masked)/,
    );
    expect(source).not.toMatch(/restaurantDetails\.bank_iban(?!_masked)/);
    expect(source).not.toMatch(/restaurantDetails\.swift_code(?!_masked)/);
  });

  it("orders banking encryption before onboarding completion in one RPC", () => {
    const migration = readWorkspaceFile(
      "supabase/migrations/20260717091000_atomic_partner_onboarding_banking.sql",
    );
    const atomicFunction = migration.slice(
      migration.indexOf(
        "CREATE OR REPLACE FUNCTION public.complete_partner_onboarding",
      ),
    );
    const encryptAt = atomicFunction.indexOf(
      "PERFORM public.set_restaurant_banking_info",
    );
    const completeAt = atomicFunction.indexOf(
      "onboarding_completed = true",
      encryptAt,
    );

    expect(atomicFunction).toContain("v_actor UUID := auth.uid()");
    expect(atomicFunction).not.toContain("p_owner_id");
    expect(encryptAt).toBeGreaterThan(-1);
    expect(completeAt).toBeGreaterThan(encryptAt);
    expect(atomicFunction).toContain("security.partner_onboarding_requests");
    expect(atomicFunction).toContain("ONBOARDING_REQUEST_KEY_CONFLICT");

    const responseObjects = atomicFunction.match(
      /RETURN jsonb_build_object\([\s\S]*?\);/g,
    );
    expect(responseObjects).toHaveLength(2);
    for (const responseObject of responseObjects || []) {
      expect(responseObject).not.toMatch(/'bank_/);
      expect(responseObject).not.toMatch(/'iban'/);
      expect(responseObject).not.toMatch(/'swift'/);
    }
  });

  it("scopes the legacy compensation to the newly created pending row", () => {
    const source = readWorkspaceFile(
      "src/pages/partner/PartnerOnboarding.tsx",
    );
    const rollbackStart = source.indexOf(
      "Compensate only the row created by this attempt",
    );
    const rollback = source.slice(rollbackStart, rollbackStart + 900);

    expect(rollbackStart).toBeGreaterThan(-1);
    expect(rollback).toContain('.from("restaurants")');
    expect(rollback).toContain(".delete()");
    expect(rollback).toContain('.eq("id", createdRestaurantId)');
    expect(rollback).toContain('.eq("owner_id", user.id)');
    expect(rollback).toContain('.eq("approval_status", "pending")');
    expect(rollback).toContain('.eq("is_active", false)');
    expect(rollback).toContain('.select("id")');
  });

  it("records banking changes without copying a banking payload", () => {
    const migration = readWorkspaceFile(
      "supabase/migrations/20260717091000_atomic_partner_onboarding_banking.sql",
    );
    const auditFunction = migration.slice(
      migration.indexOf(
        "CREATE OR REPLACE FUNCTION security.audit_partner_banking_change",
      ),
      migration.indexOf(
        "CREATE OR REPLACE FUNCTION public.complete_partner_onboarding",
      ),
    );

    expect(auditFunction).toContain("'contains_banking_payload', false");
    expect(auditFunction).toContain("'changed_fields', to_jsonb(v_changed_fields)");
    expect(auditFunction).not.toContain("to_jsonb(NEW)");
    expect(auditFunction).not.toContain("decrypt_sensitive_data");
  });
});
