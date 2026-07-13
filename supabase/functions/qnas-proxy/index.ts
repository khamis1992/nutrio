import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const QNAS_BASE = "https://qnas.qa";
const allowedPaths = [
  /^\/get_zones$/,
  /^\/get_streets\/\d+$/,
  /^\/get_buildings\/\d+\/\d+$/,
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const qnasToken = Deno.env.get("QNAS_TOKEN");
  const qnasDomain = Deno.env.get("QNAS_DOMAIN");
  if (!supabaseUrl || !serviceRoleKey || !qnasToken || !qnasDomain) {
    console.error("qnas-proxy: missing service configuration");
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
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: adminRole, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) throw roleError;
    if (!adminRole) return jsonResponse({ error: "Forbidden" }, 403);

    const requestUrl = new URL(req.url);
    let qnasPath = requestUrl.searchParams.get("path");
    if (!qnasPath && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      qnasPath = typeof body.path === "string" ? body.path : null;
    }

    if (!qnasPath || !allowedPaths.some((pattern) => pattern.test(qnasPath))) {
      return jsonResponse({ error: "Unsupported QNAS path" }, 400);
    }

    const qnasUrl = new URL(qnasPath, QNAS_BASE);
    if (qnasUrl.origin !== QNAS_BASE) {
      return jsonResponse({ error: "Unsupported QNAS host" }, 400);
    }

    const qnasResponse = await fetch(qnasUrl, {
      headers: {
        Accept: "application/json",
        "X-Token": qnasToken,
        "X-Domain": qnasDomain,
      },
    });
    const responseBody = await qnasResponse.text();

    return new Response(responseBody, {
      status: qnasResponse.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("qnas-proxy failed", error);
    return jsonResponse({ error: "QNAS proxy request failed" }, 500);
  }
});
