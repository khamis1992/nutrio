import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "infra/security-evidence-receiver");
const read = (name: string) => readFileSync(resolve(root, name), "utf8");
const workflow = readFileSync(resolve(process.cwd(), ".github/workflows/supply-chain-security.yml"), "utf8");

describe("independent security evidence receiver", () => {
  it("provisions immutable encrypted evidence storage outside Supabase", () => {
    const terraform = read("main.tf");
    expect(terraform).toContain('object_lock_enabled = true');
    expect(terraform).toContain('mode = "COMPLIANCE"');
    expect(terraform).toContain('status = "Enabled"');
    expect(terraform).toContain('sse_algorithm     = "aws:kms"');
    expect(terraform).toContain("point_in_time_recovery");
    expect(terraform).toContain("aws_wafv2_web_acl");
    expect(terraform).toContain("DenyInsecureTransport");
    expect(terraform).toContain("DenyIncorrectEncryptionKey");
    expect(terraform).toContain("AllowEncryptedReceiverLogs");
    expect(terraform).not.toContain("aws_lambda_function_url");
  });

  it("uses independent secret references and conditional replay protection", () => {
    const receiver = read("receiver.mjs");
    const protocol = read("protocol.mjs");
    expect(receiver).toContain("ANCHOR_REQUEST_SECRET_ARN");
    expect(receiver).toContain("ANCHOR_ACK_SECRET_ARN");
    expect(receiver).toContain('requestKey === ackKey');
    expect(receiver).toContain('ConditionExpression: "attribute_not_exists(pk)"');
    expect(receiver).toContain('head_hash = :previous');
    expect(receiver).toContain('ObjectLockMode: "COMPLIANCE"');
    expect(protocol).toContain("timingSafeEqual");
  });

  it("generates acknowledgements matching both Nutrio canonical contracts", async () => {
    // The protocol module is plain ESM shared by the deployable Lambda bundle.
    // @ts-expect-error The infrastructure module intentionally has no TS declarations.
    const protocol = await import("../../infra/security-evidence-receiver/protocol.mjs");
    const key = "k".repeat(32);
    const anchor = protocol.anchorAck({
      anchor_hash: "a".repeat(64), payload_sha256: "b".repeat(64),
      previous_anchor_hash: "GENESIS", external_reference: `aws-s3:${"c".repeat(64)}`,
      acknowledged_at: "2026-07-17T12:00:00.000Z", nonce: "nonce-1234567890123456",
      key_id: "receiver-2026-01",
    }, key);
    const canonical = [anchor.protocol, anchor.anchor_hash, anchor.payload_sha256,
      anchor.previous_anchor_hash, anchor.external_reference, anchor.acknowledged_at,
      anchor.nonce, anchor.key_id].join("\n");
    expect(anchor.signature).toBe(`sha256=${protocol.hmac(key, canonical)}`);

    const alert = protocol.alertAck({
      alert_id: "alert-123", event_hash: "d".repeat(64),
      external_reference: `aws-s3:${"e".repeat(64)}`,
      acknowledged_at: "2026-07-17T12:00:00.000Z", nonce: "nonce-1234567890123456",
      key_id: "alert-2026-01",
    }, key);
    const alertCanonical = [alert.protocol, alert.alert_id, alert.event_hash,
      alert.external_reference, alert.acknowledged_at, alert.nonce, alert.key_id].join("\n");
    expect(alert.signature).toBe(`sha256=${protocol.hmac(key, alertCanonical)}`);
  });

  it("keeps Terraform validation in the protected supply-chain workflow", () => {
    expect(workflow).toContain("terraform fmt -check -recursive");
    expect(workflow).toContain("terraform init -backend=false -input=false -lockfile=readonly");
    expect(workflow).toContain("terraform validate");
    expect(workflow).toMatch(/[0-9a-f]{64}\s{2}terraform\.zip/);
  });
});
