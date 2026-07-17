import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readRepoFile = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const preMfaMigrationPath =
  "supabase/migrations/20260716133500_prepare_admin_policies_for_mfa.sql";
const mfaMigrationPath =
  "supabase/migrations/20260716134000_require_admin_mfa.sql";
const authorizationMigrationPath =
  "supabase/migrations/20260717093000_harden_authorization_boundaries.sql";

const preMfaMigration = readRepoFile(preMfaMigrationPath);
const mfaMigration = readRepoFile(mfaMigrationPath);
const authorizationMigration = readRepoFile(authorizationMigrationPath);

const extractFunction = (functionName: string) => {
  const match = authorizationMigration.match(
    new RegExp(
      `CREATE OR REPLACE FUNCTION public\\.${functionName}\\([^]*?\\$function\\$;`,
    ),
  );

  return match?.[0] ?? "";
};

const driverBoundary = extractFunction("enforce_driver_authorization_boundary");
const driverSync = extractFunction("sync_driver_current_job");
const restaurantBoundary = extractFunction(
  "enforce_restaurant_authorization_boundary",
);
const restaurantLogoHelper = extractFunction(
  "can_write_restaurant_logo_object",
);

describe("database authorization boundary migrations", () => {
  it("repairs direct admin policies before the MFA deployment guard", () => {
    expect(preMfaMigrationPath.localeCompare(mfaMigrationPath)).toBeLessThan(0);
    expect(mfaMigrationPath.localeCompare(authorizationMigrationPath)).toBeLessThan(
      0,
    );
    expect(preMfaMigration).toContain(
      "DROP POLICY IF EXISTS subscriptions_admin_manage",
    );
    expect(preMfaMigration).not.toContain(
      "CREATE POLICY subscriptions_admin_manage",
    );
    expect(mfaMigration).toContain(
      "CREATE POLICY subscriptions_admin_manage",
    );
    expect(mfaMigration).toContain(
      "public.has_role((SELECT auth.uid()), 'admin'::public.app_role)",
    );
    expect(
      mfaMigration.indexOf("CREATE OR REPLACE FUNCTION public.has_role"),
    ).toBeLessThan(
      mfaMigration.indexOf("CREATE POLICY subscriptions_admin_manage"),
    );
    expect(
      mfaMigration.indexOf("CREATE POLICY subscriptions_admin_manage"),
    ).toBeLessThan(
      mfaMigration.indexOf("Unsafe direct admin policy remains"),
    );
    expect(preMfaMigration).toContain(
      "DROP POLICY IF EXISTS %I ON %I.%I",
    );
    expect(preMfaMigration).toContain(
      "Unsafe direct admin/staff policy remains before MFA",
    );
    expect(preMfaMigration).toContain("LIKE '%staff%'");
    expect(mfaMigration).toContain("Unsafe direct admin policy remains");
  });

  it("forces self-registered drivers into an inactive pending state", () => {
    expect(driverBoundary).toContain(
      "CREATE OR REPLACE FUNCTION public.enforce_driver_authorization_boundary()",
    );
    expect(driverBoundary).toContain("SECURITY INVOKER");
    expect(driverBoundary).toContain(
      "NEW.approval_status := 'pending'::public.approval_status",
    );
    expect(driverBoundary).toContain("NEW.is_active := false");
    expect(driverBoundary).toContain("NEW.is_online := false");
    expect(driverBoundary).not.toMatch(
      /v_is_trusted_definer|rolsuper|rolbypassrls|pg_trigger_depth/,
    );
    expect(driverBoundary).toContain("app.delivery_claim_authorized");
    expect(driverBoundary).toContain("DELIVERY_ASSIGNMENT_SCOPE_VIOLATION");
    expect(driverSync).toContain(
      "set_config('app.delivery_claim_authorized', 'true', true)",
    );
    expect(authorizationMigration).toContain("drivers_self_register_pending");
    expect(authorizationMigration).toContain(
      "Unexpected driver INSERT/ALL policy remains",
    );
  });

  it("separates restaurant onboarding from approved operator access", () => {
    expect(authorizationMigration).toMatch(
      /is_restaurant_operator[\s\S]*approval_status = 'approved'[\s\S]*is_active/,
    );
    expect(restaurantBoundary).toContain(
      "NEW.approval_status := 'pending'::public.approval_status",
    );
    expect(restaurantBoundary).not.toMatch(
      /v_is_trusted_definer|rolsuper|rolbypassrls/,
    );
    expect(restaurantBoundary).toContain(
      "OLD.owner_id IS DISTINCT FROM v_actor",
    );
    expect(restaurantBoundary).toContain("FROM public.restaurant_staff rs");
    expect(restaurantBoundary).toContain("'manage_restaurant'");
    expect(restaurantBoundary).toContain(
      "public.is_restaurant_operator(OLD.id, v_actor)",
    );
    expect(restaurantBoundary).not.toContain("public.has_staff_permission");
    expect(restaurantBoundary).toContain(
      "RESTAURANT_TENANT_UPDATE_FORBIDDEN",
    );
    expect(restaurantBoundary).toContain("NEW.id IS DISTINCT FROM OLD.id");
    expect(restaurantBoundary).toContain(
      "RESTAURANT_APPROVAL_AND_FINANCIAL_FIELDS_REQUIRE_ADMIN",
    );
    expect(authorizationMigration).toContain(
      "restaurants_approved_operator_update",
    );
    expect(authorizationMigration).toContain(
      "Unexpected restaurant write policy remains",
    );
  });

  it("requires AAL2 and removes anonymous finance access", () => {
    expect(authorizationMigration).toContain("ADMIN_AAL2_REQUIRED");
    expect(authorizationMigration).toContain(
      "COALESCE(auth.jwt() ->> 'aal', 'aal1') <> 'aal2'",
    );
    expect(authorizationMigration).toMatch(
      /REVOKE ALL ON FUNCTION public\.admin_update_user_subscription_wallet\([\s\S]*?\) FROM PUBLIC, anon, authenticated, service_role;/,
    );
    expect(authorizationMigration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.admin_update_user_subscription_wallet\([\s\S]*?\) TO authenticated, service_role;/,
    );
    expect(authorizationMigration).toContain(
      "Anonymous role can execute admin finance RPC",
    );
  });

  it("removes client execution from legacy assignment helpers", () => {
    expect(authorizationMigration).toContain(
      "p.proname IN ('unassign_driver', 'auto_assign_driver')",
    );
    expect(authorizationMigration).toContain(
      "REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role",
    );
    expect(authorizationMigration).toContain(
      "Legacy assignment RPC remains client-callable",
    );
  });

  it("replaces bucket-wide media writes with owner/operator policies", () => {
    expect(authorizationMigration).toContain(
      "public.can_write_restaurant_logo_object",
    );
    expect(authorizationMigration).toContain(
      "public.can_write_meal_image_object",
    );
    expect(authorizationMigration).toContain("restaurant_logo_authorized_insert");
    expect(authorizationMigration).toContain("meal_image_authorized_insert");
    expect(authorizationMigration).toContain(
      "Legacy media write policy remains",
    );
    expect(authorizationMigration).toContain(
      "Storage write policy is not bucket-scoped",
    );
    const ownerPrefixStart = restaurantLogoHelper.indexOf(
      "p_owner_id = p_user_id::TEXT",
    );
    const restaurantIdBranchStart = restaurantLogoHelper.indexOf(
      "OR EXISTS",
      ownerPrefixStart,
    );
    const ownerPrefixBranch = restaurantLogoHelper.slice(
      ownerPrefixStart,
      restaurantIdBranchStart,
    );

    expect(ownerPrefixStart).toBeGreaterThan(-1);
    expect(restaurantIdBranchStart).toBeGreaterThan(ownerPrefixStart);
    expect(ownerPrefixBranch).toContain(
      "storage.filename(p_name) LIKE p_user_id::TEXT || '-%'",
    );
    expect(ownerPrefixBranch).toContain("'partner'::public.app_role");
    expect(ownerPrefixBranch).not.toContain("FROM public.restaurants");
    expect(restaurantLogoHelper.slice(restaurantIdBranchStart)).toContain(
      "public.is_restaurant_operator(r.id, p_user_id)",
    );
    expect(authorizationMigration).toContain("file_size_limit, 5242880");
    expect(authorizationMigration).toContain("'image/jpeg'");
    expect(authorizationMigration).toContain("'image/png'");
    expect(authorizationMigration).toContain("'image/webp'");
    expect(authorizationMigration).not.toContain("'image/svg+xml'");
  });
});
