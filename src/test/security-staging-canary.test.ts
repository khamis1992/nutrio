import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/security-staging-canary.yml"),
  "utf8",
);

describe("security staging canary", () => {
  it("is manual, environment-protected, and refuses an unexpected project", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("environment: Security Staging");
    expect(workflow).toContain('test "$CONFIRMATION" = "STAGING-CANARY"');
    expect(workflow).toContain(
      'test "$SUPABASE_URL" = "https://${EXPECTED_PROJECT_REF}.supabase.co"',
    );
  });

  it("uses a server secret only as an apikey and never as a bearer token", () => {
    expect(workflow).toContain("sb_secret_*");
    expect(workflow).toContain('-H "apikey: $SECRET_KEY"');
    expect(workflow).not.toContain("Authorization: Bearer $SECRET_KEY");
  });

  it("creates a synthetic critical event and requires signed delivery health", () => {
    expect(workflow).toContain("security.canary.alert_delivery");
    expect(workflow).toContain("dispatch-security-alerts");
    expect(workflow).toContain("get_security_alert_delivery_health");
    expect(workflow).toContain("dead_letter_count == 0");
    expect(workflow).toContain("last_delivered_at");
  });
});
