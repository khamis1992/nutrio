import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (Deno.env.get("ALLOW_PAYMENT_SIMULATION") !== "true") {
    return jsonResponse({ error: "Payment simulation is disabled" }, 403);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Service is not configured" }, 503);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const token = req.headers
      .get("Authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim();
    if (!token) return jsonResponse({ error: "Unauthorized" }, 401);

    const {
      data: { user: caller },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) return jsonResponse({ error: "Unauthorized" }, 401);

    const { data: adminRole, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) throw roleError;
    if (!adminRole) return jsonResponse({ error: "Forbidden" }, 403);

    const body = await req.json();
    const userId = typeof body.user_id === "string" ? body.user_id : "";
    const amount = Number(body.amount);
    const paymentMethod =
      typeof body.payment_method === "string"
        ? body.payment_method
        : "simulation";

    if (!userId || !Number.isFinite(amount) || amount <= 0 || amount > 100000) {
      return jsonResponse({ error: "Invalid user_id or amount" }, 400);
    }
    if (body.simulation_mode === false) {
      return jsonResponse(
        { error: "Use the configured payment gateway for real payments" },
        400,
      );
    }

    const { data: targetProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!targetProfile) return jsonResponse({ error: "User not found" }, 404);

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .insert({
        user_id: userId,
        payment_type: "wallet_topup",
        amount,
        currency: "QAR",
        status: "pending",
        payment_method: paymentMethod,
        gateway: "simulation",
      })
      .select()
      .single();
    if (paymentError) throw paymentError;

    const reference = `SIM-${crypto.randomUUID()}`;
    const { error: walletError } = await supabaseAdmin.rpc("credit_wallet", {
      p_user_id: userId,
      p_amount: amount,
      p_type: "credit",
      p_reference_type: "wallet_topup",
      p_reference_id: payment.id,
      p_description: "Admin payment simulation",
    });

    if (walletError) {
      await supabaseAdmin
        .from("payments")
        .update({
          status: "failed",
          gateway_response: { error: "Wallet credit failed" },
        })
        .eq("id", payment.id);
      throw walletError;
    }

    const { error: completeError } = await supabaseAdmin
      .from("payments")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        gateway_reference: reference,
      })
      .eq("id", payment.id);
    if (completeError) throw completeError;

    return jsonResponse({
      success: true,
      payment_id: payment.id,
      transaction_id: reference,
      message: "Payment simulation completed",
    });
  } catch (error) {
    console.error("simulate-payment failed", getErrorMessage(error));
    return jsonResponse({ error: "Unable to simulate payment" }, 500);
  }
});
