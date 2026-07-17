import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import {
  errorResponse,
  getServiceClient,
  handlePreflight,
  HttpError,
  jsonResponse,
  readBoundedResponseJson,
  readJsonBody,
  recordSecurityEvent,
  requireAdminOrInternal,
  requireAllowedHttpsUrl,
  requirePost,
} from "../_shared/security.ts";

type DispatchBody = { limit?: number };

type ClaimedAlert = {
  alert_id: string;
  event_id: string;
  sequence_number: number | string;
  event_hash: string;
  event_type: string;
  category: string;
  severity: "high" | "critical";
  outcome: string;
  occurred_at: string;
  claim_token: string;
  attempt_number: number;
};

type AlertAcknowledgement = {
  protocol?: unknown;
  alert_id?: unknown;
  event_hash?: unknown;
  external_reference?: unknown;
  acknowledged_at?: unknown;
  nonce?: unknown;
  key_id?: unknown;
  signature?: unknown;
};

type DeliveryResult = {
  success: boolean;
  retryable: boolean;
  errorCode?: string;
  providerReference?: string;
  acknowledgedAt?: string;
  acknowledgementSignature?: string;
};

const RESPONSE_LIMIT = 16 * 1024;

function validateSink(rawUrl: string): URL {
  const url = requireAllowedHttpsUrl(
    rawUrl,
    "SECURITY_ALERT_WEBHOOK_URL",
    "SECURITY_ALERT_ALLOWED_HOSTS",
  );
  const hostname = url.hostname.toLowerCase();
  const privateLiteral = /^(localhost|127\.|0\.|10\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.|\[?::1\]?$|\[?f[cd])/i;
  if (privateLiteral.test(hostname)) {
    throw new HttpError(503, "security_alert_sink_invalid");
  }
  return url;
}

async function hmacSha256Hex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return Array.from(
    new Uint8Array(signature),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

function acknowledgementPayload(value: {
  protocol: string;
  alert_id: string;
  event_hash: string;
  external_reference: string;
  acknowledged_at: string;
  nonce: string;
  key_id: string;
}): string {
  return [
    value.protocol,
    value.alert_id,
    value.event_hash,
    value.external_reference,
    value.acknowledged_at,
    value.nonce,
    value.key_id,
  ].join("\n");
}

function constantTimeHexEqual(left: string, right: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(left) || !/^[0-9a-f]{64}$/.test(right)) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function validateAcknowledgement(
  raw: unknown,
  alert: ClaimedAlert,
  secret: string,
  expectedKeyId: string,
): Promise<DeliveryResult> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { success: false, retryable: true, errorCode: "ack_invalid" };
  }
  const candidate = raw as AlertAcknowledgement;
  const acknowledgement = {
    protocol: typeof candidate.protocol === "string" ? candidate.protocol : "",
    alert_id: typeof candidate.alert_id === "string" ? candidate.alert_id : "",
    event_hash: typeof candidate.event_hash === "string" ? candidate.event_hash : "",
    external_reference: typeof candidate.external_reference === "string"
      ? candidate.external_reference
      : "",
    acknowledged_at: typeof candidate.acknowledged_at === "string"
      ? candidate.acknowledged_at
      : "",
    nonce: typeof candidate.nonce === "string" ? candidate.nonce : "",
    key_id: typeof candidate.key_id === "string" ? candidate.key_id : "",
  };
  const signature = typeof candidate.signature === "string"
    ? candidate.signature.replace(/^sha256=/i, "").toLowerCase()
    : "";
  const acknowledgedAt = new Date(acknowledgement.acknowledged_at);
  const age = Math.abs(Date.now() - acknowledgedAt.getTime());
  if (
    acknowledgement.protocol !== "nutrio-security-alert-ack-v1" ||
    acknowledgement.alert_id !== alert.alert_id ||
    acknowledgement.event_hash !== alert.event_hash ||
    acknowledgement.key_id !== expectedKeyId ||
    !Number.isFinite(acknowledgedAt.getTime()) ||
    age > 15 * 60 * 1000 ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,299}$/.test(acknowledgement.external_reference) ||
    !/^[A-Za-z0-9._:-]{16,200}$/.test(acknowledgement.nonce) ||
    !/^[0-9a-f]{64}$/.test(signature)
  ) {
    return { success: false, retryable: true, errorCode: "ack_invalid" };
  }

  const expectedSignature = await hmacSha256Hex(
    secret,
    acknowledgementPayload(acknowledgement),
  );
  if (!constantTimeHexEqual(signature, expectedSignature)) {
    return { success: false, retryable: true, errorCode: "ack_signature_invalid" };
  }
  return {
    success: true,
    retryable: false,
    providerReference: acknowledgement.external_reference,
    acknowledgedAt: acknowledgement.acknowledged_at,
    acknowledgementSignature: signature,
  };
}

