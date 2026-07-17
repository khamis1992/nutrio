import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readRepoFile = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const edgeFunction = readRepoFile(
  "supabase/functions/register-driver/index.ts",
);
const authPage = readRepoFile("src/pages/driver/DriverAuth.tsx");
const config = readRepoFile("supabase/config.toml");

describe("driver registration boundary", () => {
  it("creates the application only after a verified authenticated session", () => {
    expect(edgeFunction).toContain("principal = await authenticateRequest(req)");
    expect(edgeFunction).toContain("principal.user.email_confirmed_at");
    expect(edgeFunction).toContain('metadata.account_type !== "driver"');
    expect(edgeFunction).toContain("getAuthenticatedClient(req)");
    expect(edgeFunction).not.toContain("getServiceClient");
  });

  it("forces every public driver application into a powerless pending state", () => {
    for (const expected of [
      'approval_status: "pending"',
      "is_active: false",
      "is_online: false",
      'status: "pending_verification"',
      "current_job_id: null",
      "assigned_zone_ids: []",
      "wallet_balance: 0",
      "total_earnings: 0",
      "total_deliveries: 0",
      "rating: 0",
      "cancellation_rate: 0",
      "payout_details: null",
    ]) {
      expect(edgeFunction).toContain(expected);
    }
  });

  it("does not let the browser grant itself a driver role or create rows early", () => {
    expect(authPage).toContain('account_type: "driver"');
    expect(authPage).toContain('supabase.functions.invoke("register-driver"');
    expect(authPage).not.toContain('.from("user_roles")');
    expect(authPage).not.toMatch(/\.from\("drivers"\)\s*\.insert/);
    expect(authPage).toContain("if (authData.session)");
    expect(authPage).toContain("Confirm your email, then sign in");
  });

  it("uses the configured web base path for the confirmation callback", () => {
    expect(authPage).toContain("import.meta.env.VITE_APP_URL");
    expect(authPage).toContain("import.meta.env.BASE_URL");
    expect(authPage).toContain("/driver/auth?verified=1");
  });

  it("rate-limits and records successful and failed applications", () => {
    expect(edgeFunction).toContain('enforceRateLimit(req, "register-driver"');
    expect(edgeFunction).toContain("driver.application_registered");
    expect(edgeFunction).toContain("driver.application_registration_failed");
    expect(config).toMatch(
      /\[functions\.register-driver\][\s\S]*?verify_jwt = true/,
    );
  });
});
