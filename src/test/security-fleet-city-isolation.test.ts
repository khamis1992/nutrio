import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260717130000_fleet_city_isolation_and_mfa.sql",
);
const migration = readFileSync(migrationPath, "utf8");
const sharedSecurity = readFileSync(
  resolve(process.cwd(), "supabase/functions/_shared/security.ts"),
  "utf8",
);
const fleetFunctions = [
  "fleet-drivers",
  "fleet-tracking",
  "fleet-payouts",
].map((name) =>
  readFileSync(
    resolve(process.cwd(), `supabase/functions/${name}/index.ts`),
    "utf8",
  )
);

describe("fleet city authorization boundary", () => {
  it("requires city-scoped RLS for dispatch and payout data", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS city_id UUID");
    expect(migration).toContain("public.can_manage_fleet_city(city_id)");
    expect(migration).toContain("public.can_manage_fleet_city(v_payout.city_id)");
    expect(migration).toContain("public.can_manage_fleet_city(v_job.city_id)");
    expect(migration).not.toMatch(
      /CREATE POLICY[\s\S]{0,240}public\.is_active_fleet_operator/,
    );
  });

  it("blocks cross-city assignment and self-claim", () => {
    expect(migration).toContain("CROSS_CITY_DRIVER_ASSIGNMENT");
    expect(migration).toContain("v_job.city_id <> v_driver.city_id");
    expect(migration).toContain("DELIVERY_SOURCE_CITY_REQUIRED");
  });

  it("requires aal2 for fleet super administrators", () => {
    expect(migration).toContain("fm.role = 'super_admin'");
    expect(migration).toContain("auth.jwt() ->> 'aal'");
    expect(migration).toContain("fleet_record_mfa_verification");
  });

  it("requires aal2 inside every privileged fleet Edge API", () => {
    expect(sharedSecurity).toContain("export async function requireMfaAssurance");
    expect(sharedSecurity).toContain('principal.aal === "aal2"');
    expect(sharedSecurity).toContain('throw new HttpError(403, "mfa_required")');

    for (const source of fleetFunctions) {
      expect(source).toContain("await requireMfaAssurance(req, principal");
      expect(source).toMatch(
        /if \(!manager \|\| !FLEET_ROLES\.has\(String\(manager\.role\)\)\)[\s\S]{0,180}await requireMfaAssurance\(req, principal/,
      );
    }
  });
});