async function deliverAlert(
  alert: ClaimedAlert,
  sink: URL,
  secret: string,
  keyId: string,
): Promise<DeliveryResult> {
  const timestamp = new Date().toISOString();
  const requestId = crypto.randomUUID();
  const body = JSON.stringify({
    protocol: "nutrio-security-alert-v1",
    alert_id: alert.alert_id,
    event_id: alert.event_id,
    sequence_number: String(alert.sequence_number),
    event_hash: alert.event_hash,
    event_type: alert.event_type,
    category: alert.category,
    severity: alert.severity,
    outcome: alert.outcome,
    occurred_at: alert.occurred_at,
    attempt_number: alert.attempt_number,
  });
  const signature = await hmacSha256Hex(
    secret,
    `${timestamp}.${requestId}.${body}`,
  );

  let response: Response;
  try {
    response = await fetch(sink, {
      method: "POST",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        "X-Nutrio-Protocol": "nutrio-security-alert-v1",
        "X-Nutrio-Timestamp": timestamp,
        "X-Nutrio-Request-Id": requestId,
        "X-Nutrio-Key-Id": keyId,
        "X-Nutrio-Signature": `sha256=${signature}`,
      },
      body,
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    console.error("Security alert receiver unavailable", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return { success: false, retryable: true, errorCode: "receiver_unreachable" };
  }

  if (!response.ok) {
    const retryable = response.status === 408 || response.status === 409 ||
      response.status === 425 || response.status === 429 || response.status >= 500;
    await response.body?.cancel().catch(() => undefined);
    return {
      success: false,
      retryable,
      errorCode: `receiver_http_${response.status}`,
    };
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.includes("application/json")) {
    await response.body?.cancel().catch(() => undefined);
    return { success: false, retryable: true, errorCode: "ack_content_type_invalid" };
  }
  const acknowledgement = await readBoundedResponseJson<unknown>(
    response,
    RESPONSE_LIMIT,
    { invalidBodyCode: "ack_invalid", tooLargeCode: "ack_too_large" },
  ).catch(() => null);
  return await validateAcknowledgement(acknowledgement, alert, secret, keyId);
}

async function completeAlert(
  alert: ClaimedAlert,
  result: DeliveryResult,
  keyId: string,
): Promise<string> {
  const service = getServiceClient();
  const { data, error } = await service.rpc("complete_security_alert", {
    p_alert_id: alert.alert_id,
    p_claim_token: alert.claim_token,
    p_succeeded: result.success,
    p_retryable: result.retryable,
    p_error_code: result.errorCode ?? null,
    p_provider_reference: result.providerReference ?? null,
    p_acknowledged_at: result.acknowledgedAt ?? null,
    p_acknowledgement_key_id: result.success ? keyId : null,
    p_acknowledgement_signature: result.acknowledgementSignature ?? null,
  });
  if (error || typeof data !== "string") {
    console.error("Security alert queue completion failed", { code: error?.code });
    throw new HttpError(503, "security_alert_completion_unavailable");
  }
  return data;
}

serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    requirePost(req);
    const principal = await requireAdminOrInternal(req, "SECURITY_ALERT_CRON_SECRET");
    const body = await readJsonBody<DispatchBody>(req, 2 * 1024);
    const limit = body.limit ?? 10;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 25) {
      throw new HttpError(400, "invalid_limit");
    }

    const sink = validateSink(Deno.env.get("SECURITY_ALERT_WEBHOOK_URL") || "");
    const secret = Deno.env.get("SECURITY_ALERT_HMAC_KEY") || "";
    const keyId = Deno.env.get("SECURITY_ALERT_HMAC_KEY_ID") || "";
    if (new TextEncoder().encode(secret).byteLength < 32) {
      throw new HttpError(503, "security_alert_hmac_key_missing");
    }
    if (!/^[A-Za-z0-9._:-]{3,100}$/.test(keyId)) {
      throw new HttpError(503, "security_alert_hmac_key_id_invalid");
    }

    const service = getServiceClient();
    const { data, error } = await service.rpc("claim_security_alerts", {
      p_limit: limit,
      p_lease_seconds: 120,
    });
    if (error) {
      console.error("Security alert queue claim failed", { code: error.code });
      throw new HttpError(503, "security_alert_queue_unavailable");
    }

    const alerts = Array.isArray(data) ? data as ClaimedAlert[] : [];
    let delivered = 0;
    let retried = 0;
    let deadLettered = 0;
    for (const alert of alerts) {
      const result = await deliverAlert(alert, sink, secret, keyId);
      const finalStatus = await completeAlert(alert, result, keyId);
      if (finalStatus === "delivered") delivered += 1;
      else if (finalStatus === "pending") retried += 1;
      else if (finalStatus === "dead_letter") deadLettered += 1;
    }

    await recordSecurityEvent(req, {
      eventType: deadLettered > 0
        ? "security.alert.dead_letter_detected"
        : "security.alert.dispatch_completed",
      category: "detection",
      severity: deadLettered > 0 ? "critical" : "info",
      outcome: deadLettered > 0 ? "failure" : "success",
      principal,
      actorType: principal ? undefined : "service",
      action: "dispatch_security_alerts",
      metadata: {
        claimed: alerts.length,
        delivered,
        retried,
        dead_lettered: deadLettered,
      },
    });

    return jsonResponse(req, {
      claimed: alerts.length,
      delivered,
      retried,
      dead_lettered: deadLettered,
    });
  } catch (error) {
    return errorResponse(req, error);
  }
});
