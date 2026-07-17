import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import {
  errorResponse,
  getServiceClient,
  handlePreflight,
  HttpError,
  jsonResponse,
  readJsonBody,
  recordSecurityEvent,
  requireAllowedHttpsUrl,
  requireAdminOrInternal,
  requirePost,
} from "../_shared/security.ts";

type MaintenanceBody = {
  anchor_date?: string;
};

type AnchorResult = {
  anchored?: boolean;
  existing?: boolean;
  reason?: string;
  anchor_date?: string;
  anchor_hash?: string;
  first_sequence?: number | string;
  last_sequence?: number | string;
  event_count?: number | string;
  range_hash?: string;
  previous_anchor_hash?: string;
};

type AnchorAcknowledgement = {
  protocol?: string;
  anchor_hash?: string;
  payload_sha256?: string;
  previous_anchor_hash?: string;
  external_reference?: string;
  acknowledged_at?: string;
  nonce?: string;
  key_id?: string;
  signature?: string;
};

function previousUtcDate(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function validateCompletedDate(value: unknown): string {
  const date = typeof value === "string" && value ? value : previousUtcDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpError(400, "invalid_anchor_date");
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);
  const today = new Date().toISOString().slice(0, 10);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date >= today) {
    throw new HttpError(400, "anchor_date_must_be_completed_utc_date");
  }
  return date;
}

function validateExternalSink(rawUrl: string): URL {
  const url = requireAllowedHttpsUrl(
    rawUrl,
    "SECURITY_ANCHOR_WEBHOOK_URL",
    "SECURITY_ANCHOR_ALLOWED_HOSTS",
  );

  const hostname = url.hostname.toLowerCase();
  const privateLiteral = /^(localhost|127\.|0\.|10\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.|\[?::1\]?$|\[?f[cd])/i;
  if (privateLiteral.test(hostname)) {
    throw new HttpError(503, "security_anchor_sink_invalid");
  }
  return url;
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(payload: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function acknowledgementPayload(acknowledgement: Required<
  Omit<AnchorAcknowledgement, "signature">
>): string {
  return [
    acknowledgement.protocol,
    acknowledgement.anchor_hash,
    acknowledgement.payload_sha256,
    acknowledgement.previous_anchor_hash,
    acknowledgement.external_reference,
    acknowledgement.acknowledged_at,
    acknowledgement.nonce,
    acknowledgement.key_id,
  ].join("\n");
}

function decodeHex(value: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/.test(value)) {
    throw new HttpError(502, "security_anchor_ack_signature_invalid");
  }
  return Uint8Array.from(
    value.match(/.{2}/g) || [],
    (byte) => Number.parseInt(byte, 16),
  );
}

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || codePoint === 127;
  });
}

async function verifyHmacSha256(
  secret: string,
  payload: string,
  signatureHex: string,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    decodeHex(signatureHex),
    new TextEncoder().encode(payload),
  );
}

async function readLimitedJson(response: Response, maximumBytes = 16 * 1024): Promise<unknown> {
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.includes("application/json")) {
    throw new HttpError(502, "security_anchor_ack_content_type_invalid");
  }

  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > maximumBytes) {
    throw new HttpError(502, "security_anchor_ack_too_large");
  }

  const reader = response.body?.getReader();
  if (!reader) throw new HttpError(502, "security_anchor_ack_missing");
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maximumBytes) {
      await reader.cancel();
      throw new HttpError(502, "security_anchor_ack_too_large");
    }
    chunks.push(value);
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(combined));
  } catch {
    throw new HttpError(502, "security_anchor_ack_json_invalid");
  }
}

