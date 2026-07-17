import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

import { lookupIpGeo, normalizeIpAddress } from "../_shared/ipGeo.ts";
import { checkRateLimit } from "../_shared/rateLimiter.ts";
import {
  hashProvisioningToken,
  type SignupProvisioningKind,
} from "../_shared/signupProvisioning.ts";
import {
  enforceRateLimit,
  getClientIp,
  getServiceClient,
  HttpError,
  jsonResponse,
  readTextBody,
  recordSecurityEvent,
  requirePost,
  safeErrorDetails,
} from "../_shared/security.ts";

const ALLOWED_COUNTRY = "QA";
const MAX_BODY_BYTES = 32 * 1024;

interface BeforeUserCreatedEvent {
  metadata?: {
    uuid?: unknown;
    name?: unknown;
    ip_address?: unknown;
  };
  user?: {
    id?: unknown;
    email?: unknown;
    app_metadata?: unknown;
    user_metadata?: unknown;
  };
}

interface SignupEventInput {
  eventType: string;
  severity: "info" | "medium" | "high";
  outcome: "success" | "failure" | "blocked" | "denied";
  action: string;
  requestId: string | null;
  sourceIp: string | null;
  countryCode?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
}

function hookResponse(req: Request, status: number, message: string): Response {
  return jsonResponse(req, {
    error: { http_code: status, message },
  }, status);
}

function getHookSecret(): string {
  const configured = Deno.env.get("AUTH_BEFORE_USER_CREATED_HOOK_SECRET")?.trim();
  if (!configured) throw new HttpError(503, "auth_hook_not_configured");
  const secret = configured.replace(/^v1,whsec_/, "").replace(/^whsec_/, "");
  if (secret.length < 16) throw new HttpError(503, "auth_hook_not_configured");
  return secret;
}

async function readRawBody(req: Request): Promise<string> {
  return await readTextBody(req, MAX_BODY_BYTES, ["application/json"]);
}

function getProvider(event: BeforeUserCreatedEvent): string | null {
  const metadata = event.user?.app_metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const provider = (metadata as Record<string, unknown>).provider;
  return typeof provider === "string" ? provider.slice(0, 80) : null;
}

function getProvisioningMetadata(event: BeforeUserCreatedEvent): {
  token: string | null;
  kind: SignupProvisioningKind | null;
  attempted: boolean;
} {
  const metadata = event.user?.user_metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return { token: null, kind: null, attempted: false };
  }
  const values = metadata as Record<string, unknown>;
  const rawToken = values.nutrio_provisioning_token;
  const rawKind = values.nutrio_provisioning_kind;
  const attempted = rawToken !== undefined || rawKind !== undefined;
  const token = typeof rawToken === "string" && /^[A-Za-z0-9_-]{43}$/.test(rawToken)
    ? rawToken
    : null;
  const kind = rawKind === "partner_invitation" ||
      rawKind === "fleet_driver_invitation" ||
      rawKind === "fleet_manager_invitation"
    ? rawKind
    : null;
  return { token, kind, attempted };
}

async function recordSignupEvent(input: SignupEventInput): Promise<void> {
  try {
    const service = getServiceClient();
    const { error } = await service.rpc("record_security_event", {
      p_event_type: input.eventType,
      p_category: "authentication",
      p_severity: input.severity,
      p_source: "auth",
      p_outcome: input.outcome,
      p_actor_user_id: null,
      p_actor_role: null,
      p_actor_type: "anonymous",
      p_action: input.action,
      p_resource_type: "auth_user",
      p_resource_id: input.resourceId || null,
      p_request_id: input.requestId,
      p_correlation_id: null,
      p_session_fingerprint: null,
      p_ip_address: input.sourceIp,
      p_country_code: input.countryCode || null,
      p_user_agent: null,
      p_metadata: input.metadata || {},
    });
    if (error) console.error("Signup security event write failed:", error.message);
  } catch (error) {
    console.error(
      "Signup security event capture unavailable",
      safeErrorDetails(error),
    );
  }
}

