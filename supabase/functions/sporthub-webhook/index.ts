import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import {
  enforceRateLimit,
  getClientIp,
  getServiceClient,
  HttpError,
  recordSecurityEvent,
  requirePost,
} from "../_shared/security.ts";

const MAX_WEBHOOK_BYTES = 64 * 1024;
const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;
const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._~:-]*$/;
const SAFE_EVENT_TYPE = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const encoder = new TextEncoder();

type SportHubActivityData = {
  session_id?: unknown;
  booking_id?: unknown;
  user_id?: unknown;
  activity_type?: unknown;
  sport_type?: unknown;
  venue_name?: unknown;
  starts_at?: unknown;
  ends_at?: unknown;
  duration_minutes?: unknown;
  calories_burned?: unknown;
  status?: unknown;
};

type SportHubWebhookPayload = {
  type?: unknown;
  event_type?: unknown;
  id?: unknown;
  event_id?: unknown;
  created_at?: unknown;
  user_id?: unknown;
  data?: unknown;
};

type NormalizedActivity = {
  externalSessionId: string;
  activityType: string;
  venueName: string | null;
  startsAt: Date;
  endsAt: Date | null;
  durationMinutes: number | null;
  caloriesBurned: number | null;
  status: string;
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(leftValue: string, rightValue: string): boolean {
  const left = encoder.encode(leftValue);
  const right = encoder.encode(rightValue);
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left[index] || 0) ^ (right[index] || 0);
  }
  return mismatch === 0;
}

async function createSignature(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
}

async function verifySignature(
  payload: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature) return false;
  const normalized = signature.startsWith("sha256=")
    ? signature.slice(7)
    : signature;
  if (!/^[0-9a-f]{64}$/i.test(normalized)) return false;
  return constantTimeEqual(
    normalized.toLowerCase(),
    await createSignature(payload, secret),
  );
}

async function readWebhookBody(req: Request): Promise<string> {
  const declaredLength = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BYTES) {
    throw new HttpError(413, "request_too_large");
  }
  if (!req.body) throw new HttpError(400, "invalid_json");

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_WEBHOOK_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new HttpError(413, "request_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return Array.from(value)
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint < 32 || codePoint === 127 ? " " : character;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function readIdentifier(value: unknown, maxLength: number): string {
  const normalized = cleanText(value, maxLength + 1);
  if (
    !normalized ||
    normalized.length > maxLength ||
    !SAFE_IDENTIFIER.test(normalized)
  ) {
    throw new HttpError(422, "invalid_external_identifier");
  }
  return normalized;
}

function readOptionalInteger(
  value: unknown,
  minimum: number,
  maximum: number,
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new HttpError(422, "invalid_activity_data");
  }
  return parsed;
}

function readTimestamp(value: unknown, optional = false): Date | null {
  if (optional && (value === null || value === undefined || value === "")) {
    return null;
  }
  if (typeof value !== "string" || value.length > 64) {
    throw new HttpError(422, "invalid_activity_timestamp");
  }
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new HttpError(422, "invalid_activity_timestamp");
  }
  const now = Date.now();
  if (
    timestamp.getTime() < now - 5 * 365 * 24 * 60 * 60 * 1000 ||
    timestamp.getTime() > now + 2 * 365 * 24 * 60 * 60 * 1000
  ) {
    throw new HttpError(422, "activity_timestamp_out_of_range");
  }
  return timestamp;
}

function normalizeStatus(eventType: string, supplied: unknown): string {
  const value = cleanText(supplied, 30).toLowerCase();
  if (value === "cancelled" || eventType.endsWith(".cancelled")) {
    return "cancelled";
  }
  if (value === "completed" || eventType.endsWith(".completed")) {
    return "completed";
  }
  if (value === "confirmed" || eventType.endsWith(".confirmed")) {
    return "confirmed";
  }
  if (value === "no_show" || eventType.endsWith(".no_show")) return "no_show";
  return "booked";
}