async function requireReceiverAcknowledgement(
  response: Response,
  expectedAnchorHash: string,
  expectedPayloadHash: string,
  expectedPreviousAnchorHash: string,
  acknowledgementKey: string,
  expectedKeyId: string,
): Promise<Required<AnchorAcknowledgement>> {
  const value = await readLimitedJson(response);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(502, "security_anchor_ack_invalid");
  }
  const acknowledgement = value as AnchorAcknowledgement;
  const normalized = {
    protocol: acknowledgement.protocol || "",
    anchor_hash: acknowledgement.anchor_hash || "",
    payload_sha256: acknowledgement.payload_sha256 || "",
    previous_anchor_hash: acknowledgement.previous_anchor_hash || "",
    external_reference: acknowledgement.external_reference || "",
    acknowledged_at: acknowledgement.acknowledged_at || "",
    nonce: acknowledgement.nonce || "",
    key_id: acknowledgement.key_id || "",
    signature: (acknowledgement.signature || "").replace(/^sha256=/i, "").toLowerCase(),
  };

  const acknowledgedAt = new Date(normalized.acknowledged_at);
  const acknowledgementAge = Math.abs(Date.now() - acknowledgedAt.getTime());
  if (
    normalized.protocol !== "nutrio-security-anchor-ack-v1" ||
    normalized.anchor_hash !== expectedAnchorHash ||
    normalized.payload_sha256 !== expectedPayloadHash ||
    normalized.previous_anchor_hash !== expectedPreviousAnchorHash ||
    normalized.key_id !== expectedKeyId ||
    !Number.isFinite(acknowledgedAt.getTime()) ||
    acknowledgementAge > 15 * 60 * 1000 ||
    normalized.external_reference.length < 3 ||
    normalized.external_reference.length > 500 ||
    containsControlCharacter(normalized.external_reference) ||
    !/^[A-Za-z0-9._:-]{16,200}$/.test(normalized.nonce) ||
    !/^[0-9a-f]{64}$/.test(normalized.signature)
  ) {
    throw new HttpError(502, "security_anchor_ack_invalid");
  }

  const valid = await verifyHmacSha256(
    acknowledgementKey,
    acknowledgementPayload(normalized),
    normalized.signature,
  );
  if (!valid) throw new HttpError(502, "security_anchor_ack_signature_invalid");
  return normalized;
}

serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    requirePost(req);
    const principal = await requireAdminOrInternal(req, "SECURITY_LOG_CRON_SECRET");
    const body = await readJsonBody<MaintenanceBody>(req, 2 * 1024);
    const anchorDate = validateCompletedDate(body.anchor_date);
    const service = getServiceClient();

    const { data, error } = await service.rpc("create_security_event_anchor", {
      p_anchor_date: anchorDate,
    });
    if (error) {
      console.error("Security anchor creation failed:", error.message);
      throw new HttpError(503, "security_anchor_unavailable");
    }

    const anchor = (data || {}) as AnchorResult;
    if (!anchor.anchored) {
      await recordSecurityEvent(req, {
        eventType: "security.anchor_no_events",
        category: "detection",
        severity: "info",
        outcome: "success",
        principal,
        actorType: principal ? undefined : "service",
        action: "anchor_security_ledger",
        resourceType: "security.event_ledger",
        resourceId: anchorDate,
        metadata: { reason: anchor.reason || "no_events" },
      });
      return jsonResponse(req, { anchor, external_receipt: false });
    }

    if (
      !anchor.anchor_hash ||
      !/^[0-9a-f]{64}$/.test(anchor.anchor_hash) ||
      !anchor.previous_anchor_hash ||
      !/^(GENESIS|[0-9a-f]{64})$/.test(anchor.previous_anchor_hash)
    ) {
      throw new HttpError(503, "security_anchor_invalid");
    }

    const sinkValue = Deno.env.get("SECURITY_ANCHOR_WEBHOOK_URL") || "";
    if (!sinkValue) {
      await recordSecurityEvent(req, {
        eventType: "security.anchor_external_sink_missing",
        category: "configuration",
        severity: "high",
        outcome: "failure",
        principal,
        actorType: principal ? undefined : "service",
        action: "export_security_anchor",
        resourceType: "security.event_chain_anchor",
        resourceId: anchor.anchor_hash,
        metadata: { anchor_date: anchorDate },
      });
      throw new HttpError(503, "security_anchor_sink_not_configured");
    }

    const sink = validateExternalSink(sinkValue);
    const hmacKey = Deno.env.get("SECURITY_ANCHOR_HMAC_KEY") || "";
    if (hmacKey.length < 32) {
      throw new HttpError(503, "security_anchor_hmac_key_not_configured");
    }
    const acknowledgementKey = Deno.env.get("SECURITY_ANCHOR_ACK_HMAC_KEY") || "";
    const acknowledgementKeyId = Deno.env.get("SECURITY_ANCHOR_ACK_KEY_ID") || "";
    if (
      acknowledgementKey.length < 32 ||
      acknowledgementKey === hmacKey ||
      !/^[A-Za-z0-9._:-]{3,80}$/.test(acknowledgementKeyId)
    ) {
      throw new HttpError(503, "security_anchor_ack_key_not_configured");
    }

    const exportedAt = new Date().toISOString();
    const payload = JSON.stringify({
      system: "nutrio",
      evidence_format: "nutrio-security-anchor-v3",
      exported_at: exportedAt,
      anchor,
    });
    const payloadHash = await sha256Hex(payload);
    const signature = await hmacSha256Hex(hmacKey, payload);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let response: Response;
    try {
      response = await fetch(sink, {
        method: "POST",
        redirect: "error",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "Nutrio-Security-Anchor/3",
          "X-Nutrio-Anchor-Hash": anchor.anchor_hash,
          "X-Nutrio-Payload-SHA256": payloadHash,
          "X-Nutrio-Signature": `sha256=${signature}`,
        },
        body: payload,
      });
    } catch (error) {
      console.error("External security anchor export failed:", error);
      throw new HttpError(502, "security_anchor_export_failed");
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      console.error("External security anchor rejected:", response.status);
      throw new HttpError(502, "security_anchor_export_rejected");
    }

    const acknowledgement = await requireReceiverAcknowledgement(
      response,
      anchor.anchor_hash,
      payloadHash,
      anchor.previous_anchor_hash,
      acknowledgementKey,
      acknowledgementKeyId,
    );
    const responseRequestId = response.headers.get("x-request-id")?.slice(0, 200) || null;

    const { data: receiptId, error: receiptError } = await service.rpc(
      "record_security_anchor_receipt_v3",
      {
        p_protocol: acknowledgement.protocol,
        p_anchor_hash: anchor.anchor_hash,
        p_previous_anchor_hash: acknowledgement.previous_anchor_hash,
        p_provider: sink.hostname,
        p_external_reference: acknowledgement.external_reference,
        p_payload_sha256: payloadHash,
        // Preserve the exact signed timestamp text. Normalizing it before the
        // RPC would change the canonical HMAC payload.
        p_acknowledged_at_text: acknowledgement.acknowledged_at,
        p_acknowledgement_key_id: acknowledgement.key_id,
        p_acknowledgement_nonce: acknowledgement.nonce,
        p_receipt_signature: acknowledgement.signature,
        p_metadata: {
          anchor_date: anchorDate,
          exported_at: exportedAt,
          response_status: response.status,
          response_request_id: responseRequestId,
          acknowledgement_protocol: acknowledgement.protocol,
          acknowledged_previous_anchor_hash: acknowledgement.previous_anchor_hash,
        },
      },
    );
    if (receiptError) {
      console.error("Security anchor receipt write failed:", receiptError.message);
      throw new HttpError(503, "security_anchor_receipt_unavailable");
    }

    await recordSecurityEvent(req, {
      eventType: "security.anchor_exported",
      category: "detection",
      severity: "medium",
      outcome: "success",
      principal,
      actorType: principal ? undefined : "service",
      action: "export_security_anchor",
      resourceType: "security.event_chain_anchor",
      resourceId: anchor.anchor_hash,
      metadata: {
        anchor_date: anchorDate,
        external_provider: sink.hostname,
        external_reference: acknowledgement.external_reference,
        acknowledgement_key_id: acknowledgement.key_id,
        acknowledged_previous_anchor_hash: acknowledgement.previous_anchor_hash,
        payload_sha256: payloadHash,
        receipt_id: receiptId,
      },
    });

    return jsonResponse(req, {
      anchor,
      external_receipt: true,
      receipt_id: receiptId,
    });
  } catch (error) {
    return errorResponse(req, error);
  }
});
