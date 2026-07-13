import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function corsHeaders(req: Request): Record<string, string> {
  const requestOrigin = req.headers.get("Origin");
  const origins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowOrigin = requestOrigin && origins.includes(requestOrigin)
    ? requestOrigin
    : origins[0] ?? "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

function respond(req: Request, body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: corsHeaders(req) });
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return respond(req, { error: "METHOD_NOT_ALLOWED" }, 405);
  }

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization || !supabaseUrl || !anonKey || !serviceRoleKey) {
      return respond(req, { error: "AUTHENTICATION_REQUIRED" }, 401);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) {
      return respond(req, { error: "AUTHENTICATION_REQUIRED" }, 401);
    }

    const { data: adminRole, error: roleError } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError || !adminRole) {
      return respond(req, { error: "ADMIN_REQUIRED" }, 403);
    }

    const body = await req.json() as { payout_id?: string };
    if (!body.payout_id) {
      return respond(req, { error: "PAYOUT_ID_REQUIRED" }, 400);
    }

    const { data: payout, error: payoutError } = await serviceClient
      .from("affiliate_payouts")
      .select("id,user_id,amount,status,payout_method,notes")
      .eq("id", body.payout_id)
      .single();
    if (payoutError || !payout) {
      return respond(req, { error: "PAYOUT_NOT_FOUND" }, 404);
    }
    if (!["processing", "completed", "rejected"].includes(payout.status)) {
      return respond(req, { error: "PAYOUT_STATUS_NOT_NOTIFIABLE" }, 409);
    }

    const { data: authUser, error: userError } = await serviceClient.auth.admin.getUserById(payout.user_id);
    if (userError || !authUser.user?.email) {
      return respond(req, { error: "RECIPIENT_NOT_FOUND" }, 404);
    }

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("full_name,affiliate_balance")
      .eq("user_id", payout.user_id)
      .single();

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return respond(req, { error: "EMAIL_PROVIDER_NOT_CONFIGURED" }, 503);
    }

    const statusLabel = payout.status === "processing"
      ? "approved for transfer"
      : payout.status === "completed"
        ? "transferred"
        : "rejected";
    const amount = Number(payout.amount || 0);
    const appUrl = Deno.env.get("APP_URL") ?? "";
    const resend = new Resend(resendKey);
    const { error: emailError } = await resend.emails.send({
      from: Deno.env.get("PAYOUT_EMAIL_FROM") ?? "Nutrio <noreply@nutrio.qa>",
      to: [authUser.user.email],
      subject: `Affiliate payout ${statusLabel}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a">
          <h1 style="font-size:24px">Payout ${statusLabel}</h1>
          <p>Hi ${escapeHtml(profile?.full_name || "Affiliate Partner")},</p>
          <p>Your QAR ${amount.toFixed(2)} payout is now <strong>${statusLabel}</strong>.</p>
          <p>Method: ${escapeHtml((payout.payout_method || "bank_transfer").replaceAll("_", " "))}</p>
          ${payout.status === "rejected" && payout.notes ? `<p>Reason: ${escapeHtml(payout.notes)}</p>` : ""}
          <p>Available balance: QAR ${Number(profile?.affiliate_balance || 0).toFixed(2)}</p>
          ${appUrl ? `<p><a href="${escapeHtml(appUrl)}/affiliate">View payout history</a></p>` : ""}
        </div>
      `,
    });
    if (emailError) {
      console.error("Payout email failed", emailError);
      return respond(req, { error: "EMAIL_SEND_FAILED" }, 502);
    }

    return respond(req, { success: true, payout_id: payout.id });
  } catch (error) {
    console.error("send-payout-notification failed", error);
    return respond(req, { error: error instanceof Error ? error.message : "UNKNOWN_ERROR" }, 500);
  }
});
