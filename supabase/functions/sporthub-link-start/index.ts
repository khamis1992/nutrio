import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import {
  getAdminClient,
  randomBase64Url,
  requireHttpsUrl,
  requireSportHubUrl,
  safeRedirectPath,
  sha256,
} from "../_shared/sporthub.ts";
import {
  authenticateRequest,
  enforceRateLimit,
  errorResponse,
  handlePreflight,
  jsonResponse,
  readJsonBody,
  recordSecurityEvent,
  requirePost,
} from "../_shared/security.ts";

serve(async (req: Request): Promise<Response> => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    requirePost(req);
    const principal = await authenticateRequest(req);
    await enforceRateLimit(req, "sporthub-link-start", principal.user.id, 5, 10 * 60);

    const body = await readJsonBody<{ redirect_path?: string }>(req, 2 * 1024);
    const redirectPath = safeRedirectPath(body.redirect_path);
    const authorizationUrl = requireSportHubUrl(
      Deno.env.get("SPORTHUB_AUTHORIZATION_URL"),
      "SPORTHUB_AUTHORIZATION_URL",
    );
    const redirectUri = requireHttpsUrl(
      Deno.env.get("SPORTHUB_REDIRECT_URI"),
      "SPORTHUB_REDIRECT_URI",
    );
    const clientId = (Deno.env.get("SPORTHUB_CLIENT_ID") || "").trim();
    if (!clientId || clientId.length > 512) {
      throw new Error("SPORTHUB_CLIENT_ID is invalid");
    }

    const state = randomBase64Url(32);
    const codeVerifier = randomBase64Url(48);
    const [stateHash, codeChallenge] = await Promise.all([
      sha256(state),
      sha256(codeVerifier),
    ]);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const admin = getAdminClient();

    await admin
      .from("partner_oauth_states")
      .delete()
      .eq("user_id", principal.user.id)
      .eq("partner", "sporthub")
      .or(`expires_at.lt.${new Date().toISOString()},consumed_at.not.is.null`);

    const { count, error: countError } = await admin
      .from("partner_oauth_states")
      .select("state_hash", { head: true, count: "exact" })
      .eq("user_id", principal.user.id)
      .eq("partner", "sporthub")
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString());
    if (countError) throw countError;
    if ((count || 0) >= 3) {
      return jsonResponse(req, { error: "link_already_pending" }, 409);
    }

    const { error: stateError } = await admin.from("partner_oauth_states").insert({
      state_hash: stateHash,
      user_id: principal.user.id,
      partner: "sporthub",
      code_verifier: codeVerifier,
      redirect_path: redirectPath,
      expires_at: expiresAt,
    });
    if (stateError) throw stateError;

    const { error: integrationError } = await admin.from("partner_integrations").upsert({
      user_id: principal.user.id,
      partner: "sporthub",
      consent_status: "pending",
      metadata: {
        requested_at: new Date().toISOString(),
        requested_scope: ["openid", "profile", "bookings.read", "activities.read"],
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,partner" });
    if (integrationError) throw integrationError;

    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("client_id", clientId);
    authorizationUrl.searchParams.set("redirect_uri", redirectUri.toString());
    authorizationUrl.searchParams.set("scope", "openid profile bookings.read activities.read");
    authorizationUrl.searchParams.set("state", state);
    authorizationUrl.searchParams.set("code_challenge", codeChallenge);
    authorizationUrl.searchParams.set("code_challenge_method", "S256");

    await recordSecurityEvent(req, {
      eventType: "integration.sporthub.link_started",
      category: "authorization",
      severity: "info",
      outcome: "success",
      principal,
      action: "start_oauth_link",
      resourceType: "public.partner_integrations",
      resourceId: "sporthub",
      metadata: { expires_at: expiresAt, redirect_path: redirectPath },
    });

    return jsonResponse(req, {
      authorization_url: authorizationUrl.toString(),
      expires_at: expiresAt,
    });
  } catch (error) {
    console.error("SportHub link start failed", {
      code: error instanceof Error ? error.name : "unknown",
    });
    return errorResponse(req, error);
  }
});
