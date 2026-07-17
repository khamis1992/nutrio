import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];
const auditScript = resolve("scripts/security-static-audit.mjs");

function checkWorkflow(condition: string, jobEnv = "") {
  const directory = mkdtempSync(join(tmpdir(), "nutrio-workflow-policy-"));
  temporaryDirectories.push(directory);
  const workflowPath = join(directory, "workflow.yml");
  writeFileSync(
    workflowPath,
    // Keep the embedded shell quoting explicit inside this YAML fixture.
    // eslint-disable-next-line no-useless-escape
    `permissions:\n  contents: read\njobs:\n  e2e:\n    if: >-\n      ${condition}\n    environment: Trusted E2E\n${jobEnv}    steps:\n      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5\n        with:\n          ref: refs/heads/main\n          fetch-depth: 0\n      - name: Verify exact main\n        run: |\n          git fetch --force --no-tags origin main\n          trusted_sha=\"$(git rev-parse origin/main)\"\n          checked_out_sha=\"$(git rev-parse HEAD)\"\n          if [[ \"$GITHUB_SHA\" != \"$trusted_sha\" || \"$checked_out_sha\" != \"$trusted_sha\" ]]; then exit 1; fi\n      - run: npm ci\n      - name: Run Playwright\n        run: npx --no-install playwright test\n        env:\n          E2E_ADMIN_PASSWORD: \${{ secrets.E2E_ADMIN_PASSWORD }}\n`,
  );

  return spawnSync(
    process.execPath,
    [auditScript, "--check-e2e-workflow", workflowPath, "e2e", "Trusted E2E"],
    { encoding: "utf8" },
  );
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("trusted workflow policy", () => {
  it("accepts a current-main gate that dominates every event path", () => {
    const result = checkWorkflow(
      "github.ref == 'refs/heads/main' && (github.event_name == 'workflow_dispatch' || github.event_name == 'push')",
    );
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  it("rejects a manual-dispatch branch that bypasses the main gate", () => {
    const result = checkWorkflow(
      "github.event_name == 'workflow_dispatch' || (github.event_name == 'push' && github.ref == 'refs/heads/main')",
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("without requiring refs/heads/main");
  });

  it("rejects job-level credential exposure", () => {
    const result = checkWorkflow(
      "github.ref == 'refs/heads/main' && github.event_name == 'workflow_dispatch'",
      "    env:\n      E2E_ADMIN_PASSWORD: ${{ secrets.E2E_ADMIN_PASSWORD }}\n",
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("job-level env");
  });
});