function normalizeActivity(
  data: SportHubActivityData,
  eventType: string,
): NormalizedActivity | null {
  const rawSessionId = data.session_id ?? data.booking_id;
  const rawActivityType = data.activity_type ?? data.sport_type;
  const hasActivityData = [rawSessionId, rawActivityType, data.starts_at]
    .some((value) => value !== null && value !== undefined && value !== "");
  if (!hasActivityData) return null;
  if (!rawSessionId || !rawActivityType || !data.starts_at) {
    throw new HttpError(422, "incomplete_activity_data");
  }

  const externalSessionId = readIdentifier(rawSessionId, 200);
  const activityType = cleanText(rawActivityType, 101);
  if (!activityType || activityType.length > 100) {
    throw new HttpError(422, "invalid_activity_data");
  }

  const startsAt = readTimestamp(data.starts_at);
  const endsAt = readTimestamp(data.ends_at, true);
  if (!startsAt || (endsAt && endsAt < startsAt)) {
    throw new HttpError(422, "invalid_activity_timestamp");
  }

  let durationMinutes = readOptionalInteger(data.duration_minutes, 1, 1440);
  if (durationMinutes === null && endsAt) {
    const derived = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
    if (derived < 1 || derived > 1440) {
      throw new HttpError(422, "invalid_activity_data");
    }
    durationMinutes = derived;
  }

  return {
    externalSessionId,
    activityType,
    venueName: cleanText(data.venue_name, 200) || null,
    startsAt,
    endsAt,
    durationMinutes,
    caloriesBurned: readOptionalInteger(data.calories_burned, 0, 20_000),
    status: normalizeStatus(eventType, data.status),
  };
}

