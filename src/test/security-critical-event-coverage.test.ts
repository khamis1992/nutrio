import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readRepoFile = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const migration = readRepoFile(
  "supabase/migrations/20260717095000_expand_critical_security_event_coverage.sql",
);
const partnerProvisioning = readRepoFile(
  "supabase/functions/create-partner-user/index.ts",
);
const sharedSecurity = readRepoFile(
  "supabase/functions/_shared/security.ts",
);

const partnerAuthStart = migration.indexOf(
  "CREATE OR REPLACE FUNCTION public.authenticate_partner_api_request(",
);
const partnerAuthEnd = migration.indexOf("$function$;", partnerAuthStart);
const partnerAuthFunction = migration.slice(partnerAuthStart, partnerAuthEnd);

describe("critical business event coverage", () => {
  it("captures delivery custody and commercial control changes", () => {
    for (const table of [
      "delivery_jobs",
      "driver_assignment_history",
      "subscription_plans",
      "promotions",
      "platform_settings",
      "meals",
    ]) {
      expect(migration).toContain(`'${table}'`);
    }

    expect(migration).toContain("security_critical_business_audit_trigger");
    expect(migration).toContain("'delivery.job.'");
    expect(migration).toContain("'delivery.assignment.'");
    expect(migration).toContain("'commercial.'");
    expect(migration).toContain("'previous_status'");
    expect(migration).toContain("'new_status'");
    expect(migration).toContain("'previous_price'");
    expect(migration).toContain("'new_price'");
    expect(migration).toContain("pg_catalog.pg_attribute");
    expect(migration).toContain("v_subscription_plan_update_columns");
    expect(migration).toContain("'daily_meals'");
    expect(migration).toContain("'price_per_snack'");
  });

  it("attributes known portal roles and does not copy setting values", () => {
    expect(migration).toContain(
      "v_actor_role IN ('admin', 'partner', 'driver', 'coach')",
    );
    expect(migration).toContain("'previous_value_sha256'");
    expect(migration).toContain("'new_value_sha256'");
    expect(migration).not.toContain("'previous_value', v_old ->> 'value'");
    expect(migration).not.toContain("'new_value', v_new ->> 'value'");
  });

  it("finalizes partner privilege and ownership changes atomically with evidence", () => {
    const rpcStart = migration.indexOf(
      "CREATE OR REPLACE FUNCTION public.admin_finalize_partner_invitation(",
    );
    const rpcEnd = migration.indexOf("$function$;", rpcStart);
    const rpc = migration.slice(rpcStart, rpcEnd);

    expect(rpc).toContain("COALESCE(auth.role(), '') <> 'service_role'");
    expect(rpc).toContain("ur.role::TEXT = 'admin'");
    expect(rpc).toContain("INSERT INTO public.user_roles");
    expect(rpc).toContain("UPDATE public.restaurants");
    expect(rpc).toContain("security.record_event(");
    expect(rpc).toContain("p_actor_user_id := p_actor_user_id");
    expect(rpc.indexOf("UPDATE public.restaurants")).toBeLessThan(
      rpc.indexOf("security.record_event("),
    );

    expect(partnerProvisioning).toContain(
      '"admin_finalize_partner_invitation"',
    );
    expect(partnerProvisioning).toContain(
      "p_actor_user_id: principal.user.id",
    );
    expect(partnerProvisioning).toContain(
      "invitationCleanupFailed ? \"critical\" : \"high\"",
    );
    expect(partnerProvisioning).toContain(
      "cleanup_failed: invitationCleanupFailed",
    );
    expect(partnerProvisioning).toContain(
      "invited_user_id: invitedUserId",
    );
    expect(partnerProvisioning).not.toContain('.from("user_roles")');
    expect(partnerProvisioning).not.toMatch(
      /\.from\("restaurants"\)[\s\S]{0,180}\.update\(/,
    );
    expect(sharedSecurity).toContain(
      "export async function getSessionFingerprint",
    );
  });

  it("records partner API success and failure without database-peer IP evidence", () => {
    expect(partnerAuthFunction).toContain(
      "'partner.api_authentication_failed'",
    );
    expect(partnerAuthFunction).toContain(
      "'partner.api_authentication_succeeded'",
    );
    expect(partnerAuthFunction).toContain("v_headers ->> 'x-forwarded-for'");
    expect(partnerAuthFunction).toContain("'ip_source'");
    expect(partnerAuthFunction).not.toContain("inet_client_addr()");
    expect(partnerAuthFunction).not.toContain("p_api_secret :=");
  });
});
