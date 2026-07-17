import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readRepoFile = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const migration = readRepoFile(
  "supabase/migrations/20260717140000_security_alert_outbox.sql",
);
const worker = readRepoFile(
  "supabase/functions/dispatch-security-alerts/index.ts",
);
const schedule = readRepoFile(
  ".github/workflows/scheduled-security-workers.yml",
);

describe("critical security alert delivery", () => {
  it("enqueues only high and critical events without recursive alert events", () => {
    expect(migration).toContain("NEW.severity IN ('high', 'critical')");
    expect(migration).toContain("NEW.event_type NOT LIKE 'security.alert.%'");
    expect(migration).toContain("AFTER INSERT ON security.event_ledger");
    expect(migration).not.toContain("actor_user_id");
    expect(migration).not.toContain("ip_address");
    expect(migration).not.toContain("user_agent");
    expect(migration).not.toContain("metadata JSONB");
  });

  it("uses an atomic lease, bounded retries, and a dead letter state", () => {
    expect(migration).toContain("FOR UPDATE SKIP LOCKED");
    expect(migration).toContain("queue.claim_token = p_claim_token");
    expect(migration).toContain("queue.attempts < queue.max_attempts");
    expect(migration).toContain("ELSE 'dead_letter'");
    expect(migration).toContain("LEAST(3600");
  });

  it("signs the exact outbound body and requires a signed receiver acknowledgement", () => {
    expect(worker).toContain("`${timestamp}.${requestId}.${body}`");
    expect(worker).toContain('redirect: "error"');
    expect(worker).toContain("AbortSignal.timeout(12_000)");
    expect(worker).toContain("nutrio-security-alert-ack-v1");
    expect(worker).toContain("constantTimeHexEqual");
    expect(worker).toContain("RESPONSE_LIMIT");
  });

  it("fails closed on missing configuration and runs in bounded scheduled batches", () => {
    expect(worker).toContain("security_alert_hmac_key_missing");
    expect(worker).toContain("security_alert_hmac_key_id_invalid");
    expect(worker).toContain("SECURITY_ALERT_ALLOWED_HOSTS");
    expect(schedule).toContain("security-alerts:");
    expect(schedule).toContain("SECURITY_ALERT_CRON_SECRET");
    expect(schedule).toContain("'{\"limit\":10}'");
  });
});
