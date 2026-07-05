import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sporthub-signature, x-sporthub-event-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SportHubWebhookPayload = {
  type?: string;
  event_type?: string;
  id?: string;
  event_id?: string;
  created_at?: string;
  data?: Record<string, unknown>;
  user_id?: string;
};

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string) {
  const left = encoder.encode(a);
  const right = encoder.encode(b);

  if (left.length !== right.length) return false;

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left[index] ^ right[index];
  }

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
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toHex(signature);
}

async function verifySignature(payload: string, signature: string | null, secret: string) {
  if (!signature) return false;

  const normalized = signature.startsWith("sha256=")
    ? signature.slice("sha256=".length)
    : signature;
  const expected = await createSignature(payload, secret);

  return constantTimeEqual(normalized.toLowerCase(), expected);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const webhookSecret = Deno.env.get("SPORTHUB_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("SPORTHUB_WEBHOOK_SECRET is not configured");
    return new Response(JSON.stringify({ error: "Webhook not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-sporthub-signature");
  const isVerified = await verifySignature(rawBody, signature, webhookSecret);

  if (!isVerified) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: SportHubWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as SportHubWebhookPayload;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Supabase environment missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const eventType = payload.type || payload.event_type || "sporthub.webhook.received";
  const eventId = req.headers.get("x-sporthub-event-id") || payload.id || payload.event_id || null;

  const { error } = await supabase.from("partner_events").insert({
    user_id: null,
    partner: "sporthub",
    event_type: eventType,
    external_event_id: eventId,
    occurred_at: payload.created_at || new Date().toISOString(),
    payload: {
      source: "sporthub_webhook",
      ...payload,
    },
  });

  if (error) {
    if (error.code === "23505") {
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.error("Failed to store SportHub webhook:", error);
    return new Response(JSON.stringify({ error: "Could not store webhook" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
