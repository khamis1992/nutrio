import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260717135000_audit_forensic_evidence_access.sql",
  ),
  "utf8",
);

describe("forensic evidence access auditing", () => {
  it("requires AAL2 admin authorization through the central helper", () => {
    expect(migration).toContain(
      "v_actor UUID := security.require_admin_actor()",
    );
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION security.record_admin_evidence_access",
    );
    expect(migration).toContain("FROM PUBLIC, anon, authenticated, service_role");
  });

  it("audits every evidence read surface after a successful result", () => {
    for (const action of [
      "search_events",
      "read_overview",
      "verify_integrity",
      "read_posture",
      "list_incidents",
      "view_incident",
    ]) {
      expect(migration).toContain(`'${action}'`);
    }
    expect(migration).toContain("'admin.forensic_evidence.' || p_action");
  });

  it("keeps sensitive filters out of the immutable ledger", () => {
    expect(migration).toContain(
      "'search_used', NULLIF(trim(COALESCE(p_search, '')), '') IS NOT NULL",
    );
    expect(migration).not.toContain("'search_text', p_search");
    expect(migration).toContain("security.redact_jsonb");
  });

  it("hashes the session identifier and preserves private legacy implementations", () => {
    expect(migration).toContain("'sha256:' || encode(");
    expect(migration).toContain(
      "admin_search_security_events_evidence_access_legacy",
    );
    expect(migration).toContain(
      "admin_get_security_incident_evidence_access_legacy",
    );
    expect(migration).toContain("VOLATILE");
  });
});
