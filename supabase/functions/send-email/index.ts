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
  readJsonBody,
  recordSecurityEvent,
  requireInternalSecret,
  requirePost,
  type SecurityPrincipal,
} from "../_shared/security.ts";
import {
  getNotificationRecipient,
  type NotificationRecipient,
} from "../_shared/notificationRecipient.ts";

const MAX_REQUEST_BYTES = 8 * 1024 * 1024;
const MAX_HTML_LENGTH = 500_000;
const MAX_TEXT_LENGTH = 200_000;
const MAX_ATTACHMENT_BASE64_LENGTH = 6 * 1024 * 1024;
const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type EmailPreference =
  | "email_notifications"
  | "health_insights"
  | "subscription_updates";

interface EmailAttachment {
  filename: string;
  content: string;
}

interface EmailRequest {
  to?: string;
  user_id?: string;
  preference?: EmailPreference;
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
  from?: string;
  replyTo?: string;
  idempotency_key?: string;
  idempotencyKey?: string;
}

interface DeliveryClaim {
  claimed: boolean;
  state: string;
  claim_token?: string;
  provider_message_id?: string;
}

function normalizeEmail(value: unknown): string {
  const email = String(value ?? "").trim().toLowerCase();
  if (
    email.length > 320 || !EMAIL_PATTERN.test(email) || /[\r\n]/.test(email)
  ) {
    throw new HttpError(400, "invalid_email_address");
  }
  return email;
}

function extractMailbox(value: string): string {
  if (value.length > 320 || /[\r\n]/.test(value)) {
    throw new HttpError(400, "invalid_sender");
  }
  const bracketed = value.match(/<([^<>]+)>\s*$/);
  return normalizeEmail(bracketed?.[1] ?? value);
}

function getAllowedSenderDomains(): Set<string> {
  const configured = Deno.env.get("RESEND_ALLOWED_FROM_DOMAINS") || "";
  return new Set(
    ["nutrio.app", "nutrio.me", ...configured.split(",")]
      .map((domain) => domain.trim().toLowerCase())
      .filter(Boolean),
  );
}

function validateSender(value: string): string {
  const mailbox = extractMailbox(value);
  const domain = mailbox.split("@")[1];
  if (!getAllowedSenderDomains().has(domain)) {
    throw new HttpError(400, "sender_not_allowed");
  }
  return value.trim();
}

function validateAttachments(value: unknown): EmailAttachment[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 5) {
    throw new HttpError(400, "invalid_attachments");
  }

  let totalLength = 0;
  const attachments = value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new HttpError(400, "invalid_attachments");
    }
    const filename = String((item as Record<string, unknown>).filename ?? "");
    const content = String((item as Record<string, unknown>).content ?? "");
    const hasUnsafeFilenameCharacter = Array.from(filename).some(
      (character) => {
        const code = character.charCodeAt(0);
        return code < 32 || code === 127 || character === "/" ||
          character === "\\";
      },
    );
    if (
      filename.length < 1 ||
      filename.length > 150 ||
      hasUnsafeFilenameCharacter ||
      content.length < 4 ||
      content.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(content)
    ) {
      throw new HttpError(400, "invalid_attachments");
    }
    totalLength += content.length;
    return { filename, content };
  });

  if (totalLength > MAX_ATTACHMENT_BASE64_LENGTH) {
    throw new HttpError(413, "attachments_too_large");
  }
  return attachments;
}

function validateIdempotencyKey(body: EmailRequest): string | null {
  const key = body.idempotency_key ?? body.idempotencyKey;
  if (key === undefined) return null;
  const normalized = String(key).trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(normalized)) {
    throw new HttpError(400, "invalid_idempotency_key");
  }
  return normalized;
}

function validatePreference(value: unknown): EmailPreference {
  const preference = String(value ?? "email_notifications").trim();
  if (
    preference !== "email_notifications" &&
    preference !== "health_insights" &&
    preference !== "subscription_updates"
  ) {
    throw new HttpError(400, "invalid_email_preference");
  }
  return preference;
}

