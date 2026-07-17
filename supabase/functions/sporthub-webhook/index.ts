import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import {
  getCorsHeaders,
  getServiceClient,
  HttpError,
  recordSecurityEvent,
  requirePost,
} from "../_shared/security.ts";

const MAX_WEBHOOK_BYTES = 256 * 1024;

type SportHubActivityData = {
  session_id?: string;
  booking_id?: string;
  user_id?: string;
  activity_type?: string;
  sport_type?: string;
  venue_name?: string;
  starts_at?: string;
  ends_at?: string;
  duration_minutes?: number;
  calories_burned?: number;
  status?: string;
};

type SportHubWebhookPayload = {
  type?: string;
  event_type?: string;
  id?: string;
  event_id?: string;
  created_at?: string;
  user_id?: string;
  data?: SportHubActivityData;
};

const encoder = new TextEncoder();

function webhookHeaders(req: Request): Record<string, string> {
  return {
    ...getCorsHeaders(req),
    "Access-Control-Allow-Headers":
      "content-type, x-sporthub-signature, x-sporthub-event-id, x-sporthub-timestamp, x-request-id, x-correlation-id",
  };
}

function response(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...webhookHeaders(req),
      "Content-Type": "application/json; charset=utf-8",
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

async function createSignature(
  payload: string,
  secret: string,
): Promise<string> {
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

function normalizeStatus(eventType: string, supplied?: string): string {
  const value = (supplied || "").toLowerCase();
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

function qatarDate(isoTimestamp: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Qatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoTimestamp));
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
    return new Response(null, { status: 204, headers: webhookHeaders(req) });
  }

  try {
    requirePost(req);

    const secret = Deno.env.get("SPORTHUB_WEBHOOK_SECRET");
    if (!secret) return response(req, { error: "webhook_not_configured" }, 500);

    const timestamp = req.headers.get("x-sporthub-timestamp");
    const signature = req.headers.get("x-sporthub-signature");
    if (!timestamp || !/^\d{10,13}$/.test(timestamp)) {
      await recordRejectedWebhook(
        req,
        "webhook.sporthub.timestamp_rejected",
        "medium",
      );
      return response(req, { error: "missing_timestamp" }, 401);
    }

    const timestampMs = timestamp.length === 10
      ? Number(timestamp) * 1000
      : Number(timestamp);
    if (
      !Number.isFinite(timestampMs) ||
      Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000
    ) {
      await recordRejectedWebhook(
        req,
        "webhook.sporthub.stale_request_rejected",
        "high",
      );
      return response(req, { error: "stale_request" }, 401);
    }

    const rawBody = await readWebhookBody(req);
    if (!await verifySignature(`${timestamp}.${rawBody}`, signature, secret)) {
      await recordRejectedWebhook(
        req,
        "webhook.sporthub.signature_rejected",
        "high",
      );
      return response(req, { error: "invalid_signature" }, 401);
    }

    let payload: SportHubWebhookPayload;
    try {
      const parsed: unknown = JSON.parse(rawBody);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return response(req, { error: "invalid_json" }, 400);
      }
      payload = parsed as SportHubWebhookPayload;
    } catch {
      return response(req, { error: "invalid_json" }, 400);
    }

    let supabase;
    try {
      supabase = getServiceClient();
    } catch {
      return response(req, { error: "server_not_configured" }, 500);
    }

    const rawEventType = payload.type || payload.event_type;
    const rawEventId = req.headers.get("x-sporthub-event-id") || payload.id ||
      payload.event_id;
    if (typeof rawEventType !== "string" || typeof rawEventId !== "string") {
      return response(req, { error: "event_type_and_id_required" }, 422);
    }
    const eventType = rawEventType.trim();
    const eventId = rawEventId.trim();
    if (
      !eventType || !eventId || eventType.length > 160 || eventId.length > 200
    ) {
      return response(req, { error: "event_type_and_id_required" }, 422);
    }

    const data = payload.data && typeof payload.data === "object"
      ? payload.data
      : {};
    const rawExternalUserId = data.user_id || payload.user_id;
    if (typeof rawExternalUserId !== "string" || !rawExternalUserId.trim()) {
      return response(req, { error: "user_id_required" }, 422);
    }
    const externalUserId = rawExternalUserId.trim();
    if (externalUserId.length > 200) {
      return response(req, { error: "user_id_required" }, 422);
    }

    const { data: integration, error: integrationError } = await supabase
      .from("partner_integrations")
      .select("id,user_id,consent_status")
      .eq("partner", "sporthub")
      .eq("external_user_id", externalUserId)
      .maybeSingle();
    if (integrationError) {
      return response(req, { error: "integration_lookup_failed" }, 500);
    }
    if (!integration || integration.consent_status !== "linked") {
      return response(req, { error: "linked_user_not_found" }, 404);
    }

    const { error: eventError } = await supabase.from("partner_events").insert({
      user_id: integration.user_id,
      partner: "sporthub",
      event_type: eventType,
      external_event_id: eventId,
      occurred_at: payload.created_at || new Date(timestampMs).toISOString(),
      payload: { ...payload, source: "sporthub_webhook" },
    });
    const duplicateEvent = eventError?.code === "23505";
    if (eventError && !duplicateEvent) {
      return response(req, { error: "event_storage_failed" }, 500);
    }

    if (duplicateEvent) {
      await recordSecurityEvent(req, {
        eventType: "webhook.sporthub.replay_ignored",
        category: "detection",
        severity: "high",
        source: "provider",
        outcome: "blocked",
        actorType: "anonymous",
        actorUserId: integration.user_id,
        action: "ignore_webhook_replay",
        resourceType: "partner.event",
        resourceId: eventId,
        metadata: { partner: "sporthub", event_type: eventType },
      });
      return response(req, { ok: true, duplicate: true, projected: false });
    }

    const externalSessionId = data.session_id || data.booking_id;
    const activityType = data.activity_type || data.sport_type;
    if (
      typeof externalSessionId !== "string" ||
      typeof activityType !== "string" ||
      typeof data.starts_at !== "string"
    ) {
      return response(
        req,
        {
          ok: true,
          accepted: true,
          projected: false,
          reason: "non_activity_event",
        },
        202,
      );
    }
    if (externalSessionId.length > 200 || activityType.length > 160) {
      return response(req, { error: "invalid_activity_data" }, 422);
    }

    const status = normalizeStatus(eventType, data.status);
    const startsAt = new Date(data.starts_at);
    if (Number.isNaN(startsAt.getTime())) {
      return response(req, { error: "invalid_starts_at" }, 422);
    }
    const endsAt = data.ends_at ? new Date(data.ends_at) : null;
    const derivedDuration = endsAt && !Number.isNaN(endsAt.getTime())
      ? Math.max(1, Math.round((endsAt.getTime() - startsAt.getTime()) / 60000))
      : null;
    const duration = data.duration_minutes || derivedDuration;

    const { data: partnerSession, error: sessionError } = await supabase
      .from("partner_activity_sessions")
      .upsert({
        user_id: integration.user_id,
        partner: "sporthub",
        external_session_id: externalSessionId,
        external_user_id: externalUserId,
        activity_type: activityType,
        venue_name: typeof data.venue_name === "string"
          ? data.venue_name.slice(0, 500)
          : null,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt && !Number.isNaN(endsAt.getTime())
          ? endsAt.toISOString()
          : null,
        duration_minutes: duration || null,
        calories_burned: data.calories_burned ?? null,
        status,
        raw_payload: payload,
        updated_at: new Date().toISOString(),
      }, { onConflict: "partner,external_session_id" })
      .select("id,workout_session_id")
      .single();
    if (sessionError || !partnerSession) {
      return response(req, { error: "session_projection_failed" }, 500);
    }

    if (status === "completed") {
      const { data: workout, error: workoutError } = await supabase
        .from("workout_sessions")
        .upsert({
          user_id: integration.user_id,
          session_date: qatarDate(startsAt.toISOString()),
          workout_type: activityType,
          duration_minutes: duration || 1,
          calories_burned: data.calories_burned ?? 0,
          source: "sporthub",
          source_external_id: externalSessionId,
          confirmed: true,
          created_at: startsAt.toISOString(),
          external_metadata: {
            venue_name: data.venue_name || null,
            sporthub_event_id: eventId,
          },
        }, { onConflict: "source,source_external_id" })
        .select("id")
        .single();
      if (workoutError || !workout) {
        return response(req, { error: "workout_projection_failed" }, 500);
      }
      await supabase
        .from("partner_activity_sessions")
        .update({ workout_session_id: workout.id })
        .eq("id", partnerSession.id);
    } else if (status === "cancelled" || status === "no_show") {
      await supabase
        .from("workout_sessions")
        .delete()
        .eq("source", "sporthub")
        .eq("source_external_id", externalSessionId);
      await supabase
        .from("partner_activity_sessions")
        .update({ workout_session_id: null })
        .eq("id", partnerSession.id);
    }

    await supabase.from("partner_integrations").update({
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", integration.id);

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
      metadata: { partner: "sporthub", event_type: eventType, status },
    });

    return response(req, {
      ok: true,
      duplicate: false,
      projected: true,
      status,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return response(req, { error: error.code }, error.status);
    }
    console.error("Unexpected SportHub webhook failure");
    return response(req, { error: "internal_error" }, 500);
  }
});
