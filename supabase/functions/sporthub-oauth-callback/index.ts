import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import {
  appRedirect,
  encryptSecret,
  getAdminClient,
  sha256,
} from "../_shared/sporthub.ts";

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  user_id?: string;
  sub?: string;
};

function redirect(path: string, status: string, reason?: string) {
  const params: Record<string, string> = { sporthub_link: status };
  if (reason) params.reason = reason;
  return Response.redirect(appRedirect(path, params), 302);
}

serve(async (req) => {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const oauthError = requestUrl.searchParams.get("error");
  if (!state) return redirect("/dashboard/activity", "failed", "missing_state");

  const admin = getAdminClient();
  const stateHash = await sha256(state);
  const { data: oauthState, error: stateError } = await admin
    .from("partner_oauth_states")
    .select("state_hash,user_id,code_verifier,redirect_path,expires_at,consumed_at")
    .eq("state_hash", stateHash)
    .eq("partner", "sporthub")
    .maybeSingle();

  if (stateError || !oauthState || oauthState.consumed_at || new Date(oauthState.expires_at) <= new Date()) {
    return redirect("/dashboard/activity", "failed", "invalid_state");
  }

  await admin.from("partner_oauth_states").update({ consumed_at: new Date().toISOString() }).eq("state_hash", stateHash);
  const redirectPath = oauthState.redirect_path || "/dashboard/activity";

  if (oauthError || !code) {
    await admin.from("partner_integrations").update({
      consent_status: "failed",
      updated_at: new Date().toISOString(),
      metadata: { oauth_error: oauthError || "missing_code" },
    }).eq("user_id", oauthState.user_id).eq("partner", "sporthub");
    return redirect(redirectPath, "failed", oauthError || "missing_code");
  }

  try {
    const tokenUrl = Deno.env.get("SPORTHUB_TOKEN_URL");
    const clientId = Deno.env.get("SPORTHUB_CLIENT_ID");
    const clientSecret = Deno.env.get("SPORTHUB_CLIENT_SECRET");
    const redirectUri = Deno.env.get("SPORTHUB_REDIRECT_URI");
    if (!tokenUrl || !clientId || !clientSecret || !redirectUri) throw new Error("OAuth environment missing");

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code_verifier: oauthState.code_verifier || "",
      }),
    });
    if (!tokenResponse.ok) throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    const tokens = await tokenResponse.json() as TokenResponse;
    if (!tokens.access_token) throw new Error("Token response has no access_token");

    let externalUserId = tokens.user_id || tokens.sub || null;
    const userInfoUrl = Deno.env.get("SPORTHUB_USERINFO_URL");
    if (!externalUserId && userInfoUrl) {
      const response = await fetch(userInfoUrl, {
        headers: { Authorization: `${tokens.token_type || "Bearer"} ${tokens.access_token}`, Accept: "application/json" },
      });
      if (response.ok) {
        const profile = await response.json() as { id?: string; user_id?: string; sub?: string };
        externalUserId = profile.id || profile.user_id || profile.sub || null;
      }
    }
    if (!externalUserId) throw new Error("SportHub external user ID is missing");

    const now = new Date().toISOString();
    const { data: integration, error: integrationError } = await admin.from("partner_integrations").upsert({
      user_id: oauthState.user_id,
      partner: "sporthub",
      external_user_id: externalUserId,
      consent_status: "linked",
      linked_at: now,
      unlinked_at: null,
      last_synced_at: now,
      metadata: { scope: tokens.scope || null, oauth_version: "2.0-pkce" },
      updated_at: now,
    }, { onConflict: "user_id,partner" }).select("id").single();
    if (integrationError || !integration) throw integrationError || new Error("Integration was not saved");

    const accessTokenEncrypted = await encryptSecret(tokens.access_token);
    const refreshTokenEncrypted = tokens.refresh_token ? await encryptSecret(tokens.refresh_token) : null;
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + Math.max(0, tokens.expires_in - 60) * 1000).toISOString()
      : null;

    const { error: credentialError } = await admin.from("partner_credentials").upsert({
      integration_id: integration.id,
      access_token_encrypted: accessTokenEncrypted,
      refresh_token_encrypted: refreshTokenEncrypted,
      token_type: tokens.token_type || "Bearer",
      scope: tokens.scope || null,
      expires_at: expiresAt,
      updated_at: now,
    });
    if (credentialError) throw credentialError;

    await admin.from("partner_events").insert({
      user_id: oauthState.user_id,
      partner: "sporthub",
      event_type: "sporthub.account.linked",
      payload: { external_user_id: externalUserId },
    });

    return redirect(redirectPath, "linked");
  } catch (error) {
    console.error("SportHub OAuth callback failed", error);
    await admin.from("partner_integrations").update({
      consent_status: "failed",
      updated_at: new Date().toISOString(),
      metadata: { oauth_error: error instanceof Error ? error.message : "callback_failed" },
    }).eq("user_id", oauthState.user_id).eq("partner", "sporthub");
    return redirect(redirectPath, "failed", "callback_failed");
  }
});
