import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    "supabase/migrations/20260717094000_ingest_auth_audit_events.sql",
  ),
  "utf8",
);

describe("Supabase Auth forensic ingestion", () => {
  it("mirrors Auth audit entries into the immutable security ledger", () => {
    expect(migration).toContain("ON auth.audit_log_entries");
    expect(migration).toContain("AFTER INSERT ON auth.audit_log_entries");
    expect(migration).toContain("'authentication.supabase.'");
    expect(migration).toContain("'authentication'");
    expect(migration).toContain("'auth'");
  });

  it("captures MFA, session, password, and identity changes with severity", () => {
    expect(migration).toContain("'verification_attempted'");
    expect(migration).toContain("'mfa_code_login'");
    expect(migration).toContain("'user_updated_password'");
    expect(migration).toContain("'factor_deleted'");
    expect(migration).toContain("'token_revoked'");
    expect(migration).toContain("'identity_unlinked'");
  });

  it("stores only a minimized metadata allowlist", () => {
    const metadataStart = migration.indexOf(
      "jsonb_strip_nulls(jsonb_build_object(",
    );
    const metadataEnd = migration.indexOf(
      ")),\n    repeat('0', 64)",
      metadataStart,
    );
    const metadataBlock = migration.slice(metadataStart, metadataEnd);

    expect(metadataBlock).toContain("'auth_audit_id'");
    expect(metadataBlock).toContain("'provider'");
    expect(metadataBlock).not.toContain("actor_username");
    expect(metadataBlock).not.toContain("user_email");
    expect(metadataBlock).not.toContain("access_token");
    expect(metadataBlock).not.toContain("refresh_token");
  });

  it("does not allow telemetry failure to break authentication", () => {
    expect(migration).toContain("EXCEPTION WHEN OTHERS THEN");
    expect(migration).toContain("RETURN NEW;");
    expect(migration).toContain(
      "Nutrio auth audit mirror failed for action %",
    );
    expect(migration).not.toContain("RAISE EXCEPTION");
  });
});
