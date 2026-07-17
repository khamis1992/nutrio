import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import {
  appRedirect,
  encryptSecret,
  getAdminClient,
  randomBase64Url,
  readLimitedJson,
  requireHttpsUrl,
  requireSportHubUrl,
  safeRedirectPath,
  sha256,
} from "../_shared/sporthub.ts";
import {
  enforceRateLimit,
  getClientIp,
  HttpError,
  recordSecurityEvent,
} from "../_shared/security.ts";

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  user_id?: string;
  sub?: string;
};

type ConsumedState = {
  user_id: string;
  code_verifier: string;
  redirect_path: string;
  expires_at: string;
};

function redirect(path: string, status: "failed", reason?: string) {
  const params: Record<string, string> = { sporthub_link: status };
  if (reason) params.reason = reason;
  return Response.redirect(appRedirect(safeRedirectPath(path), params), 303);
}

function redirectForAuthenticatedCompletion(path: string, completionToken: string) {
  const target = new URL(appRedirect(safeRedirectPath(path), {
    sporthub_link: "confirm",
  }));
  // The one-time token belongs in the fragment so it is not sent in HTTP
  // requests, access logs, or Referer headers during the app redirect.
  target.hash = new URLSearchParams({
    sporthub_completion: completionToken,
  }).toString();
  return Response.redirect(target.toString(), 303);
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { "Cache-Control": "no-store", Allow: "GET" },
    });
  }

  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code") || "";
  const state = requestUrl.searchParams.get("state") || "";
  const oauthError = requestUrl.searchParams.get("error");
  if (!/^[A-Za-z0-9_-]{40,128}$/.test(state)) {
    return redirect("/dashboard/activity", "failed", "invalid_state");
  }

  const admin = getAdminClient();
  const stateHash = await sha256(state);
  let consumedState: ConsumedState | null = null;

  try {
    await enforceRateLimit(
      req,
      "sporthub-oauth-callback",
      getClientIp(req) || stateHash,
      30,
      10 * 60,
    );

    const { data, error: consumeError } = await admin.rpc(
      "consume_partner_oauth_state",
      { p_state_hash: stateHash, p_partner: "sporthub" },
    );
    consumedState = (Array.isArray(data) ? data[0] : null) as ConsumedState | null;
    if (consumeError || !consumedState) {
      await recordSecurityEvent(req, {
        eventType: "integration.sporthub.oauth_state_rejected",
        category: "authorization",
        severity: "high",
        outcome: "denied",
        actorType: "anonymous",
        action: "consume_oauth_state",
        resourceType: "public.partner_oauth_states",
        resourceId: "sporthub",
      });
      return redirect("/dashboard/activity", "failed", "invalid_state");
    }

    const oauthState = consumedState;
    const redirectPath = safeRedirectPath(oauthState.redirect_path);
    if (oauthError || !code || code.length > 4096) {
      await admin.from("partner_integrations").update({
        consent_status: "failed",
        updated_at: new Date().toISOString(),
        metadata: { oauth_error: oauthError ? "provider_denied" : "missing_code" },
      }).eq("user_id", oauthState.user_id).eq("partner", "sporthub");
      return redirect(redirectPath, "failed", oauthError ? "permission_denied" : "missing_code");
    }

    const tokenUrl = requireSportHubUrl(Deno.env.get("SPORTHUB_TOKEN_URL"), "SPORTHUB_TOKEN_URL");
    const redirectUri = requireHttpsUrl(
      Deno.env.get("SPORTHUB_REDIRECT_URI"),
      "SPORTHUB_REDIRECT_URI",
    );
    const clientId = (Deno.env.get("SPORTHUB_CLIENT_ID") || "").trim();
    const clientSecret = (Deno.env.get("SPORTHUB_CLIENT_SECRET") || "").trim();
    if (!clientId || !clientSecret || clientId.length > 512 || clientSecret.length > 4096) {
      throw new HttpError(503, "sporthub_oauth_not_configured");
    }

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(12_000),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri.toString(),
        code_verifier: oauthState.code_verifier || "",
      }),
    });
    if (!tokenResponse.ok) {
      console.error("SportHub token exchange rejected", { status: tokenResponse.status });
      throw new HttpError(502, "sporthub_token_exchange_failed");
    }

    const tokens = await readLimitedJson<TokenResponse>(tokenResponse, 64 * 1024);
    if (
      typeof tokens.access_token !== "string"
      || tokens.access_token.length < 16
      || tokens.access_token.length > 16_384
      || (tokens.refresh_token && tokens.refresh_token.length > 16_384)
    ) {
      throw new HttpError(502, "sporthub_token_response_invalid");
    }

    if (tokens.scope) {
      const scopes = new Set(tokens.scope.split(/[\s,]+/).filter(Boolean));
      if (!scopes.has("activities.read")) {
        throw new HttpError(403, "sporthub_required_scope_missing");
      }
    }

    let externalUserId = String(tokens.user_id || tokens.sub || "").trim();
    const configuredUserInfo = Deno.env.get("SPORTHUB_USERINFO_URL");
    if (!externalUserId && configuredUserInfo) {
      const userInfoUrl = requireSportHubUrl(configuredUserInfo, "SPORTHUB_USERINFO_URL");
      const response = await fetch(userInfoUrl, {
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          Accept: "application/json",
        },
      });
      if (response.ok) {
        const profile = await readLimitedJson<{ id?: string; user_id?: string; sub?: string }>(
          response,
          64 * 1024,
        );
        externalUserId = String(profile.id || profile.user_id || profile.sub || "").trim();
      }
    }
    if (
      !/^[A-Za-z0-9][A-Za-z0-9._~:-]{0,199}$/.test(externalUserId)
    ) {
      throw new HttpError(502, "sporthub_external_identity_missing");
    }

    const pendingId = crypto.randomUUID();
    const completionToken = randomBase64Url(32);
    const completionHash = await sha256(completionToken);
    const now = new Date().toISOString();
    const accessTokenEncrypted = await encryptSecret(
      tokens.access_token,
      `sporthub:${pendingId}:access`,
    );
    const refreshTokenEncrypted = tokens.refresh_token
      ? await encryptSecret(
        tokens.refresh_token,
        `sporthub:${pendingId}:refresh`,
      )
      : null;
    const expiresIn = Number(tokens.expires_in);
    const expiresAt = Number.isFinite(expiresIn) && expiresIn > 0
      ? new Date(Date.now() + Math.min(Math.max(expiresIn - 60, 60), 30 * 86400) * 1000)
        .toISOString()
      : null;

    const { error: pendingError } = await admin
      .from("partner_oauth_pending_links")
      .insert({
        id: pendingId,
        handle_hash: completionHash,
        user_id: oauthState.user_id,
        partner: "sporthub",
        external_user_id: externalUserId,
        access_token_encrypted: accessTokenEncrypted,
        refresh_token_encrypted: refreshTokenEncrypted,
        scope: tokens.scope?.slice(0, 1000) || null,
        token_expires_at: expiresAt,
        redirect_path: redirectPath,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
    if (pendingError) throw pendingError;

    await recordSecurityEvent(req, {
      eventType: "integration.sporthub.link_confirmation_required",
      category: "authorization",
      severity: "info",
      outcome: "success",
      actorUserId: oauthState.user_id,
      actorType: "user",
      action: "stage_oauth_link",
      resourceType: "public.partner_oauth_pending_links",
      resourceId: pendingId,
      metadata: { token_expires_at: expiresAt, scope_present: Boolean(tokens.scope) },
    });

    return redirectForAuthenticatedCompletion(redirectPath, completionToken);
  } catch (error) {
    const failureCode = error instanceof HttpError ? error.code : "callback_failed";
    console.error("SportHub OAuth callback failed", {
      code: failureCode,
    });
    if (consumedState) {
      await admin.from("partner_integrations").update({
        consent_status: "failed",
        updated_at: new Date().toISOString(),
        metadata: { oauth_error: failureCode },
      }).eq("user_id", consumedState.user_id).eq("partner", "sporthub");
      await recordSecurityEvent(req, {
        eventType: "integration.sporthub.link_failed",
        category: "authorization",
        severity: "medium",
        outcome: "failure",
        actorUserId: consumedState.user_id,
        actorType: "user",
        action: "complete_oauth_link",
        resourceType: "public.partner_integrations",
        resourceId: "sporthub",
        metadata: { error_code: failureCode },
      });
    }
    return redirect(
      consumedState?.redirect_path || "/dashboard/activity",
      "failed",
      "callback_failed",
    );
  }
});
