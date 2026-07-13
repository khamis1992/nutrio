import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import {
  corsHeaders,
  getAdminClient,
  getAuthenticatedUser,
  jsonResponse,
  randomBase64Url,
  safeRedirectPath,
  sha256,
} from "../_shared/sporthub.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return jsonResponse({ error: "unauthorized" }, 401);

    const authorizationUrl = Deno.env.get("SPORTHUB_AUTHORIZATION_URL");
    const clientId = Deno.env.get("SPORTHUB_CLIENT_ID");
    const redirectUri = Deno.env.get("SPORTHUB_REDIRECT_URI");
    if (!authorizationUrl || !clientId || !redirectUri) {
      return jsonResponse({ error: "sporthub_oauth_not_configured" }, 503);
    }

    const body = await req.json().catch(() => ({}));
    const redirectPath = safeRedirectPath(body?.redirect_path);
    const state = randomBase64Url(32);
    const codeVerifier = randomBase64Url(48);
    const [stateHash, codeChallenge] = await Promise.all([sha256(state), sha256(codeVerifier)]);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const admin = getAdminClient();

    const { error: stateError } = await admin.from("partner_oauth_states").insert({
      state_hash: stateHash,
      user_id: user.id,
      partner: "sporthub",
      code_verifier: codeVerifier,
      redirect_path: redirectPath,
      expires_at: expiresAt,
    });
    if (stateError) throw stateError;

    const { error: integrationError } = await admin.from("partner_integrations").upsert({
      user_id: user.id,
      partner: "sporthub",
      consent_status: "pending",
      metadata: {
        requested_at: new Date().toISOString(),
        requested_scope: ["openid", "profile", "bookings.read", "activities.read"],
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,partner" });
    if (integrationError) throw integrationError;

    const url = new URL(authorizationUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "openid profile bookings.read activities.read");
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");

    return jsonResponse({ authorization_url: url.toString(), expires_at: expiresAt });
  } catch (error) {
    console.error("SportHub link start failed", error);
    return jsonResponse({ error: "link_start_failed" }, 500);
  }
});