async function recordRejectedWebhook(
  req: Request,
  eventType: string,
  severity: "medium" | "high",
): Promise<void> {
  await recordSecurityEvent(req, {
    eventType,
    category: "detection",
    severity,
    source: "provider",
    outcome: "blocked",
    actorType: "service",
    action: "receive_sporthub_webhook",
    resourceType: "partner.webhook",
    resourceId: "sporthub",
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 405,
      headers: { Allow: "POST", "Cache-Control": "no-store" },
    });
  }

  try {
    requirePost(req);
    const contentType = (req.headers.get("content-type") || "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
    if (contentType !== "application/json") {
      throw new HttpError(415, "application_json_required");
    }

    await enforceRateLimit(
      req,
      "sporthub-webhook:ip",
      getClientIp(req) || "unknown",
      240,
      60,
    );

    const secret = Deno.env.get("SPORTHUB_WEBHOOK_SECRET") || "";
    if (secret.length < 32 || secret.length > 4096) {
      throw new HttpError(503, "webhook_not_configured");
    }

    const timestamp = req.headers.get("x-sporthub-timestamp");
    const signature = req.headers.get("x-sporthub-signature");
    if (!timestamp || !/^\d{10,13}$/.test(timestamp)) {
      await recordRejectedWebhook(req, "webhook.sporthub.timestamp_rejected", "medium");
      return response({ error: "missing_timestamp" }, 401);
    }

    const timestampMs = timestamp.length === 10
      ? Number(timestamp) * 1000
      : Number(timestamp);
    if (
      !Number.isFinite(timestampMs) ||
      Math.abs(Date.now() - timestampMs) > MAX_TIMESTAMP_SKEW_MS
    ) {
      await recordRejectedWebhook(req, "webhook.sporthub.stale_request_rejected", "high");
      return response({ error: "stale_request" }, 401);
    }

    const rawBody = await readWebhookBody(req);
    if (!await verifySignature(`${timestamp}.${rawBody}`, signature, secret)) {
      await recordRejectedWebhook(req, "webhook.sporthub.signature_rejected", "high");
      return response({ error: "invalid_signature" }, 401);
    }

    let payload: SportHubWebhookPayload;
    try {
      const parsed: unknown = JSON.parse(rawBody);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("invalid");
      }
      payload = parsed as SportHubWebhookPayload;
    } catch {
      throw new HttpError(400, "invalid_json");
    }

    const rawEventType = payload.type ?? payload.event_type;
    const eventType = cleanText(rawEventType, 81);
    if (
      !eventType ||
      eventType.length > 80 ||
      !SAFE_EVENT_TYPE.test(eventType)
    ) {
      throw new HttpError(422, "invalid_event_type");
    }
    const eventId = readIdentifier(
      req.headers.get("x-sporthub-event-id") ?? payload.id ?? payload.event_id,
      200,
    );

    const data: SportHubActivityData = payload.data &&
        typeof payload.data === "object" &&
        !Array.isArray(payload.data)
      ? payload.data as SportHubActivityData
      : {};
    const externalUserId = readIdentifier(data.user_id ?? payload.user_id, 200);
    const activity = normalizeActivity(data, eventType);
    const occurredAt = payload.created_at === undefined
      ? new Date(timestampMs)
      : readTimestamp(payload.created_at);
    if (!occurredAt) throw new HttpError(422, "invalid_event_timestamp");

    const service = getServiceClient();
    const { data: integration, error: integrationError } = await service
      .from("partner_integrations")
      .select("id,user_id,consent_status")
      .eq("partner", "sporthub")
      .eq("external_user_id", externalUserId)
      .maybeSingle();
    if (integrationError) throw new HttpError(503, "integration_lookup_failed");
    if (!integration || integration.consent_status !== "linked") {
      throw new HttpError(404, "linked_user_not_found");
    }

    const minimizedEventPayload = {
      source: "sporthub_webhook",
      projected: Boolean(activity),
      session_id: activity?.externalSessionId || null,
      activity_type: activity?.activityType || null,
      status: activity?.status || null,
      starts_at: activity?.startsAt.toISOString() || null,
    };
    const { data: ingestionResult, error: ingestionError } = await service.rpc(
      "ingest_sporthub_webhook_event",
      {
        p_user_id: integration.user_id,
        p_external_user_id: externalUserId,
        p_event_type: eventType,
        p_external_event_id: eventId,
        p_occurred_at: occurredAt.toISOString(),
        p_event_payload: minimizedEventPayload,
        p_activity: activity
          ? {
            external_session_id: activity.externalSessionId,
            activity_type: activity.activityType,
            venue_name: activity.venueName,
            starts_at: activity.startsAt.toISOString(),
            ends_at: activity.endsAt?.toISOString() || null,
            duration_minutes: activity.durationMinutes,
            calories_burned: activity.caloriesBurned,
            status: activity.status,
            source: "webhook",
          }
          : null,
      },
    );
    if (ingestionError) {
      console.error("SportHub webhook ingestion rejected", { code: ingestionError.code });
      throw new HttpError(409, "webhook_ingestion_failed");
    }
    if (ingestionResult?.duplicate) {
      await recordSecurityEvent(req, {
        eventType: "webhook.sporthub.replay_ignored",
        category: "detection",
        severity: "high",
        source: "provider",
        outcome: "blocked",
        actorType: "service",
        actorUserId: integration.user_id,
        action: "ignore_webhook_replay",
        resourceType: "partner.event",
        resourceId: eventId,
        metadata: { partner: "sporthub", event_type: eventType },
      });
      return response({ ok: true, duplicate: true, projected: false });
    }

    if (!activity) {
      return response({
        ok: true,
        accepted: true,
        projected: false,
        reason: "non_activity_event",
      }, 202);
    }

    await recordSecurityEvent(req, {
      eventType: "data_change.sporthub_activity_projected",
      category: "data_change",
      severity: "info",
      source: "provider",
      outcome: "success",
      actorType: "service",
      actorUserId: integration.user_id,
      action: "project_sporthub_activity",
      resourceType: "partner.event",
      resourceId: eventId,
      metadata: { partner: "sporthub", event_type: eventType, status: activity.status },
    });

    return response({
      ok: true,
      duplicate: false,
      projected: true,
      status: activity.status,
    });
  } catch (error) {
    if (error instanceof HttpError) return response({ error: error.code }, error.status);
    console.error("Unexpected SportHub webhook failure");
    return response({ error: "internal_error" }, 500);
  }
});
