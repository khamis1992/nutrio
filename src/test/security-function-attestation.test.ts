import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readRepoFile = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const migration = readRepoFile(
  "supabase/migrations/20260717143000_attest_security_function_definitions.sql",
);
const deploy = readRepoFile(".github/workflows/deploy-edge-functions.yml");

describe("live security function attestation", () => {
  it("captures immutable hashes for critical function definitions", () => {
    expect(migration).toContain("security.function_definition_attestations");
    expect(migration).toContain("pg_catalog.pg_get_functiondef");
    expect(migration).toContain("security_function_attestation_immutable_trigger");
    expect(migration).toContain("public.has_role(uuid,public.app_role)");
    expect(migration).toContain("public.admin_seal_security_incident(uuid,integer)");
  });

  it("reports missing or changed functions and alert worker freshness in Admin", () => {
    expect(migration).toContain("current.current_sha256 IS DISTINCT FROM current.expected_sha256");
    expect(migration).toContain("critical_function_definition_attestation");
    expect(migration).toContain("critical_alert_delivery_health");
    expect(migration).toContain("interval '15 minutes'");
    expect(migration).toContain("interval '1 hour'");
  });

  it("blocks Edge deployment until the complete release baseline is present", () => {
    expect(deploy).toContain("security_release_runtime_version");
    expect(deploy).toContain('"20260717143000"');
  });
});
