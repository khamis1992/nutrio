import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  authenticateRequest,
  enforceRateLimit,
  errorResponse,
  getServiceClient,
  hasAdminAssurance,
  handlePreflight,
  HttpError,
  jsonResponse,
  readBoundedResponseJson,
  readJsonBody,
  recordSecurityEvent,
  requireInternalSecret,
  requirePost,
  type SecurityPrincipal,
} from "../_shared/security.ts";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;
const ULTRAMSG_RESPONSE_LIMIT = 16 * 1024;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type WhatsAppPreference = "order_updates" | "delivery_updates" | "support";

interface WhatsAppRequest {
  to: string;
  body: string;
  user_id?: string;
  preference?: WhatsAppPreference;
  idempotency_key?: string;
  idempotencyKey?: string;
}

interface DeliveryClaim {
  claimed: boolean;
  state: string;
  claim_token?: string;
  provider_message_id?: string;
}

function normalizePhone(value: unknown): string {
  const input = String(value ?? "").trim();
  if (!input || !/^[+0-9()\s-]+$/.test(input)) {
    throw new HttpError(400, "invalid_phone_number");
  }
  let phone = input.replace(/\D/g, "");
  if (phone.startsWith("00")) phone = phone.slice(2);
  if (phone.length === 8) phone = `974${phone}`;
  if (phone.length < 8 || phone.length > 15) {
    throw new HttpError(400, "invalid_phone_number");
  }
  return phone;
}

function validateIdempotencyKey(body: WhatsAppRequest): string | null {
  const key = body.idempotency_key ?? body.idempotencyKey;
  if (key === undefined) return null;
  const normalized = String(key).trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(normalized)) {
    throw new HttpError(400, "invalid_idempotency_key");
  }
  return normalized;
}

function validatePreference(value: unknown): WhatsAppPreference {
  const preference = String(value ?? "order_updates").trim();
  if (
    preference !== "order_updates" && preference !== "delivery_updates" &&
    preference !== "support"
  ) {
    throw new HttpError(400, "invalid_whatsapp_preference");
  }
  return preference;
}

function readWhatsAppPreference(
  value: unknown,
  preference: WhatsAppPreference,
): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return true;
  const whatsapp = (value as Record<string, unknown>).whatsapp;
  if (!whatsapp || typeof whatsapp !== "object" || Array.isArray(whatsapp)) {
    return true;
  }
  const setting = (whatsapp as Record<string, unknown>)[preference];
  if (setting === false) return false;
  const normalized = String(setting ?? "true").trim().toLowerCase();
  return !["false", "0", "off", "no"].includes(normalized);
}

function parseUltraMsgMessageId(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const providerError = data.error;
  const hasProviderError = providerError !== undefined &&
    providerError !== null && providerError !== false &&
    String(providerError).trim() !== "";
  const rawId = data.id ?? data.messageId;
  if (
    (data.sent !== true && data.sent !== "true") || hasProviderError ||
    (typeof rawId !== "string" && typeof rawId !== "number")
  ) {
    return null;
  }
  const messageId = String(rawId).trim();
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,249}$/.test(messageId)
    ? messageId
    : null;
}

