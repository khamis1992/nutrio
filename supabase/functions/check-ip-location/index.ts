import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_COUNTRY = "QA";
const IP_LOOKUP_BASE = "https://ipwho.is";
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

function getClientIp(req: Request): string | null {
  return (
    req.headers.get("cf-connecting-ip")?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null
  );
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
    return jsonResponse(
      {
        allowed: false,
        blocked: false,
        ip: "unknown",
        reason: "Location verification is not configured",
      },
      503,
    );
  }

  try {
    const clientIp = getClientIp(req);
    if (!clientIp) {
      return jsonResponse({
        allowed: false,
        blocked: false,
        ip: "unknown",
        reason: "Unable to determine client IP",
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: blocked, error: blockedError } = await supabaseAdmin.rpc(
      "is_ip_blocked",
      { p_ip: clientIp },
    );
    if (blockedError) throw blockedError;
    if (blocked) {
      return jsonResponse({
        allowed: false,
        blocked: true,
        ip: clientIp,
        reason: "IP is blocked",
      });
    }

    let countryCode =
      req.headers.get("cf-ipcountry")?.trim().toUpperCase() || null;
    let country: string | null = null;
    let city: string | null = null;

    if (!countryCode || countryCode === "XX") {
      const geoResponse = await fetch(
        `${IP_LOOKUP_BASE}/${encodeURIComponent(clientIp)}?fields=success,country_code,country,city`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (!geoResponse.ok) {
        throw new Error(`IP lookup returned ${geoResponse.status}`);
      }

      const geoData = await geoResponse.json();
      if (geoData.success !== true || typeof geoData.country_code !== "string") {
        return jsonResponse({
          allowed: false,
          blocked: false,
          ip: clientIp,
          reason: "Unable to verify location",
        });
      }

      countryCode = geoData.country_code.toUpperCase();
      country = typeof geoData.country === "string" ? geoData.country : null;
      city = typeof geoData.city === "string" ? geoData.city : null;
    }

    return jsonResponse({
      allowed: countryCode === ALLOWED_COUNTRY,
      blocked: false,
      ip: clientIp,
      countryCode,
      country,
      city,
      ...(countryCode === ALLOWED_COUNTRY
        ? {}
        : { reason: "Nutrio is currently available in Qatar only" }),
    });
  } catch (error) {
    console.error("check-ip-location failed", error);
    return jsonResponse(
      {
        allowed: false,
        blocked: false,
        ip: "unknown",
        reason: "Location verification is temporarily unavailable",
      },
      503,
    );
  }
});
