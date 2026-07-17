import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readRepoFile = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const migration = readRepoFile(
  "supabase/migrations/20260717141000_seal_incidents_and_track_evidence_custody.sql",
);
const panel = readRepoFile(
  "src/components/admin/SecurityIncidentPanel.tsx",
);

describe("security incident final sealing and evidence custody", () => {
  it("requires a closed, intact case with linked evidence before final sealing", () => {
    expect(migration).toContain("INCIDENT_MUST_BE_CLOSED_BEFORE_SEALING");
    expect(migration).toContain("INCIDENT_EVIDENCE_REQUIRED");
    expect(migration).toContain("INCIDENT_INTEGRITY_INVALID");
    expect(migration).toContain("security.calculate_incident_seal(NEW)");
  });

  it("prevents mutations and new case evidence after the final seal", () => {
    expect(migration).toContain("SEALED_INCIDENT_IMMUTABLE");
    expect(migration).toContain("BEFORE UPDATE OR DELETE ON security.incidents");
    expect(migration).toContain("BEFORE INSERT ON security.incident_timeline");
    expect(migration).toContain("BEFORE INSERT ON security.incident_event_links");
    expect(migration).toContain("BEFORE TRUNCATE ON security.incidents");
  });

  it("keeps exports and handoffs in a separate append-only hash chain", () => {
    expect(migration).toContain("security.incident_evidence_custody");
    expect(migration).toContain("security.calculate_incident_custody_hash");
    expect(migration).toContain("previous_hash");
    expect(migration).toContain("Incident custody is append-only");
    expect(migration).toContain("INCIDENT_EXPORTED_PACKAGE_NOT_FOUND");
  });

  it("exposes explicit sealing and evidence handoff controls in Admin", () => {
    expect(panel).toContain('"admin_seal_security_incident"');
    expect(panel).toContain('"admin_record_incident_evidence_transfer"');
    expect(panel).toContain("Seal final case");
    expect(panel).toContain("Record handoff");
  });
});