async function getUserWhatsAppPolicy(
  userId: string,
  preference: WhatsAppPreference,
): Promise<{ phone: string; enabled: boolean }> {
  const service = getServiceClient();
  const [authResult, profileResult] = await Promise.all([
    service.auth.admin.getUserById(userId),
    service.from("profiles").select("notification_preferences").eq(
      "user_id",
      userId,
    ).maybeSingle(),
  ]);
  if (authResult.error || profileResult.error) {
    console.error("WhatsApp recipient policy lookup failed", {
      authStatus: authResult.error?.status,
      profileCode: profileResult.error?.code,
    });
    throw new HttpError(503, "notification_recipient_unavailable");
  }
  const authUser = authResult.data.user;
  if (!authUser?.phone || !authUser.phone_confirmed_at) {
    throw new HttpError(422, "verified_phone_required");
  }
  return {
    phone: normalizePhone(authUser.phone),
    enabled: readWhatsAppPreference(
      profileResult.data?.notification_preferences,
      preference,
    ),
  };
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function claimDelivery(
  idempotencyKey: string,
  payloadHash: string,
): Promise<DeliveryClaim> {
  const service = getServiceClient();
  const { data, error } = await service.rpc("claim_notification_delivery", {
    p_channel: "whatsapp",
    p_idempotency_key: idempotencyKey,
    p_payload_hash: payloadHash,
    p_lease_seconds: 90,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    console.error("WhatsApp delivery claim unavailable", { code: error?.code });
    throw new HttpError(503, "delivery_claim_unavailable");
  }
  return data as DeliveryClaim;
}

async function completeDelivery(
  idempotencyKey: string,
  claimToken: string,
  succeeded: boolean,
  providerMessageId: string | null,
  errorCode: string | null,
): Promise<void> {
  const service = getServiceClient();
  const { data, error } = await service.rpc("complete_notification_delivery", {
    p_channel: "whatsapp",
    p_idempotency_key: idempotencyKey,
    p_claim_token: claimToken,
    p_succeeded: succeeded,
    p_provider_message_id: providerMessageId,
    p_error_code: errorCode,
  });
  if (error || data !== true) {
    console.error("WhatsApp delivery claim completion failed", {
      code: error?.code,
    });
  }
}

serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  let principal: SecurityPrincipal | null = null;
  let internalRequest = false;

  try {
    requirePost(req);
    if (req.headers.has("x-internal-secret")) {
      await requireInternalSecret(req);
      internalRequest = true;
    } else {
      principal = await authenticateRequest(req);
    }
    const hasAdminAccess = hasAdminAssurance(principal);

    const requestBody = await readJsonBody<WhatsAppRequest>(req, 8 * 1024);
    const phone = normalizePhone(requestBody.to);
    const message = String(requestBody.body ?? "").trim();
    if (message.length < 1 || message.length > 2_000) {
      throw new HttpError(400, "invalid_message_body");
    }

    const preference = validatePreference(requestBody.preference);
    const requestedUserId = requestBody.user_id === undefined
      ? null
      : String(requestBody.user_id).trim();
    if (requestedUserId && !UUID_PATTERN.test(requestedUserId)) {
      throw new HttpError(400, "invalid_recipient_user_id");
    }

    let policyUserId: string | null = null;
    if (internalRequest) {
      if (!requestedUserId) {
        throw new HttpError(400, "recipient_user_id_required");
      }
      policyUserId = requestedUserId;
    } else if (!hasAdminAccess) {
      if (!principal) throw new HttpError(401, "authentication_required");
      if (requestedUserId && requestedUserId !== principal.user.id) {
        throw new HttpError(403, "recipient_not_authorized");
      }
      policyUserId = principal.user.id;
    } else {
      if (!principal) throw new HttpError(401, "authentication_required");
      policyUserId = requestedUserId || principal.user.id;
    }

    if (policyUserId) {
      const policy = await getUserWhatsAppPolicy(policyUserId, preference);
      if (policy.phone !== phone) {
        await recordSecurityEvent(req, {
          eventType: "authorization.whatsapp_recipient_denied",
          category: "authorization",
          severity: "high",
          outcome: "denied",
          principal,
          action: "send_whatsapp",
          resourceType: "auth.user",
          resourceId: policyUserId,
        });
        throw new HttpError(403, "recipient_not_authorized");
      }
      if (!policy.enabled) {
        await recordSecurityEvent(req, {
          eventType: "notification.whatsapp_suppressed",
          category: "edge_function",
          outcome: "success",
          principal,
          actorType: internalRequest ? "service" : undefined,
          action: "suppress_whatsapp",
          resourceType: "auth.user",
          resourceId: policyUserId,
          metadata: { reason: "channel_disabled", preference },
        });
        return jsonResponse(req, {
          success: true,
          suppressed: true,
          reason: "channel_disabled",
        });
      }
    }

    const targetHash = await sha256Hex(phone);
    await enforceRateLimit(
      req,
      "send-whatsapp",
      principal?.user.id || `internal:${targetHash.slice(0, 24)}`,
      hasAdminAccess ? 120 : internalRequest ? 30 : 5,
      60 * 60,
    );

    const idempotencyKey = validateIdempotencyKey(requestBody);
    const payloadHash = await sha256Hex(JSON.stringify({
      phone,
      message,
      policyUserId,
      preference,
    }));
    let claimToken: string | null = null;

    if (idempotencyKey) {
      const claim = await claimDelivery(idempotencyKey, payloadHash);
      if (claim.state === "completed") {
        await recordSecurityEvent(req, {
          eventType: "notification.whatsapp_deduplicated",
          category: "edge_function",
          outcome: "success",
          principal,
          actorType: internalRequest ? "service" : undefined,
          action: "send_whatsapp",
          resourceType: "notification.whatsapp",
        });
        return jsonResponse(req, {
          success: true,
          messageId: claim.provider_message_id,
          duplicate: true,
        });
      }
      if (!claim.claimed || !claim.claim_token) {
        let code = "delivery_in_progress";
        if (claim.state === "conflict") code = "idempotency_conflict";
        if (claim.state === "exhausted") code = "delivery_retry_exhausted";
        throw new HttpError(409, code);
      }
      claimToken = claim.claim_token;
    }

    const instanceId = Deno.env.get("ULTRAMSG_INSTANCE_ID") || "";
    const apiToken = Deno.env.get("ULTRAMSG_API_TOKEN") || "";
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(instanceId) || !apiToken) {
      if (idempotencyKey && claimToken) {
        await completeDelivery(
          idempotencyKey,
          claimToken,
          false,
          null,
          "provider_not_configured",
        );
      }
      throw new HttpError(503, "whatsapp_service_unavailable");
    }

    let response: Response;
    try {
      response = await fetch(
        `https://api.ultramsg.com/${instanceId}/messages/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: apiToken, to: phone, body: message }),
          signal: AbortSignal.timeout(12_000),
        },
      );
    } catch (error) {
      console.error("Ultramsg request failed", {
        name: error instanceof Error ? error.name : "unknown",
      });
      if (idempotencyKey && claimToken) {
        await completeDelivery(
          idempotencyKey,
          claimToken,
          false,
          null,
          "provider_unreachable",
        );
      }
      throw new HttpError(502, "whatsapp_delivery_failed");
    }

    if (!response.ok) {
      console.error("Ultramsg rejected message", { status: response.status });
      if (idempotencyKey && claimToken) {
        await completeDelivery(
          idempotencyKey,
          claimToken,
          false,
          null,
          `provider_http_${response.status}`,
        );
      }
      throw new HttpError(502, "whatsapp_delivery_failed");
    }

    const providerData = await readBoundedResponseJson<unknown>(
      response,
      ULTRAMSG_RESPONSE_LIMIT,
    ).catch(() => null);
    const messageId = parseUltraMsgMessageId(providerData);
    if (!messageId) {
      if (idempotencyKey && claimToken) {
        await completeDelivery(
          idempotencyKey,
          claimToken,
          false,
          null,
          "provider_unverified_response",
        );
      }
      throw new HttpError(502, "whatsapp_delivery_unverified");
    }

    if (idempotencyKey && claimToken) {
      await completeDelivery(
        idempotencyKey,
        claimToken,
        true,
        messageId,
        null,
      );
    }

    await recordSecurityEvent(req, {
      eventType: "notification.whatsapp_sent",
      category: "edge_function",
      outcome: "success",
      principal,
      actorType: internalRequest ? "service" : undefined,
      action: "send_whatsapp",
      resourceType: "notification.whatsapp",
      metadata: { idempotent: Boolean(idempotencyKey) },
    });

    return jsonResponse(req, { success: true, messageId });
  } catch (error) {
    await recordSecurityEvent(req, {
      eventType: "notification.whatsapp_request_failed",
      category: "edge_function",
      severity: error instanceof HttpError && error.status < 500
        ? "medium"
        : "high",
      outcome: error instanceof HttpError && error.status === 403
        ? "denied"
        : "failure",
      principal,
      actorType: internalRequest ? "service" : undefined,
      action: "send_whatsapp",
      resourceType: "notification.whatsapp",
      metadata: {
        code: error instanceof HttpError ? error.code : "internal_error",
      },
    });
    return errorResponse(req, error);
  }
});
