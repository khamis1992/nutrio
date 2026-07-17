import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  lookupIpGeo,
  normalizeIpAddress,
} from "../../supabase/functions/_shared/ipGeo";

const hookSource = readFileSync(
  resolve(process.cwd(), "supabase/functions/before-user-created/index.ts"),
  "utf8",
);
const config = readFileSync(
  resolve(process.cwd(), "supabase/config.toml"),
  "utf8",
);

describe("server-enforced signup geolocation", () => {
  it("normalizes valid addresses and rejects forwarded lists or URL input", () => {
    expect(normalizeIpAddress(" 192.168.001.010 ")).toBe("192.168.1.10");
    expect(normalizeIpAddress("2001:DB8::1")).toBe("2001:db8::1");
    expect(normalizeIpAddress("1.1.1.1, 2.2.2.2")).toBeNull();
    expect(normalizeIpAddress("https://example.com")).toBeNull();
    expect(normalizeIpAddress("999.1.1.1")).toBeNull();
  });

  it("accepts only a validated two-letter country response", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL) =>
      new Response(JSON.stringify({
        success: true,
        country_code: "qa",
        country: "Qatar",
        city: "Doha",
      }), { status: 200 }));

    await expect(lookupIpGeo("1.2.3.4", fetcher)).resolves.toEqual({
      countryCode: "QA",
      country: "Qatar",
      city: "Doha",
    });
    expect(String(fetcher.mock.calls[0][0])).toContain("ipwho.is/1.2.3.4");

    await expect(lookupIpGeo("1.2.3.4", vi.fn(async () =>
      new Response(JSON.stringify({ success: false }), { status: 200 })))).rejects.toThrow(
      "ip_lookup_invalid_response",
    );
  });

  it("verifies the signed Auth hook before trusting its IP metadata", () => {
    expect(hookSource).toContain("new Webhook(getHookSecret())");
    expect(hookSource).toContain("webhook.verify(rawBody, Object.fromEntries(req.headers))");
    expect(hookSource).toContain("event.metadata?.ip_address");
    expect(hookSource).toContain('event.metadata?.name !== "before-user-created"');
    expect(hookSource).toContain('geo.countryCode !== ALLOWED_COUNTRY');
    expect(hookSource).toContain('const ALLOWED_COUNTRY = "QA"');
    expect(hookSource).toContain('"is_ip_blocked"');
    expect(hookSource).toContain("AUTH_BEFORE_USER_CREATED_HOOK_SECRET");
    expect(hookSource).toContain("consume_signup_provisioning_grant");
    expect(hookSource).toContain("hashProvisioningToken(provisioning.token)");
  });

  it("fails closed and writes allowed, denied, blocked, and failure evidence", () => {
    for (const eventType of [
      "authentication.supabase.signup_geo_allowed",
      "authentication.supabase.signup_geo_denied",
      "authentication.supabase.signup_blocked_ip",
      "authentication.supabase.signup_geo_verification_failed",
      "authentication.supabase.signup_rate_limited",
      "authentication.supabase.auth_hook_signature_rejected",
      "authentication.supabase.trusted_provisioning_allowed",
      "authentication.supabase.trusted_provisioning_denied",
    ]) {
      expect(hookSource).toContain(eventType);
    }
    expect(hookSource).toContain("return hookResponse(req, 503");
    expect(hookSource).toContain("p_ip_address: input.sourceIp");
    expect(hookSource).not.toContain("p_metadata: { email");
  });

  it("exposes the hook without trusting a client JWT", () => {
    expect(config).toContain("[functions.before-user-created]");
    expect(config).toMatch(/\[functions\.before-user-created\][\s\S]*?verify_jwt = false/);
  });
});
