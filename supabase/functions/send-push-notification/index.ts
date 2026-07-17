import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  enforceRateLimit,
  errorResponse,
  getServiceClient,
  hasAdminAssurance,
  handlePreflight,
  HttpError,
  jsonResponse,
  readJsonBody,
  recordSecurityEvent,
  requireInternalSecret,
  requirePost,
  requireSelfOrAdmin,
  type SecurityPrincipal,
} from "../_shared/security.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;
const ALLOWED_NOTIFICATION_TYPES = new Set([
  "meal_reminder",
  "plan_update",
  "health_insight",
  "system_alert",
  "delivery_update",
  "achievement",
  "subscription",
  "order_delivered",
  "meal_scheduled",
  "general",
  "subscription_alert",
  "order_update",
  "coach_message",
  "coach_withdrawal",
  "coach_onboarding",
  "coach_session_scheduled",
  "coach_milestone",
  "coach_goal_accepted",
]);

interface NotificationPayload {
  notification_id?: string;
  user_id: string;
  title: string;
  message: string;
  type?: string;
  data?: Record<string, unknown>;
  idempotency_key?: string;
  idempotencyKey?: string;
}

interface CanonicalNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  data: Record<string, unknown> | null;
}

interface DeliveryClaim {
  claimed: boolean;
  state: string;
  claim_token?: string;
  provider_message_id?: string;
}

interface FcmResult {
  success: boolean;
  invalidToken: boolean;
  providerStatus?: number;
  messageId?: string;
}

interface FcmMessage {
  message: {
    token: string;
    notification: { title: string; body: string };
    android: { notification: { click_action: string; channel_id: string } };
    apns: {
      payload: {
        aps: {
          alert: { title: string; body: string };
          badge: number;
          sound: string;
          "content-available": number;
        };
      };
      headers: Record<string, string>;
    };
    data?: Record<string, string>;
  };
}

function normalizeNotificationType(value: unknown): string {
  const type = String(value ?? "general").trim().toLowerCase();
  if (
    type === "subscription_expiry_warning" || type === "subscription_recovery"
  ) {
    return "subscription_alert";
  }
  if (!ALLOWED_NOTIFICATION_TYPES.has(type)) {
    throw new HttpError(400, "invalid_notification_type");
  }
  return type;
}

function normalizeData(value: unknown): Record<string, string> {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "invalid_notification_data");
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 20) {
    throw new HttpError(400, "invalid_notification_data");
  }

  const normalized: Record<string, string> = {};
  for (const [key, rawValue] of entries) {
    if (!/^[A-Za-z0-9_.-]{1,64}$/.test(key)) {
      throw new HttpError(400, "invalid_notification_data");
    }
    const stringValue = typeof rawValue === "string"
      ? rawValue
      : JSON.stringify(rawValue);
    if (!stringValue || stringValue.length > 1_024) {
      throw new HttpError(400, "invalid_notification_data");
    }
    normalized[key] = stringValue;
  }

  if (new TextEncoder().encode(JSON.stringify(normalized)).byteLength > 3_000) {
    throw new HttpError(413, "notification_data_too_large");
  }
  return normalized;
}

function getIdempotencyKey(payload: NotificationPayload): string | null {
  const raw = payload.notification_id
    ? `notification:${payload.notification_id}`
    : payload.idempotency_key ?? payload.idempotencyKey;
  if (raw === undefined) return null;
  const key = String(raw).trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new HttpError(400, "invalid_idempotency_key");
  }
  return key;
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
    p_channel: "push",
    p_idempotency_key: idempotencyKey,
    p_payload_hash: payloadHash,
    p_lease_seconds: 180,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    console.error("Push delivery claim unavailable", { code: error?.code });
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
    p_channel: "push",
    p_idempotency_key: idempotencyKey,
    p_claim_token: claimToken,
    p_succeeded: succeeded,
    p_provider_message_id: providerMessageId,
    p_error_code: errorCode,
  });
  if (error || data !== true) {
    console.error("Push delivery claim completion failed", {
      code: error?.code,
    });
  }
}

