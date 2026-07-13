import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-sporthub-signature, x-sporthub-event-id, x-sporthub-timestamp",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string) {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left[index] ^ right[index];
  return mismatch === 0;
}

async function createSignature(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
}

async function verifySignature(payload: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const normalized = signature.startsWith("sha256=") ? signature.slice(7) : signature;
  return constantTimeEqual(normalized.toLowerCase(), await createSignature(payload, secret));
}

function normalizeStatus(eventType: string, supplied?: string) {
  const value = (supplied || "").toLowerCase();
  if (value === "cancelled" || eventType.endsWith(".cancelled")) return "cancelled";
  if (value === "completed" || eventType.endsWith(".completed")) return "completed";
  if (value === "confirmed" || eventType.endsWith(".confirmed")) return "confirmed";
  if (value === "no_show" || eventType.endsWith(".no_show")) return "no_show";
  return "booked";
}

function qatarDate(isoTimestamp: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Qatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoTimestamp));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "method_not_allowed" }, 405);

  const secret = Deno.env.get("SPORTHUB_WEBHOOK_SECRET");
  if (!secret) return response({ error: "webhook_not_configured" }, 500);

  const timestamp = req.headers.get("x-sporthub-timestamp");
  const signature = req.headers.get("x-sporthub-signature");
  if (!timestamp || !/^\d{10,13}$/.test(timestamp)) return response({ error: "missing_timestamp" }, 401);
  const timestampMs = timestamp.length === 10 ? Number(timestamp) * 1000 : Number(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
    return response({ error: "stale_request" }, 401);
  }

  const rawBody = await req.text();
  if (!await verifySignature(`${timestamp}.${rawBody}`, signature, secret)) {
    return response({ error: "invalid_signature" }, 401);
  }

  let payload: SportHubWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as SportHubWebhookPayload;
  } catch {
    return response({ error: "invalid_json" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return response({ error: "server_not_configured" }, 500);
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const eventType = payload.type || payload.event_type;
  const eventId = req.headers.get("x-sporthub-event-id") || payload.id || payload.event_id;
  if (!eventType || !eventId) return response({ error: "event_type_and_id_required" }, 422);

  const data = payload.data || {};
  const externalUserId = data.user_id || payload.user_id;
  if (!externalUserId) return response({ error: "user_id_required" }, 422);

  const { data: integration, error: integrationError } = await supabase.from("partner_integrations")
    .select("id,user_id,consent_status")
    .eq("partner", "sporthub")
    .eq("external_user_id", externalUserId)
    .maybeSingle();
  if (integrationError) return response({ error: "integration_lookup_failed" }, 500);
  if (!integration || integration.consent_status !== "linked") {
    return response({ error: "linked_user_not_found" }, 404);
  }

  const { error: eventError } = await supabase.from("partner_events").insert({
    user_id: integration.user_id,
    partner: "sporthub",
    event_type: eventType,
    external_event_id: eventId,
    occurred_at: payload.created_at || new Date(timestampMs).toISOString(),
    payload: { source: "sporthub_webhook", ...payload },
  });
  const duplicateEvent = eventError?.code === "23505";
  if (eventError && !duplicateEvent) return response({ error: "event_storage_failed" }, 500);

  const externalSessionId = data.session_id || data.booking_id;
  const activityType = data.activity_type || data.sport_type;
  if (!externalSessionId || !activityType || !data.starts_at) {
    return response({ ok: true, accepted: true, projected: false, reason: "non_activity_event" }, 202);
  }

  const status = normalizeStatus(eventType, data.status);
  const startsAt = new Date(data.starts_at);
  if (Number.isNaN(startsAt.getTime())) return response({ error: "invalid_starts_at" }, 422);
  const endsAt = data.ends_at ? new Date(data.ends_at) : null;
  const derivedDuration = endsAt && !Number.isNaN(endsAt.getTime())
    ? Math.max(1, Math.round((endsAt.getTime() - startsAt.getTime()) / 60000))
    : null;
  const duration = data.duration_minutes || derivedDuration;

  const { data: partnerSession, error: sessionError } = await supabase.from("partner_activity_sessions").upsert({
    user_id: integration.user_id,
    partner: "sporthub",
    external_session_id: externalSessionId,
    external_user_id: externalUserId,
    activity_type: activityType,
    venue_name: data.venue_name || null,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt.toISOString() : null,
    duration_minutes: duration || null,
    calories_burned: data.calories_burned ?? null,
    status,
    raw_payload: payload,
    updated_at: new Date().toISOString(),
  }, { onConflict: "partner,external_session_id" }).select("id,workout_session_id").single();
  if (sessionError || !partnerSession) return response({ error: "session_projection_failed" }, 500);

  if (status === "completed") {
    const { data: workout, error: workoutError } = await supabase.from("workout_sessions").upsert({
      user_id: integration.user_id,
      session_date: qatarDate(startsAt.toISOString()),
      workout_type: activityType,
      duration_minutes: duration || 1,
      calories_burned: data.calories_burned ?? 0,
      source: "sporthub",
      source_external_id: externalSessionId,
      confirmed: true,
      created_at: startsAt.toISOString(),
      external_metadata: { venue_name: data.venue_name || null, sporthub_event_id: eventId },
    }, { onConflict: "source,source_external_id" }).select("id").single();
    if (workoutError || !workout) return response({ error: "workout_projection_failed" }, 500);
    await supabase.from("partner_activity_sessions").update({ workout_session_id: workout.id }).eq("id", partnerSession.id);
  } else if (status === "cancelled" || status === "no_show") {
    await supabase.from("workout_sessions")
      .delete()
      .eq("source", "sporthub")
      .eq("source_external_id", externalSessionId);
    await supabase.from("partner_activity_sessions").update({ workout_session_id: null }).eq("id", partnerSession.id);
  }

  await supabase.from("partner_integrations").update({
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", integration.id);

  return response({ ok: true, duplicate: duplicateEvent, projected: true, status });
});
