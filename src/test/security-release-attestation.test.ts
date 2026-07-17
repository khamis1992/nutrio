import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260717136000_security_release_attestation.sql",
  ),
  "utf8",
);

describe("security release attestation", () => {
  it("checks delivery capabilities, direct-write policies, triggers, and reviewed RPC grants", () => {
    expect(migration).toContain("delivery_capability_and_assignment_boundary");
    expect(migration).toContain("security.delivery_pickup_capabilities");
    expect(migration).toContain("delivery_jobs_rpc_only_insert");
    expect(migration).toContain("delivery_jobs_rpc_only_update");
    expect(migration.match(/SELECT count\(\*\) = 1 AND COALESCE\(bool_and\(/g)).toHaveLength(2);
    expect(migration).toContain("enforce_delivery_job_rpc_boundary");
    expect(migration).toContain("enforce_driver_authorization_boundary");
    expect(migration).toContain("assign_fleet_delivery_job");
  });

  it("attests service-only AI reservations and notification delivery idempotency", () => {
    expect(migration).toContain("ai_quota_and_notification_idempotency");
    expect(migration).toContain("ai_request_ledger_task_allowed");
    expect(migration).toContain("ai_usage_daily_task_allowed");
    expect(migration).toContain("reserve_ai_request");
    expect(migration).toContain("notifications_delivery_dedupe_unique");
    expect(migration).toContain("protect_notification_delivery_identity");
  });

  it("keeps old forensic readers private and records the final posture read", () => {
    expect(migration).toContain("forensic_evidence_read_audit");
    expect(migration).toContain("evidence_access_legacy");
    expect(migration).toContain("admin_security_posture_evidence_access_v1");
    expect(migration).toContain("security.record_admin_evidence_access");
    expect(migration).toContain(
      "security.record_admin_evidence_access(text,text,text,jsonb)",
    );
    expect(migration).toContain("'release_version', '20260717136000'");
  });
});
