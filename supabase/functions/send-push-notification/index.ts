import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface NotificationPayload {
  notification_id?: string;
  user_id: string;
  title: string;
  message: string;
  type?: string;
  data?: Record<string, string>;
}

interface FCMMessage {
  message: {
    token: string;
    notification: {
      title: string;
      body: string;
    };
    android?: {
      notification: {
        click_action?: string;
        channel_id?: string;
      };
    };
    data?: Record<string, string>;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// JWT helper – generates a short-lived Google OAuth2 access token from the
// service-account private key stored as a Supabase secret.
// ─────────────────────────────────────────────────────────────────────────────
async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);

  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const headerB64 = encode(header);
  const claimB64 = encode(claim);
  const signingInput = `${headerB64}.${claimB64}`;

  // Import the RSA private key
  const pemBody = sa.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const keyData = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${signingInput}.${sigB64}`;

  // Exchange JWT for access token
  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenResp.ok) {
    const err = await tokenResp.text();
    throw new Error(`Failed to get Google access token: ${err}`);
  }

  const tokenData = await tokenResp.json();
  return tokenData.access_token as string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Send a single FCM push notification via the V1 API
// ─────────────────────────────────────────────────────────────────────────────
async function sendFCMNotification(
  accessToken: string,
  projectId: string,
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  const message: FCMMessage = {
    message: {
      token: fcmToken,
      notification: { title, body },
      android: {
        notification: {
          channel_id: "default",
          click_action: "FLUTTER_NOTIFICATION_CLICK",
        },
      },
      ...(data && Object.keys(data).length > 0 ? { data } : {}),
    },
  };

  const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const resp = await fetch(fcmUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    return { success: false, error: errText };
  }

  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Environment variables ─────────────────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT")!;
    const projectId = "nutrio-fuel";

    if (!serviceAccountJson) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT secret is not set");
    }

    // ── Parse request body ────────────────────────────────────────────────
    const payload: NotificationPayload = await req.json();
    const { user_id, title, message, type = "general", data } = payload;

    if (!user_id || !title || !message) {
      return new Response(
        JSON.stringify({ error: "user_id, title, and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Supabase admin client ─────────────────────────────────────────────
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── Fetch active FCM tokens for the user ──────────────────────────────
    const { data: tokens, error: tokensError } = await supabase
      .from("push_tokens")
      .select("token, platform")
      .eq("user_id", user_id)
      .eq("is_active", true);

    if (tokensError) {
      throw new Error(`Failed to fetch push tokens: ${tokensError.message}`);
    }

    if (!tokens || tokens.length === 0) {
      // No tokens – still save the notification in DB but skip push
      await supabase.from("notifications").insert({
        user_id,
        title,
        message,
        type,
        status: "unread",
        data: data ?? {},
      });

      return new Response(
        JSON.stringify({ success: true, message: "No active push tokens found; notification saved to DB only", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Get Google OAuth2 access token ────────────────────────────────────
    const accessToken = await getGoogleAccessToken(serviceAccountJson);

    // ── Send to all active tokens ─────────────────────────────────────────
    const results = await Promise.allSettled(
      tokens.map((t: { token: string; platform: string }) =>
        sendFCMNotification(accessToken, projectId, t.token, title, message, data)
      )
    );

    const sent = results.filter(
      (r) => r.status === "fulfilled" && (r as PromiseFulfilledResult<{ success: boolean }>).value.success
    ).length;

    const failed = results.filter(
      (r) => r.status === "rejected" || (r.status === "fulfilled" && !(r as PromiseFulfilledResult<{ success: boolean }>).value.success)
    );

    // Deactivate tokens that returned UNREGISTERED errors
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === "fulfilled" && !r.value.success) {
        const errText = r.value.error ?? "";
        if (errText.includes("UNREGISTERED") || errText.includes("NOT_FOUND")) {
          await supabase
            .from("push_tokens")
            .update({ is_active: false })
            .eq("token", tokens[i].token);
        }
      }
    }

    // ── Save notification record to DB ────────────────────────────────────
    await supabase.from("notifications").insert({
      user_id,
      title,
      message,
      type,
      status: "unread",
      data: data ?? {},
    });

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        failed: failed.length,
        total_tokens: tokens.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-push-notification error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