serve(async (req) => {
  try {
    requirePost(req);
    await enforceRateLimit(
      req,
      "auth-hook-signature",
      getClientIp(req) || "unknown",
      60,
      3600,
    );

    const rawBody = await readRawBody(req);
    let event: BeforeUserCreatedEvent;
    try {
      const webhook = new Webhook(getHookSecret());
      event = webhook.verify(rawBody, Object.fromEntries(req.headers)) as BeforeUserCreatedEvent;
    } catch (error) {
      console.error("Before-user-created signature verification failed");
      await recordSecurityEvent(req, {
        eventType: "authentication.supabase.auth_hook_signature_rejected",
        category: "authentication",
        severity: "high",
        source: "auth",
        outcome: "denied",
        actorType: "anonymous",
        action: "verify_before_user_created_hook",
      });
      return hookResponse(req, 401, "Invalid authentication hook signature.");
    }

    const requestId = typeof event.metadata?.uuid === "string"
      ? event.metadata.uuid.slice(0, 160)
      : null;
    const resourceId = typeof event.user?.id === "string"
      ? event.user.id.slice(0, 160)
      : null;
    const provider = getProvider(event);
    const sourceIp = normalizeIpAddress(event.metadata?.ip_address);

    if (event.metadata?.name !== "before-user-created" || !sourceIp) {
      await recordSignupEvent({
        eventType: "authentication.supabase.signup_geo_verification_failed",
        severity: "high",
        outcome: "failure",
        action: "validate_signup_origin",
        requestId,
        sourceIp,
        resourceId,
        metadata: { reason: "invalid_hook_payload", provider },
      });
      return hookResponse(req, 400, "Unable to verify registration location.");
    }

    const service = getServiceClient();
    const provisioning = getProvisioningMetadata(event);
    if (provisioning.attempted) {
      const email = typeof event.user?.email === "string"
        ? event.user.email.trim().toLowerCase()
        : "";
      let consumed = false;
      if (provisioning.token && provisioning.kind && email) {
        const tokenHash = await hashProvisioningToken(provisioning.token);
        const { data, error } = await service.rpc(
          "consume_signup_provisioning_grant",
          {
            p_token_hash: tokenHash,
            p_email: email,
            p_kind: provisioning.kind,
            p_request_id: requestId,
            p_ip_address: sourceIp,
          },
        );
        if (error) throw error;
        consumed = data === true;
      }

      if (!consumed) {
        await recordSignupEvent({
          eventType: "authentication.supabase.trusted_provisioning_denied",
          severity: "high",
          outcome: "denied",
          action: "consume_signup_provisioning_grant",
          requestId,
          sourceIp,
          resourceId,
          metadata: { kind: provisioning.kind, provider },
        });
        return hookResponse(req, 403, "This account invitation is invalid or expired.");
      }

      await recordSignupEvent({
        eventType: "authentication.supabase.trusted_provisioning_allowed",
        severity: "high",
        outcome: "success",
        action: "create_invited_auth_user",
        requestId,
        sourceIp,
        resourceId,
        metadata: { kind: provisioning.kind, provider },
      });
      return jsonResponse(req, {});
    }

    const rateLimit = await checkRateLimit(
      service,
      `auth-signup-geo:${sourceIp}`,
      8,
      3600,
    );
    if (!rateLimit.allowed) {
      await recordSignupEvent({
        eventType: "authentication.supabase.signup_rate_limited",
        severity: "medium",
        outcome: "blocked",
        action: "create_auth_user",
        requestId,
        sourceIp,
        resourceId,
        metadata: { provider },
      });
      return hookResponse(req, 429, "Too many registration attempts. Please try again later.");
    }

    const { data: blocked, error: blockedError } = await service.rpc(
      "is_ip_blocked",
      { p_ip: sourceIp },
    );
    if (blockedError) throw blockedError;
    if (blocked === true) {
      await recordSignupEvent({
        eventType: "authentication.supabase.signup_blocked_ip",
        severity: "high",
        outcome: "blocked",
        action: "create_auth_user",
        requestId,
        sourceIp,
        resourceId,
        metadata: { provider },
      });
      return hookResponse(req, 403, "Registration is not available from this network.");
    }

    let geo;
    try {
      geo = await lookupIpGeo(sourceIp);
    } catch (error) {
      console.error("Signup geolocation lookup failed");
      await recordSignupEvent({
        eventType: "authentication.supabase.signup_geo_verification_failed",
        severity: "high",
        outcome: "failure",
        action: "validate_signup_origin",
        requestId,
        sourceIp,
        resourceId,
        metadata: { reason: "provider_unavailable", provider },
      });
      return hookResponse(req, 503, "Registration location could not be verified. Please try again.");
    }

    if (geo.countryCode !== ALLOWED_COUNTRY) {
      await recordSignupEvent({
        eventType: "authentication.supabase.signup_geo_denied",
        severity: "high",
        outcome: "denied",
        action: "create_auth_user",
        requestId,
        sourceIp,
        countryCode: geo.countryCode,
        resourceId,
        metadata: { provider },
      });
      return hookResponse(req, 403, "Nutrio registration is currently available in Qatar only.");
    }

    await recordSignupEvent({
      eventType: "authentication.supabase.signup_geo_allowed",
      severity: "info",
      outcome: "success",
      action: "create_auth_user",
      requestId,
      sourceIp,
      countryCode: geo.countryCode,
      resourceId,
      metadata: { provider },
    });
    return jsonResponse(req, {});
  } catch (error) {
    console.error("Before-user-created hook failed:", error);
    const status = error instanceof HttpError ? error.status : 503;
    const message = status === 429
      ? "Too many registration attempts. Please try again later."
      : "Registration security verification is temporarily unavailable.";
    return hookResponse(req, status, message);
  }
});
