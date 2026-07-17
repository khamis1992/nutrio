import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readRepoFile = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const migration = readRepoFile(
  "supabase/migrations/20260717142000_paginated_forensic_exports.sql",
);
const center = readRepoFile("src/pages/admin/AdminSecurityCenter.tsx");
const verifier = readRepoFile(
  "scripts/security/verify-forensic-export.mjs",
);

describe("complete forensic evidence exports", () => {
  it("uses a stable sequence cursor and exposes continuation metadata", () => {
    expect(migration).toContain("p_before_sequence BIGINT DEFAULT NULL");
    expect(migration).toContain("event.sequence_number < p_before_sequence");
    expect(migration).toContain("v_next_before_sequence := v_min_sequence");
    expect(migration).toContain("'next_before_sequence', v_next_before_sequence");
  });

  it("includes anchors, full memberships, and external receiver receipts", () => {
    expect(migration).toContain("security.event_chain_anchors");
    expect(migration).toContain("security.event_anchor_memberships");
    expect(migration).toContain("security.event_anchor_receipts");
    expect(migration).toContain("'anchor_memberships', v_memberships");
    expect(migration).toContain("'external_receipts', v_receipts");
  });

  it("downloads every JSON page while keeping legacy CSV explicitly bounded", () => {
    expect(center).toContain('"admin_prepare_security_export_page"');
    expect(center).toContain("do {");
    expect(center).toContain("Use JSON for a complete anchored export");
  });

  it("ships an offline verifier for checksums and membership hash chains", () => {
    expect(verifier).toContain('sha256("NUTRIO-EVENT-MEMBERSHIP-V3")');
    expect(verifier).toContain("Event ${entry.event_id} does not match its anchored hash snapshot");
    expect(verifier).toContain("Receipt references an absent anchor");
    expect(verifier).toContain("HMAC authenticity still requires the receiver key");
  });
});
