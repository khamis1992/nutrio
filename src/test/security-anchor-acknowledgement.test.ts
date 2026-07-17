import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readRepoFile = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const migration = readRepoFile(
  "supabase/migrations/20260717137000_verify_external_anchor_acknowledgements.sql",
);
const worker = readRepoFile(
  "supabase/functions/security-log-maintenance/index.ts",
);

describe("external security anchor acknowledgement verification", () => {
  it("verifies the receiver HMAC again with a Vault-held key", () => {
    expect(migration).toContain("security_anchor_ack_hmac_key");
    expect(migration).toContain("security.get_anchor_acknowledgement_hmac_key()");
    expect(migration).toContain("extensions.hmac(");
    expect(migration).toContain("v_expected_signature IS DISTINCT FROM lower(p_receipt_signature)");
    expect(migration).toContain("'database_signature_verified', true");
  });

  it("binds the receipt to the exact signed anchor chain and timestamp text", () => {
    expect(migration).toContain(
      "v_anchor.previous_anchor_hash IS DISTINCT FROM p_previous_anchor_hash",
    );
    expect(migration).toContain("p_acknowledged_at_text");
    expect(migration).toContain("p_external_reference");
    expect(migration).toContain("trim(p_acknowledgement_nonce)");
    expect(migration).toContain("trim(p_acknowledgement_key_id)");
    expect(migration).toContain("abs(extract(epoch FROM (clock_timestamp() - v_acknowledged_at))) > 900");
  });

  it("removes the forgeable v2 service-role grant and grants only v3", () => {
    expect(migration).toContain("DATABASE_VERIFIED_RECEIVER_ACKNOWLEDGEMENT_REQUIRED");
    expect(migration).toContain(
      "FROM PUBLIC, anon, authenticated, service_role",
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.record_security_anchor_receipt_v3\([\s\S]*?\) TO service_role;/,
    );
    expect(worker).toContain('"record_security_anchor_receipt_v3"');
    expect(worker).not.toContain('"record_security_anchor_receipt_v2"');
  });

  it("fails the scheduled worker when the external evidence sink is absent", () => {
    expect(worker).toContain(
      'throw new HttpError(503, "security_anchor_sink_not_configured")',
    );
    expect(worker).not.toContain(
      'warning: "external_anchor_sink_not_configured"',
    );
  });
});
