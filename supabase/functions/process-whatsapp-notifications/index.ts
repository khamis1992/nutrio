import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  enforceRateLimit,
  errorResponse,
  getServiceClient,
  handlePreflight,
  HttpError,
  jsonResponse,
  readJsonBody,
  recordSecurityEvent,
  requireAdminOrInternal,
  requirePost,
  type SecurityPrincipal,
} from "../_shared/security.ts";

interface ProcessorRequest {
  limit?: number;
}

interface ClaimedNotification {
  notification_id: string;
  phone: string;
  message: string;
  template: string | null;
  claim_token: string;
  attempt_number: number;
}

interface ProviderResult {
  success: boolean;
  providerMessageId?: string;
  errorCode?: string;
  retryable: boolean;
}

function normalizePhone(value: unknown): string | null {
  const input = String(value ?? "").trim();
  if (!input || !/^[+0-9()\s-]+$/.test(input)) return null;
  let phone = input.replace(/\D/g, "");
  if (phone.startsWith("00")) phone = phone.slice(2);
  if (phone.length === 8) phone = `974${phone}`;
  return phone.length >= 8 && phone.length <= 15 ? phone : null;
}

function parseUltraMsgMessageId(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const sent = data.sent === true || data.sent === "true";
  const providerError = data.error;
  const hasProviderError = providerError !== undefined &&
    providerError !== null && providerError !== false &&
    String(providerError).trim() !== "";
  const rawId = data.id ?? data.messageId;
  if (
    !sent || hasProviderError ||
    (typeof rawId !== "string" && typeof rawId !== "number")
  ) {
    return null;
  }
  const messageId = String(rawId).trim();
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,249}$/.test(messageId)
    ? messageId
    : null;
}

async function sendWhatsAppMessage(
  instanceId: string,
  apiToken: string,
  phoneValue: string,
  messageValue: string,
): Promise<ProviderResult> {
  const phone = normalizePhone(phoneValue);
  const message = String(messageValue ?? "").trim();
  if (!phone || message.length < 1 || message.length > 2_000) {
    return {
      success: false,
      errorCode: "invalid_queue_payload",
      retryable: false,
    };
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
    console.error("Ultramsg queue request failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return {
      success: false,
      errorCode: "provider_unreachable",
      retryable: true,
    };
  }

  if (!response.ok) {
    console.error("Ultramsg rejected queued message", {
      status: response.status,
    });
    const retryable = response.status === 408 ||
      response.status === 409 ||
      response.status === 425 ||
      response.status === 429 ||
      response.status >= 500;
    return {
      success: false,
      errorCode: `provider_http_${response.status}`,
      retryable,
    };
  }

  const providerData = await response.json().catch(() => null) as unknown;
  const providerMessageId = parseUltraMsgMessageId(providerData);
  if (!providerMessageId) {
    console.error("Ultramsg returned an unverified success payload");
    return {
      success: false,
      errorCode: "provider_unverified_response",
      retryable: false,
    };
  }
  return {
    success: true,
    providerMessageId,
    retryable: false,
  };
}

async function completeNotification(
  notification: ClaimedNotification,
  result: ProviderResult,
): Promise<boolean> {
  const service = getServiceClient();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data, error } = await service.rpc(
      "complete_whatsapp_notification",
      {
        p_notification_id: notification.notification_id,
        p_claim_token: notification.claim_token,
        p_succeeded: result.success,
        p_provider_message_id: result.providerMessageId ?? null,
        p_error_code: result.errorCode ?? null,
        p_retryable: result.retryable,
      },
    );
    if (!error && data === true) return true;
    console.error("WhatsApp queue completion failed", {
      code: error?.code,
      attempt: attempt + 1,
    });
  }

  return false;
}

serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  let principal: SecurityPrincipal | null = null;
  let authorizedInternal = false;

  try {
    requirePost(req);
    principal = await requireAdminOrInternal(
      req,
      "WHATSAPP_PROCESSOR_CRON_SECRET",
    );
    authorizedInternal = principal === null;
    await enforceRateLimit(
      req,
      "process-whatsapp-notifications",
      principal?.user.id || "internal",
      12,
      60,
    );

    const body = req.body
      ? await readJsonBody<ProcessorRequest>(req, 4 * 1024)
      : {};
    const requestedLimit = body.limit ?? 3;
    if (
      !Number.isInteger(requestedLimit) || requestedLimit < 1 ||
      requestedLimit > 3
    ) {
      throw new HttpError(400, "invalid_batch_limit");
    }

    const instanceId = Deno.env.get("ULTRAMSG_INSTANCE_ID") || "";
    const apiToken = Deno.env.get("ULTRAMSG_API_TOKEN") || "";
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(instanceId) || !apiToken) {
      throw new HttpError(503, "whatsapp_service_unavailable");
    }

    const service = getServiceClient();
    const { data, error } = await service.rpc("claim_whatsapp_notifications", {
      p_limit: requestedLimit,
      p_lease_seconds: 90,
    });
    if (error) {
      console.error("WhatsApp queue claim failed", { code: error.code });
      throw new HttpError(503, "notification_queue_unavailable");
    }

    const notifications = Array.isArray(data)
      ? data as ClaimedNotification[]
      : [];
    let succeeded = 0;
    let failed = 0;

    for (const notification of notifications) {
      const result = await sendWhatsAppMessage(
        instanceId,
        apiToken,
        notification.phone,
        notification.message,
      );
      const completed = await completeNotification(notification, result);
      if (result.success && completed) succeeded += 1;
      else failed += 1;
    }

    await recordSecurityEvent(req, {
      eventType: "notification.whatsapp_batch_processed",
      category: "edge_function",
      severity: failed > 0 ? "medium" : "info",
      outcome: failed > 0 ? "failure" : "success",
      principal,
      actorType: authorizedInternal ? "service" : undefined,
      action: "process_whatsapp_queue",
      resourceType: "notification_queue",
      metadata: {
        processed: notifications.length,
        succeeded,
        failed,
      },
    });

    return jsonResponse(req, {
      success: true,
      processed: notifications.length,
      succeeded,
      failed,
    });
  } catch (error) {
    await recordSecurityEvent(req, {
      eventType: "notification.whatsapp_batch_failed",
      category: "edge_function",
      severity: "high",
      outcome: "failure",
      principal,
      actorType: authorizedInternal ? "service" : undefined,
      action: "process_whatsapp_queue",
      resourceType: "notification_queue",
      metadata: {
        code: error instanceof HttpError ? error.code : "internal_error",
      },
    });
    return errorResponse(req, error);
  }
});
