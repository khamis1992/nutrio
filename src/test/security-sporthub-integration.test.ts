import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readRepoFile = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const migration = readRepoFile(
  "supabase/migrations/20260717132000_harden_sporthub_webhook_and_credentials.sql",
);
const completionMigration = readRepoFile(
  "supabase/migrations/20260717138000_require_authenticated_sporthub_link_completion.sql",
);
const webhook = readRepoFile("supabase/functions/sporthub-webhook/index.ts");
const oauthCallback = readRepoFile(
  "supabase/functions/sporthub-oauth-callback/index.ts",
);
const oauthCompletion = readRepoFile(
  "supabase/functions/sporthub-link-complete/index.ts",
);
const sync = readRepoFile("supabase/functions/sporthub-sync/index.ts");
const shared = readRepoFile("supabase/functions/_shared/sporthub.ts");

describe("SportHub security boundary", () => {
  it("authenticates and bounds public webhook requests before parsing", () => {
    expect(webhook).toContain("const MAX_WEBHOOK_BYTES = 64 * 1024");
    expect(webhook).toContain('contentType !== "application/json"');
    expect(webhook).toContain("verifySignature(`${timestamp}.${rawBody}`");
    expect(webhook).toContain("MAX_TIMESTAMP_SKEW_MS");
    expect(webhook).toContain('enforceRateLimit(\n      req,\n      "sporthub-webhook:ip"');
    expect(webhook).toContain("constantTimeEqual");
  });

  it("persists only minimized data through an atomic replay and ownership RPC", () => {
    expect(webhook).toContain('service.rpc(\n      "ingest_sporthub_webhook_event"');
    expect(webhook).not.toContain('.from("partner_events").insert');
    expect(webhook).not.toContain('raw_payload: payload');
    expect(webhook).not.toContain('payload: { ...payload');
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.ingest_sporthub_webhook_event");
    expect(migration).toContain("ON CONFLICT DO NOTHING");
    expect(migration).toContain("PERFORM public.ingest_sporthub_activity");
    expect(migration).toContain("SERVICE_ROLE_REQUIRED");
    expect(migration).toContain("legacy_minimized");
  });

  it("keeps OAuth state and credentials service-only and customer-bound", () => {
    expect(migration).toContain("ALTER TABLE public.partner_oauth_states FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("ALTER TABLE public.partner_credentials FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("partner_integrations_linked_external_identity_idx");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.complete_sporthub_link");
    expect(oauthCallback).toContain("consume_partner_oauth_state");
    expect(oauthCallback).toContain("code_verifier: oauthState.code_verifier");
  });

  it("requires authenticated same-user confirmation after the public callback", () => {
    expect(completionMigration).toContain(
      "CREATE TABLE IF NOT EXISTS public.partner_oauth_pending_links",
    );
    expect(completionMigration).toContain(
      "pending.user_id = p_user_id",
    );
    expect(completionMigration).toContain("pending.consumed_at IS NULL");
    expect(completionMigration).toContain("pending.expires_at > clock_timestamp()");
    expect(oauthCallback).toContain('eventType: "integration.sporthub.link_confirmation_required"');
    expect(oauthCallback).toContain("redirectForAuthenticatedCompletion");
    expect(oauthCallback).not.toContain('"complete_sporthub_link"');
    expect(oauthCompletion).toContain("principal = await authenticateRequest(req)");
    expect(oauthCompletion).toContain('"consume_sporthub_pending_link"');
    expect(oauthCompletion).toContain("p_user_id: principal.user.id");
    expect(oauthCompletion).toContain('"complete_sporthub_link"');
  });

  it("uses versioned AAD encryption, exact provider hosts, and fixed bearer auth", () => {
    expect(shared).toContain("SPORTHUB_TOKEN_ENCRYPTION_KEYS");
    expect(shared).toContain("SPORTHUB_TOKEN_ENCRYPTION_KEY_ID");
    expect(shared).toContain("nutrio:sporthub-token:v2:${context}");
    expect(shared).toContain("additionalData: tokenAdditionalData(context)");
    expect(shared).toContain("configuredHosts.includes(hostname)");
    expect(shared).not.toContain("hostname.endsWith");
    expect(oauthCallback).toContain('Authorization: `Bearer ${tokens.access_token}`');
    expect(sync).toContain('Authorization: `Bearer ${accessToken}`');
    expect(sync).toContain("isLegacyEncryptedSecret");
    expect(sync).toContain("integration.sporthub.credentials_invalid");
  });
});
