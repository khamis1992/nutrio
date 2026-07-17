import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readRepoFile = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const migration = readRepoFile(
  "supabase/migrations/20260717100000_security_runtime_attestation.sql",
);
const securityCenter = readRepoFile(
  "src/pages/admin/AdminSecurityCenter.tsx",
);

describe("security runtime attestation", () => {
  it("inherits the existing AAL2 and evidence-integrity posture", () => {
    expect(migration).toContain(
      "RENAME TO admin_security_posture_integrity_v2",
    );
    expect(migration).toContain(
      "v_base := public.admin_security_posture_integrity_v2()",
    );
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.admin_security_posture_integrity_v2()",
    );
  });

  it("fails posture when required event triggers are missing or disabled", () => {
    expect(migration).toContain("nutrio_security_auth_audit_trigger");
    expect(migration).toContain("security_critical_business_row_trigger");
    expect(migration).toContain("security_critical_business_update_trigger");
    expect(migration).toContain("security_critical_business_audit_trigger");
    expect(migration).toContain("trigger_row.tgenabled IN ('O', 'A')");
    expect(migration).toContain(
      "(trigger_row.tgtype::INTEGER & 60) = e.event_mask",
    );
    expect(migration).toContain("trigger_row.tgqual IS NULL");
    expect(migration).toContain("trigger_row.tgattr::SMALLINT[]");
    expect(migration).toContain("attribute.attname = required_column.column_name");
    expect(migration).toContain(
      "ARRAY['status', 'driver_id', 'handover_method', 'schedule_id']::TEXT[]",
    );
    expect(migration).toContain("subscription_plan_columns");
    expect(migration).toContain("'security_event_sources_installed'");
    expect(migration).toContain(
      "CASE WHEN v_missing_trigger_count = 0 THEN 'pass' ELSE 'fail' END",
    );
  });

  it("fails posture when sensitive RPC grants drift", () => {
    expect(migration).toContain(
      "public.admin_finalize_partner_invitation(uuid,uuid,uuid,text,text,text,text,text,text,text)",
    );
    expect(migration).toContain(
      "public.authenticate_partner_api_request(uuid,text)",
    );
    expect(migration).toContain(
      "pg_catalog.has_function_privilege('service_role'",
    );
    expect(migration).toContain("pg_catalog.aclexplode(");
    expect(migration).toContain("function_acl.grantee <> function_row.proowner");
    expect(migration).toContain(
      "COALESCE(grantee_role.rolname, 'PUBLIC') <> 'service_role'",
    );
    expect(migration).toContain("'service_only_security_rpcs'");
  });

  it("requires recent runtime evidence instead of trusting installation alone", () => {
    expect(migration).toContain("authentication.supabase.%");
    expect(migration).toContain("delivery.%");
    expect(migration).toContain("commercial.%");
    expect(migration).toContain("partner.api_authentication_succeeded");
    expect(migration).toContain("partner.api_authentication_failed");
    expect(migration).toContain("interval '30 days'");
    expect(migration).toContain("'auth_event_flow_verified'");
    expect(migration).toContain("'critical_business_event_flow_verified'");
    expect(migration).toContain("'partner_api_event_flow_verified'");
    expect(migration).toContain(
      "v_latest_delivery_event IS NULL OR v_latest_commercial_event IS NULL",
    );
    expect(migration).toContain(
      "v_latest_partner_api_success IS NULL OR v_latest_partner_api_failure IS NULL",
    );
    expect(migration).toContain(
      "'Partner API success and failure attempts are both producing immutable evidence'",
    );
  });

  it("exposes the attested controls version in the Admin Security page", () => {
    expect(migration).toContain(
      "'release_version', '20260717100000'",
    );
    expect(securityCenter).toContain("release_version?: string");
    expect(securityCenter).toContain("Controls ${posture.release_version}");
  });
});
