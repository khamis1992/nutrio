import { describe, expect, it } from "vitest";

import {
  LAUNCH_EVIDENCE_SCHEMA_VERSION,
  LAUNCH_GATES,
  evaluateLaunchReadiness,
} from "../../scripts/lib/launch-readiness.mjs";

function completeEnvironment() {
  return {
    ...Object.fromEntries(
      LAUNCH_GATES.flatMap((gate) => gate.requiredEnvironment).map((key) => [key, "test-value"]),
    ),
    RUN_REAL_SUPABASE_INTEGRATION: "1",
  };
}

function completeEvidence() {
  return {
    schemaVersion: LAUNCH_EVIDENCE_SCHEMA_VERSION,
    releaseSha: "release-sha",
    generatedAt: "2026-07-20T00:00:00.000Z",
    gates: Object.fromEntries(
      LAUNCH_GATES.map((gate) => [
        gate.id,
        {
          status: "passed",
          approvedBy: gate.owner,
          approvedAt: "2026-07-20T00:00:00.000Z",
          artifacts: gate.requiredArtifacts.map((id) => ({
            id,
            uri: `evidence://${id}`,
            recordedAt: "2026-07-20T00:00:00.000Z",
            sha256: "a".repeat(64),
          })),
        },
      ]),
    ),
  };
}

describe("launch readiness gate", () => {
  it("passes only with every credential and evidence artifact", () => {
    const result = evaluateLaunchReadiness({
      env: completeEnvironment(),
      evidenceManifest: completeEvidence(),
      migrationExists: true,
      now: new Date("2026-07-20T12:00:00.000Z"),
    });

    expect(result.ready).toBe(true);
    expect(result.gates.every((gate) => gate.status === "passed")).toBe(true);
  });

  it("fails closed when evidence and credentials are absent", () => {
    const result = evaluateLaunchReadiness({
      env: {},
      evidenceManifest: null,
      migrationExists: true,
      now: new Date("2026-07-20T12:00:00.000Z"),
    });

    expect(result.ready).toBe(false);
    expect(result.gates.every((gate) => gate.status === "blocked")).toBe(true);
  });

  it("blocks sensitive feature flags forced on before external approval", () => {
    const result = evaluateLaunchReadiness({
      env: {
        ...completeEnvironment(),
        VITE_PHASE_ONE_FLAGS: "competitive-family-accounts",
      },
      evidenceManifest: completeEvidence(),
      migrationExists: true,
      now: new Date("2026-07-20T12:00:00.000Z"),
    });

    expect(result.ready).toBe(false);
    expect(result.globalIssues).toContain(
      "Sensitive feature flag competitive-family-accounts must remain default-off",
    );
  });

  it("rejects an incomplete evidence artifact", () => {
    const evidence = completeEvidence();
    evidence.gates["supabase-security"].artifacts = [];

    const result = evaluateLaunchReadiness({
      env: completeEnvironment(),
      evidenceManifest: evidence,
      migrationExists: true,
      now: new Date("2026-07-20T12:00:00.000Z"),
    });

    expect(result.ready).toBe(false);
    expect(result.gates[0].issues).toContain("Missing artifact migration-entry");
  });

  it("can verify signed evidence without loading provider secrets", () => {
    const result = evaluateLaunchReadiness({
      env: {},
      evidenceManifest: completeEvidence(),
      checkEnvironment: false,
      migrationExists: true,
      expectedReleaseSha: "release-sha",
      now: new Date("2026-07-20T12:00:00.000Z"),
    });

    expect(result.ready).toBe(true);
  });

  it("rejects stale evidence or evidence for a different release commit", () => {
    const result = evaluateLaunchReadiness({
      env: completeEnvironment(),
      evidenceManifest: completeEvidence(),
      migrationExists: true,
      expectedReleaseSha: "different-sha",
      now: new Date("2027-08-01T00:00:00.000Z"),
    });

    expect(result.ready).toBe(false);
    expect(result.globalIssues).toContain(
      "Evidence manifest releaseSha does not match the release commit",
    );
    expect(result.gates.some((gate) => gate.issues.some((issue) => issue.includes("older than")))).toBe(true);
  });
});
