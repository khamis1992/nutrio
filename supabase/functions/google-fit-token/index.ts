import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { saveGoogleFitCredentials } from "../_shared/googleFit.ts";
import {
  authenticateRequest,
  enforceRateLimit,
  errorResponse,
  getServiceClient,
  handlePreflight,
  HttpError,
  jsonResponse,
  readJsonBody,
  recordSecurityEvent,
  requirePost,
} from "../_shared/security.ts";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

function allowedRedirectUris(): Set<string> {
  const configured = (Deno.env.get("GOOGLE_FIT_REDIRECT_URIS") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set([
    "http://localhost:5173/auth/google-fit/callback",
    "http://localhost:5173/nutrio/auth/google-fit/callback",
    "https://nutrio.me/nutrio/auth/google-fit/callback",
    "https://www.nutrio.me/nutrio/auth/google-fit/callback",
    ...configured,
  ]);
}

serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    requirePost(req);
    const principal = await authenticateRequest(req);
    await enforceRateLimit(req, "google-fit-token", principal.user.id, 10, 60 * 60);

    const { code, codeVerifier, redirectUri } = await readJsonBody<{
      code?: unknown;
      codeVerifier?: unknown;
      redirectUri?: unknown;
    }>(req, 8 * 1024);

    if (typeof code !== "string" || code.length < 8 || code.length > 4096) {
      throw new HttpError(400, "invalid_authorization_code");
    }
    if (
      typeof codeVerifier !== "string" ||
      codeVerifier.length < 43 ||
      codeVerifier.length > 128 ||
      !/^[A-Za-z0-9._~-]+$/.test(codeVerifier)
    ) {
      throw new HttpError(400, "invalid_code_verifier");
    }
    if (typeof redirectUri !== "string" || !allowedRedirectUris().has(redirectUri)) {
      throw new HttpError(400, "invalid_redirect_uri");
    }

    const clientId = Deno.env.get("GOOGLE_FIT_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_FIT_CLIENT_SECRET");
    if (!clientId || !clientSecret) throw new HttpError(503, "google_fit_not_configured");

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      console.error("Google Fit token exchange rejected with status", response.status);
      await recordSecurityEvent(req, {
        eventType: "integration.google_fit_connection_failed",
        category: "authorization",
        severity: "medium",
        outcome: "failure",
        principal,
        action: "connect_google_fit",
        resourceType: "integration",
        resourceId: "google_fit",
        metadata: { provider_status: response.status },
      });
      throw new HttpError(502, "google_fit_exchange_failed");
    }

    const data = await response.json() as Record<string, unknown>;
    const accessToken = typeof data.access_token === "string" ? data.access_token : "";
    const refreshToken = typeof data.refresh_token === "string" ? data.refresh_token : null;
    const expiresIn = Number(data.expires_in || 0);
    if (!accessToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
      throw new HttpError(502, "google_fit_invalid_response");
    }

    const expiresAt = Math.floor(Date.now() / 1000) + Math.floor(expiresIn);
    await saveGoogleFitCredentials(
      getServiceClient(),
      principal.user.id,
      { accessToken, refreshToken, expiresAt },
      typeof data.scope === "string" ? data.scope : null,
    );

    await recordSecurityEvent(req, {
      eventType: "integration.google_fit_connected",
      category: "authorization",
      severity: "info",
      outcome: "success",
      principal,
      action: "connect_google_fit",
      resourceType: "integration",
      resourceId: "google_fit",
      metadata: { expires_at: expiresAt },
    });

    return jsonResponse(req, { success: true, expires_at: expiresAt });
  } catch (error) {
    return errorResponse(req, error);
  }
});
