import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface UpgradeRequest {
  subscription_id: string;
  new_plan_id: string;
  payment_method: "wallet" | "card";
  promo_code?: string;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const appUrl = Deno.env.get("APP_URL");

  if (appUrl) {
    try {
      allowedOrigins.push(new URL(appUrl).origin);
    } catch {
      // Invalid deployment configuration will fail closed for browser origins.
    }
  }

  return {
    "Access-Control-Allow-Origin": origin && allowedOrigins.includes(origin)
      ? origin
      : allowedOrigins[0] ?? "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

function json(
  req: Request,
  body: Record<string, unknown>,
  status = 200,
): Response {
  return Response.json(body, { status, headers: corsHeaders(req) });
}

function adminClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVER_CONFIGURATION_MISSING");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function authenticate(req: Request): Promise<User | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !supabaseUrl || !anonKey) return null;

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  return error ? null : data.user;
}

function knownError(message: string): string {
  const codes = [
    "SUBSCRIPTION_NOT_FOUND",
    "PAYMENT_PLAN_NOT_FOUND",
    "SUBSCRIPTION_PLAN_UNCHANGED",
    "PROMOTION_INVALID",
    "PROMOTION_LIMIT_REACHED",
    "PROMOTION_MINIMUM_NOT_MET",
    "PROMOTION_USER_LIMIT_REACHED",
    "WALLET_NOT_FOUND",
    "INSUFFICIENT_WALLET_BALANCE",
  ];

  return codes.find((code) => message.includes(code)) ?? "UPGRADE_FAILED";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return json(req, { success: false, error: "METHOD_NOT_ALLOWED" }, 405);
  }

  try {
    const user = await authenticate(req);
    if (!user) return json(req, { success: false, error: "UNAUTHORIZED" }, 401);

    const body = await req.json().catch(() => null) as UpgradeRequest | null;
    if (
      !body
      || !UUID_PATTERN.test(body.subscription_id ?? "")
      || !UUID_PATTERN.test(body.new_plan_id ?? "")
    ) {
      return json(req, { success: false, error: "INVALID_UPGRADE_REFERENCE" }, 400);
    }

    if (body.payment_method !== "wallet") {
      return json(req, {
        success: false,
        error: "Card payment requires SADAD checkout",
        code: "PAYMENT_REQUIRED",
      }, 402);
    }

    const promoCode = body.promo_code?.trim();
    if (promoCode && promoCode.length > 64) {
      return json(req, { success: false, error: "PROMOTION_INVALID" }, 400);
    }

    const { data, error } = await adminClient().rpc(
      "upgrade_subscription_with_wallet",
      {
        p_user_id: user.id,
        p_subscription_id: body.subscription_id,
        p_plan_id: body.new_plan_id,
        p_promo_code: promoCode || null,
      },
    );

    if (error) {
      const code = knownError(error.message);
      console.error("Atomic subscription upgrade rejected", code);
      return json(req, { success: false, error: code, code });
    }

    return json(req, data as Record<string, unknown>);
  } catch (error) {
    const message = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
    console.error("upgrade-subscription error", message);
    const configurationError = message.endsWith("CONFIGURATION_MISSING");
    return json(
      req,
      { success: false, error: configurationError ? message : "INTERNAL_SERVER_ERROR" },
      configurationError ? 503 : 500,
    );
  }
});
