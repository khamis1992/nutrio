import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260717120000_signup_security_attestation.sql",
  ),
  "utf8",
);
const securityCenter = readFileSync(
  resolve(process.cwd(), "src/pages/admin/AdminSecurityCenter.tsx"),
  "utf8",
);

describe("signup security runtime attestation", () => {
  it("inherits the prior AAL2-protected posture", () => {
    expect(migration).toContain(
      "RENAME TO admin_security_posture_runtime_v3",
    );
    expect(migration).toContain(
      "v_base := public.admin_security_posture_runtime_v3()",
    );
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.admin_security_posture_runtime_v3()",
    );
  });

  it("checks every provisioning RPC and the private grant store", () => {
    for (const functionName of [
      "issue_signup_provisioning_grant",
      "consume_signup_provisioning_grant",
      "is_signup_provisioning_grant_consumed",
      "admin_finalize_fleet_manager_invitation",
    ]) {
      expect(migration).toContain(functionName);
    }
    expect(migration).toContain("has_function_privilege('anon'");
    expect(migration).toContain("has_function_privilege('authenticated'");
    expect(migration).toContain("has_table_privilege");
    expect(migration).toContain("signup_provisioning_grants");
    expect(migration).toContain("signup_provisioning_access_boundary");
  });

  it("requires recent signed hook and complete invitation evidence", () => {
    expect(migration).toContain("signup_auth_hook_verified");
    expect(migration).toContain("privileged_provisioning_flow_verified");
    expect(migration).toContain("signup_geo_allowed");
    expect(migration).toContain("trusted_provisioning_grant_consumed");
    expect(migration).toContain("trusted_provisioning_allowed");
    expect(migration).toContain("interval '30 days'");
  });

  it("flags scoped fleet managers that retain global admin", () => {
    expect(migration).toContain("scoped_fleet_manager_admin_overlap");
    expect(migration).toContain("manager.role = 'fleet_manager'");
    expect(migration).toContain("role_row.role::TEXT = 'admin'");
    expect(migration).toContain("v_scoped_admin_overlap_count > 0");
  });

  it("publishes the new controls version to the Admin Security Center", () => {
    expect(migration).toContain(
      "'release_version', '20260717120000'",
    );
    expect(securityCenter).toContain("release_version?: string");
  });
});