function isPreferenceEnabled(
  recipient: NotificationRecipient,
  preference: EmailPreference,
): boolean {
  if (!recipient.emailEnabled) return false;
  if (preference === "health_insights") {
    return recipient.healthInsightsEnabled;
  }
  if (preference === "subscription_updates") {
    return recipient.subscriptionUpdatesEnabled;
  }
  return true;
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
    p_channel: "email",
    p_idempotency_key: idempotencyKey,
    p_payload_hash: payloadHash,
    p_lease_seconds: 90,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    console.error("Email delivery claim unavailable", { code: error?.code });
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
    p_channel: "email",
    p_idempotency_key: idempotencyKey,
    p_claim_token: claimToken,
    p_succeeded: succeeded,
    p_provider_message_id: providerMessageId,
    p_error_code: errorCode,
  });
  if (error || data !== true) {
    console.error("Email delivery claim completion failed", {
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

    const body = await readJsonBody<EmailRequest>(req, MAX_REQUEST_BYTES);
    const subject = String(body.subject ?? "").trim();
    const html = body.html === undefined ? undefined : String(body.html);
    const text = body.text === undefined ? undefined : String(body.text);

    if (
      subject.length < 1 ||
      subject.length > 200 ||
      (!html && !text) ||
      (html?.length ?? 0) > MAX_HTML_LENGTH ||
      (text?.length ?? 0) > MAX_TEXT_LENGTH
    ) {
      throw new HttpError(400, "invalid_email_payload");
    }

    const requestedUserId = body.user_id === undefined
      ? null
      : String(body.user_id).trim();
    if (requestedUserId && !UUID_PATTERN.test(requestedUserId)) {
      throw new HttpError(400, "invalid_recipient_user_id");
    }

    let recipientUserId: string;
    if (internalRequest) {
      if (!requestedUserId) {
        throw new HttpError(400, "recipient_user_id_required");
      }
      recipientUserId = requestedUserId;
    } else {
      if (!principal) throw new HttpError(401, "authentication_required");
      if (
        requestedUserId && requestedUserId !== principal.user.id &&
        !hasAdminAccess
      ) {
        await recordSecurityEvent(req, {
          eventType: "authorization.email_recipient_denied",
          category: "authorization",
          severity: "high",
          outcome: "denied",
          principal,
          action: "send_email",
          resourceType: "auth.user",
          resourceId: requestedUserId,
        });
        throw new HttpError(403, "recipient_not_authorized");
      }
      recipientUserId = requestedUserId || principal.user.id;
    }

    const recipient = await getNotificationRecipient(recipientUserId);
    if (!recipient.email) {
      throw new HttpError(422, "verified_email_required");
    }
    const to = recipient.email;
    if (body.to !== undefined && normalizeEmail(body.to) !== to) {
      await recordSecurityEvent(req, {
        eventType: "authorization.email_recipient_denied",
        category: "authorization",
        severity: "high",
        outcome: "denied",
        principal,
        action: "send_email",
        resourceType: "auth.user",
        resourceId: recipientUserId,
      });
      throw new HttpError(403, "recipient_not_authorized");
    }

    const preference = validatePreference(body.preference);

    const attachments = validateAttachments(body.attachments);
    const defaultFrom = validateSender(
      Deno.env.get("RESEND_FROM_EMAIL") || "Nutrio <noreply@nutrio.app>",
    );
    const from = internalRequest || hasAdminAccess
      ? validateSender(body.from || defaultFrom)
      : defaultFrom;
    const replyTo = body.replyTo ? extractMailbox(body.replyTo) : undefined;
    if (replyTo && !getAllowedSenderDomains().has(replyTo.split("@")[1])) {
      throw new HttpError(400, "reply_to_not_allowed");
    }

    const targetHash = await sha256Hex(to);
    await enforceRateLimit(
      req,
      "send-email",
      principal?.user.id || `internal:${targetHash.slice(0, 24)}`,
      hasAdminAccess ? 120 : internalRequest ? 60 : 10,
      60 * 60,
    );

    if (!isPreferenceEnabled(recipient, preference)) {
      await recordSecurityEvent(req, {
        eventType: "notification.email_suppressed",
        category: "edge_function",
        outcome: "success",
        principal,
        actorType: internalRequest ? "service" : undefined,
        action: "suppress_email",
        resourceType: "auth.user",
        resourceId: recipientUserId,
        metadata: { reason: "channel_disabled", preference },
      });
      return jsonResponse(req, {
        success: true,
        suppressed: true,
        reason: "channel_disabled",
      });
    }

    const idempotencyKey = validateIdempotencyKey(body);
    const payloadHash = await sha256Hex(JSON.stringify({
      to,
      recipientUserId,
      preference,
      subject,
      html: html ?? null,
      text: text ?? null,
      attachments: attachments ?? null,
      from,
      replyTo: replyTo ?? null,
    }));

    let claimToken: string | null = null;
    if (idempotencyKey) {
      const claim = await claimDelivery(idempotencyKey, payloadHash);
      if (claim.state === "completed") {
        await recordSecurityEvent(req, {
          eventType: "notification.email_deduplicated",
          category: "edge_function",
          outcome: "success",
          principal,
          actorType: internalRequest ? "service" : undefined,
          action: "send_email",
          resourceType: "notification.email",
        });
        return jsonResponse(req, {
          success: true,
          messageId: claim.provider_message_id,
          duplicate: true,
        });
      }
      if (!claim.claimed || !claim.claim_token) {
        const code = claim.state === "conflict"
          ? "idempotency_conflict"
          : claim.state === "exhausted"
          ? "delivery_retry_exhausted"
          : "delivery_in_progress";
        throw new HttpError(409, code);
      }
      claimToken = claim.claim_token;
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      if (idempotencyKey && claimToken) {
        await completeDelivery(
          idempotencyKey,
          claimToken,
          false,
          null,
          "provider_not_configured",
        );
      }
      throw new HttpError(503, "email_service_unavailable");
    }

    let response: Response;
    try {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          html,
          text,
          attachments,
          reply_to: replyTo,
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      console.error("Resend request failed", {
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
      throw new HttpError(502, "email_delivery_failed");
    }

    if (!response.ok) {
      console.error("Resend rejected email", { status: response.status });
      if (idempotencyKey && claimToken) {
        await completeDelivery(
          idempotencyKey,
          claimToken,
          false,
          null,
          `provider_http_${response.status}`,
        );
      }
      throw new HttpError(502, "email_delivery_failed");
    }

    const providerData = await response.json().catch(() => ({})) as Record<
      string,
      unknown
    >;
    const rawMessageId = typeof providerData.id === "string"
      ? providerData.id.trim()
      : "";
    const messageId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,249}$/.test(rawMessageId)
      ? rawMessageId
      : null;
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
      throw new HttpError(502, "email_delivery_unverified");
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
      eventType: "notification.email_sent",
      category: "edge_function",
      outcome: "success",
      principal,
      actorType: internalRequest ? "service" : undefined,
      action: "send_email",
      resourceType: "notification.email",
      metadata: {
        attachment_count: attachments?.length ?? 0,
        idempotent: Boolean(idempotencyKey),
      },
    });

    return jsonResponse(req, { success: true, messageId });
  } catch (error) {
    await recordSecurityEvent(req, {
      eventType: "notification.email_request_failed",
      category: "edge_function",
      severity: error instanceof HttpError && error.status < 500
        ? "medium"
        : "high",
      outcome: error instanceof HttpError && error.status === 403
        ? "denied"
        : "failure",
      principal,
      actorType: internalRequest ? "service" : undefined,
      action: "send_email",
      resourceType: "notification.email",
      metadata: {
        code: error instanceof HttpError ? error.code : "internal_error",
      },
    });
    return errorResponse(req, error);
  }
});
