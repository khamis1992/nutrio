import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readRepoFile = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const migration = readRepoFile(
  "supabase/migrations/20260717110000_secure_signup_provisioning.sql",
);
const helper = readRepoFile(
  "supabase/functions/_shared/signupProvisioning.ts",
);
const authHook = readRepoFile(
  "supabase/functions/before-user-created/index.ts",
);
const fleetManagerFunction = readRepoFile(
  "supabase/functions/create-fleet-manager/index.ts",
);
const partnerFunction = readRepoFile(
  "supabase/functions/create-partner-user/index.ts",
);
const fleetDriverFunction = readRepoFile(
  "supabase/functions/fleet-drivers/index.ts",
);
const fleetManagerDialog = readRepoFile(
  "src/components/admin/CreateFleetManagerDialog.tsx",
);
const config = readRepoFile("supabase/config.toml");

describe("privileged Auth account provisioning", () => {
  it("uses a random, hashed, short-lived, single-use invitation grant", () => {
    expect(helper).toContain("crypto.getRandomValues(random)");
    expect(helper).toContain('crypto.subtle.digest(\n    "SHA-256"');
    expect(helper).toContain("p_ttl_seconds: 300");
    expect(migration).toContain("token_hash TEXT NOT NULL UNIQUE");
    expect(migration).not.toMatch(/\btoken\s+TEXT/i);
    expect(migration).toContain("AND consumed_at IS NULL");
    expect(migration).toContain("AND expires_at > clock_timestamp()");
    expect(migration).toContain("SET consumed_at = clock_timestamp()");
  });

  it("allows only the Auth hook to consume a matching email and invitation kind", () => {
    expect(authHook).toContain("consume_signup_provisioning_grant");
    expect(authHook).toContain("p_email: email");
    expect(authHook).toContain("p_kind: provisioning.kind");
    expect(authHook).toContain("trusted_provisioning_denied");
    expect(authHook).toContain("This account invitation is invalid or expired.");
    expect(migration).toContain(
      "normalized_email = lower(trim(COALESCE(p_email, '')))",
    );
    expect(migration).toContain("AND kind = p_kind");
  });

  it("keeps all provisioning RPCs service-only", () => {
    for (const functionName of [
      "issue_signup_provisioning_grant",
      "consume_signup_provisioning_grant",
      "is_signup_provisioning_grant_consumed",
      "admin_finalize_fleet_manager_invitation",
    ]) {
      expect(migration).toMatch(
        new RegExp(`REVOKE ALL ON FUNCTION public\\.${functionName}\\([\\s\\S]*?FROM PUBLIC, anon, authenticated, service_role;`),
      );
    }
    expect(migration).toContain("COALESCE(auth.role(), '') <> 'service_role'");
  });

  it("requires an MFA-protected admin Edge Function for fleet managers", () => {
    expect(fleetManagerFunction).toContain("principal = await requireAdmin(req)");
    expect(fleetManagerFunction).toContain("create-fleet-manager");
    expect(fleetManagerFunction).toContain("issueSignupProvisioningGrant");
    expect(fleetManagerFunction).toContain("assertSignupProvisioningGrantConsumed");
    expect(fleetManagerFunction).toContain("clearSignupProvisioningMetadata");
    expect(fleetManagerFunction).toContain("auth.admin.deleteUser(userId)");
    expect(fleetManagerFunction).toContain(
      'service.rpc(\n        "admin_finalize_fleet_manager_invitation"',
    );
    expect(config).toMatch(
      /\[functions\.create-fleet-manager\][\s\S]*?verify_jwt = true/,
    );

    expect(fleetManagerDialog).toContain(
      'supabase.functions.invoke(\n        "create-fleet-manager"',
    );
    expect(fleetManagerDialog).not.toContain("supabase.auth.admin");
    expect(fleetManagerDialog).not.toContain("password:");
  });

  it("does not grant a scoped fleet manager the global admin role", () => {
    expect(migration).toContain("IF p_fleet_role = 'super_admin' THEN");
    expect(migration).toContain(
      "VALUES (p_invited_user_id, 'admin'::public.app_role)",
    );
    expect(migration).toContain(
      "Fleet managers are authorized by their scoped fleet_managers row",
    );
  });

  it("applies the grant protocol to partner and fleet-driver invitations", () => {
    for (const source of [partnerFunction, fleetDriverFunction]) {
      expect(source).toContain("issueSignupProvisioningGrant");
      expect(source).toContain("assertSignupProvisioningGrantConsumed");
      expect(source).toContain("clearSignupProvisioningMetadata");
      expect(source).toContain("nutrio_provisioning_token");
      expect(source).toContain("auth.admin.deleteUser");
    }
    expect(partnerFunction).not.toContain('account_type: "partner"');
    expect(fleetDriverFunction).not.toContain('role: "driver"');
  });

  it("removes the spent raw grant from Auth metadata", () => {
    expect(helper).toContain("delete sanitizedMetadata.nutrio_provisioning_token");
    expect(helper).toContain("delete sanitizedMetadata.nutrio_provisioning_kind");
    expect(helper).toContain("service.auth.admin.updateUserById");
  });
});