function base64UrlEncode(value: object): string {
  return btoa(JSON.stringify(value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function getGoogleAccessToken(
  serviceAccountJson: string,
): Promise<string> {
  let serviceAccount: Record<string, unknown>;
  try {
    serviceAccount = JSON.parse(serviceAccountJson) as Record<string, unknown>;
  } catch {
    throw new HttpError(503, "push_service_unavailable");
  }

  const clientEmail = String(serviceAccount.client_email ?? "");
  const privateKey = String(serviceAccount.private_key ?? "");
  if (!clientEmail.includes("@") || !privateKey.includes("BEGIN PRIVATE KEY")) {
    throw new HttpError(503, "push_service_unavailable");
  }

  const now = Math.floor(Date.now() / 1_000);
  const header = base64UrlEncode({ alg: "RS256", typ: "JWT" });
  const claim = base64UrlEncode({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3_600,
  });
  const signingInput = `${header}.${claim}`;

  try {
    const pemBody = privateKey
      .replace("-----BEGIN PRIVATE KEY-----", "")
      .replace("-----END PRIVATE KEY-----", "")
      .replace(/\s/g, "");
    const keyData = Uint8Array.from(
      atob(pemBody),
      (char) => char.charCodeAt(0),
    );
    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      keyData,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      new TextEncoder().encode(signingInput),
    );
    const signatureBase64 = btoa(
      String.fromCharCode(...new Uint8Array(signature)),
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${signingInput}.${signatureBase64}`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error("Google OAuth rejected FCM credentials", {
        status: response.status,
      });
      throw new HttpError(502, "push_provider_unavailable");
    }
    const data = await response.json().catch(() => ({})) as Record<
      string,
      unknown
    >;
    if (
      typeof data.access_token !== "string" || data.access_token.length < 20
    ) {
      throw new HttpError(502, "push_provider_unavailable");
    }
    return data.access_token;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error("Unable to create FCM access token", {
      name: error instanceof Error ? error.name : "unknown",
    });
    throw new HttpError(502, "push_provider_unavailable");
  }
}

async function sendFcmNotification(
  accessToken: string,
  projectId: string,
  fcmToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<FcmResult> {
  const message: FcmMessage = {
    message: {
      token: fcmToken,
      notification: { title, body },
      android: {
        notification: {
          channel_id: "default",
          click_action: "FLUTTER_NOTIFICATION_CLICK",
        },
      },
      apns: {
        payload: {
          aps: {
            alert: { title, body },
            badge: 1,
            sound: "default",
            "content-available": 1,
          },
        },
        headers: { "apns-priority": "10" },
      },
      ...(Object.keys(data).length > 0 ? { data } : {}),
    },
  };

  try {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
        signal: AbortSignal.timeout(10_000),
      },
    );
    const providerData = await response.json().catch(() => ({})) as Record<
      string,
      unknown
    >;
    if (!response.ok) {
      const providerError = providerData.error;
      const providerStatus = providerError && typeof providerError === "object"
        ? String((providerError as Record<string, unknown>).status ?? "")
        : "";
      return {
        success: false,
        invalidToken: providerStatus === "UNREGISTERED" ||
          providerStatus === "NOT_FOUND",
        providerStatus: response.status,
      };
    }
    return {
      success: true,
      invalidToken: false,
      messageId: typeof providerData.name === "string"
        ? providerData.name.slice(0, 250)
        : undefined,
    };
  } catch (error) {
    console.error("FCM request failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return { success: false, invalidToken: false };
  }
}

serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  let principal: SecurityPrincipal | null = null;
  let internalRequest = false;
  let deliveryKey: string | null = null;
  let claimToken: string | null = null;

  try {
    requirePost(req);
    const payload = await readJsonBody<NotificationPayload>(req, 16 * 1024);
    const requestedUserId = String(payload.user_id ?? "").trim();
    if (!UUID_PATTERN.test(requestedUserId)) {
      throw new HttpError(400, "valid_user_id_required");
    }

    if (req.headers.has("x-internal-secret")) {
      await requireInternalSecret(req);
      internalRequest = true;
    } else {
      principal = await requireSelfOrAdmin(req, requestedUserId);
    }

    const service = getServiceClient();
    let userId = requestedUserId;
    let title = String(payload.title ?? "").trim();
    let message = String(payload.message ?? "").trim();
    let type = normalizeNotificationType(payload.type);
    let data = normalizeData(payload.data);
    let existingNotificationId: string | null = null;

    if (payload.notification_id !== undefined) {
      const notificationId = String(payload.notification_id).trim();
      if (!UUID_PATTERN.test(notificationId)) {
        throw new HttpError(400, "invalid_notification_id");
      }
      const { data: notification, error } = await service
        .from("notifications")
        .select("id, user_id, title, message, type, data")
        .eq("id", notificationId)
        .eq("user_id", requestedUserId)
        .maybeSingle();
      if (error) {
        console.error("Canonical push notification lookup failed", {
          code: error.code,
        });
        throw new HttpError(503, "notification_store_unavailable");
      }
      if (!notification) throw new HttpError(404, "notification_not_found");

      const canonical = notification as CanonicalNotification;
      existingNotificationId = canonical.id;
      userId = canonical.user_id;
      title = String(canonical.title ?? "").trim();
      message = String(canonical.message ?? "").trim();
      type = normalizeNotificationType(canonical.type);
      data = normalizeData(canonical.data);
    }

    if (
      title.length < 1 || title.length > 120 || message.length < 1 ||
      message.length > 1_000
    ) {
      throw new HttpError(400, "invalid_notification_payload");
    }

    await enforceRateLimit(
      req,
      "send-push-notification",
      principal?.user.id || userId,
      hasAdminAssurance(principal) ? 240 : internalRequest ? 120 : 20,
      60 * 60,
    );

    deliveryKey = getIdempotencyKey(payload);
    const payloadHash = await sha256Hex(JSON.stringify({
      notificationId: existingNotificationId,
      userId,
      title,
      message,
      type,
      data,
    }));
    if (deliveryKey) {
      const claim = await claimDelivery(deliveryKey, payloadHash);
      if (claim.state === "completed") {
        await recordSecurityEvent(req, {
          eventType: "notification.push_deduplicated",
          category: "edge_function",
          outcome: "success",
          principal,
          actorType: internalRequest ? "service" : undefined,
          action: "send_push",
          resourceType: "notification",
          resourceId: existingNotificationId ?? undefined,
        });
        return jsonResponse(req, {
          success: true,
          sent: 0,
          failed: 0,
          total_tokens: 0,
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

    let notificationId = existingNotificationId;
    if (!notificationId) {
      const { data: saved, error } = await service
        .from("notifications")
        .insert({
          user_id: userId,
          title,
          message,
          type,
          status: "unread",
          data,
        })
        .select("id")
        .single();
      if (error || !saved) {
        console.error("Push notification persistence failed", {
          code: error?.code,
        });
        throw new HttpError(503, "notification_store_unavailable");
      }
      notificationId = String(saved.id);
    }

    const { data: tokenRows, error: tokenError } = await service
      .from("push_tokens")
      .select("token")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(20);
    if (tokenError) {
      console.error("Push token lookup failed", { code: tokenError.code });
      throw new HttpError(503, "push_tokens_unavailable");
    }

    const tokens = Array.from(
      new Set(
        (tokenRows || [])
          .map((row) => String(row.token ?? ""))
          .filter((token) => token.length >= 20 && token.length <= 4_096),
      ),
    );

    if (tokens.length === 0) {
      if (deliveryKey && claimToken) {
        await completeDelivery(
          deliveryKey,
          claimToken,
          true,
          notificationId,
          null,
        );
        claimToken = null;
      }
      await recordSecurityEvent(req, {
        eventType: "notification.push_persisted_without_token",
        category: "edge_function",
        outcome: "success",
        principal,
        actorType: internalRequest ? "service" : undefined,
        action: "send_push",
        resourceType: "notification",
        resourceId: notificationId,
      });
      return jsonResponse(req, {
        success: true,
        message: "No active push tokens found; notification saved to DB only",
        sent: 0,
      });
    }

    const serviceAccount = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    const projectId = Deno.env.get("FIREBASE_PROJECT_ID") || "nutrio-fuel";
    if (!serviceAccount || !/^[A-Za-z0-9-]{1,100}$/.test(projectId)) {
      throw new HttpError(503, "push_service_unavailable");
    }

    const accessToken = await getGoogleAccessToken(serviceAccount);
    const fcmData = {
      ...data,
      notification_id: notificationId,
      notification_type: type,
    };
    const results = await Promise.all(
      tokens.map((token) =>
        sendFcmNotification(
          accessToken,
          projectId,
          token,
          title,
          message,
          fcmData,
        )
      ),
    );

    const sent = results.filter((result) => result.success).length;
    const failed = results.length - sent;
    const invalidTokens = tokens.filter((_, index) =>
      results[index].invalidToken
    );
    for (const token of invalidTokens) {
      const { error } = await service
        .from("push_tokens")
        .update({ is_active: false })
        .eq("user_id", userId)
        .eq("token", token);
      if (error) {
        console.error("Push token deactivation failed", { code: error.code });
      }
    }

    if (sent === 0) throw new HttpError(502, "push_delivery_failed");

    if (deliveryKey && claimToken) {
      const providerMessageId = results.find((result) =>
        result.messageId
      )?.messageId ?? notificationId;
      await completeDelivery(
        deliveryKey,
        claimToken,
        true,
        providerMessageId,
        null,
      );
      claimToken = null;
    }

    await recordSecurityEvent(req, {
      eventType: "notification.push_sent",
      category: "edge_function",
      severity: failed > 0 ? "low" : "info",
      outcome: "success",
      principal,
      actorType: internalRequest ? "service" : undefined,
      action: "send_push",
      resourceType: "notification",
      resourceId: notificationId,
      metadata: { sent, failed, total_tokens: tokens.length },
    });

    return jsonResponse(req, {
      success: true,
      sent,
      failed,
      total_tokens: tokens.length,
    });
  } catch (error) {
    if (deliveryKey && claimToken) {
      await completeDelivery(
        deliveryKey,
        claimToken,
        false,
        null,
        error instanceof HttpError ? error.code : "internal_error",
      );
    }
    await recordSecurityEvent(req, {
      eventType: "notification.push_request_failed",
      category: "edge_function",
      severity: error instanceof HttpError && error.status < 500
        ? "medium"
        : "high",
      outcome: error instanceof HttpError && error.status === 403
        ? "denied"
        : "failure",
      principal,
      actorType: internalRequest ? "service" : undefined,
      action: "send_push",
      resourceType: "notification",
      metadata: {
        code: error instanceof HttpError ? error.code : "internal_error",
      },
    });
    return errorResponse(req, error);
  }
});
