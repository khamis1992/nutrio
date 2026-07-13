import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidIpAddress(value: string): boolean {
  const ipv4Parts = value.split(".");
  if (
    ipv4Parts.length === 4 &&
    ipv4Parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
  ) {
    return true;
  }

  return value.includes(":") && /^[0-9a-f:]+$/i.test(value);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Service is not configured" }, 503);
  }

  try {
    const token = req.headers
      .get("Authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim();
    if (!token) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    if (action !== "signup" && action !== "login") {
      return jsonResponse({ error: "Invalid action" }, 400);
    }

    const clientIp =
      req.headers.get("cf-connecting-ip")?.trim() ||
      req.headers.get("x-real-ip")?.trim() ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "";
    if (!isValidIpAddress(clientIp)) {
      return jsonResponse({ error: "Client IP unavailable" }, 422);
    }
    const countryCode = req.headers.get("cf-ipcountry")?.trim() || null;

    const { error } = await supabaseAdmin.from("user_ip_logs").insert({
      user_id: user.id,
      ip_address: clientIp,
      country_code: countryCode,
      country_name: null,
      city: null,
      action,
      user_agent: req.headers.get("user-agent") || "unknown",
    });
    if (error) throw error;

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("log-user-ip failed", error);
    return jsonResponse({ success: false }, 500);
  }
});
