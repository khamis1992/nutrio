import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpgradeRequest {
  subscription_id: string;
  new_tier: string;
  new_billing_interval?: string;
  payment_method: "wallet" | "card";
}

interface UpgradeResponse {
  success: boolean;
  prorated_credit?: number;
  amount_due?: number;
  new_tier?: string;
  new_billing_interval?: string;
  error?: string;
  code?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(jwt);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: UpgradeRequest = await req.json();

    if (!body.subscription_id || !body.new_tier || !body.payment_method) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: subscription_id, new_tier, payment_method" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.payment_method !== "wallet" && body.payment_method !== "card") {
      return new Response(
        JSON.stringify({ error: "Invalid payment_method. Must be 'wallet' or 'card'." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: subscription, error: subError } = await supabaseClient
      .from("subscriptions")
      .select("id, user_id, tier, price")
      .eq("id", body.subscription_id)
      .single();

    if (subError || !subscription) {
      return new Response(
        JSON.stringify({ success: false, error: "Subscription not found", code: "NOT_FOUND" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (subscription.user_id !== user.id) {
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden: not your subscription", code: "FORBIDDEN" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let amountToDebit = 0;

    if (body.payment_method === "wallet") {
      const { data: planData, error: planError } = await supabaseClient
        .from("subscription_plans")
        .select("price_qar")
        .eq("tier", body.new_tier)
        .eq("billing_interval", body.new_billing_interval || "monthly")
        .eq("is_active", true)
        .single();

      if (planError || !planData) {
        return new Response(
          JSON.stringify({ success: false, error: "Target plan not found", code: "PLAN_NOT_FOUND" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      amountToDebit = planData.price_qar;

      const { error: debitError } = await supabaseClient.rpc("debit_wallet", {
        p_user_id: user.id,
        p_amount: amountToDebit,
        p_reference_type: "subscription_upgrade",
        p_reference_id: body.subscription_id,
        p_description: `Subscription upgrade to ${body.new_tier} (${body.new_billing_interval || "monthly"})`,
        p_metadata: null,
      });

      if (debitError) {
        return new Response(
          JSON.stringify({
            success: false,
            error: debitError.message || "Insufficient wallet balance",
            code: "INSUFFICIENT_FUNDS",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { data: upgradeResult, error: upgradeError } = await supabaseClient.rpc(
      "upgrade_subscription",
      {
        p_subscription_id: body.subscription_id,
        p_new_tier: body.new_tier,
        p_new_billing_interval: body.new_billing_interval || null,
      }
    );

    if (upgradeError || !upgradeResult) {
      if (body.payment_method === "wallet" && amountToDebit > 0) {
        await supabaseClient.rpc("credit_wallet", {
          p_user_id: user.id,
          p_amount: amountToDebit,
          p_type: "refund",
          p_reference_type: "subscription_upgrade_refund",
          p_reference_id: body.subscription_id,
          p_description: `Refund: upgrade to ${body.new_tier} failed`,
          p_metadata: null,
        }).catch((refundErr) => {
          console.error("Refund failed after upgrade error:", refundErr);
        });
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: upgradeError?.message || "Upgrade RPC failed",
          code: "UPGRADE_FAILED",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = upgradeResult as { success: boolean; error?: string; code?: string; prorated_credit?: number; amount_due?: number; new_tier?: string; new_billing_interval?: string };

    if (!result.success) {
      if (body.payment_method === "wallet" && amountToDebit > 0) {
        await supabaseClient.rpc("credit_wallet", {
          p_user_id: user.id,
          p_amount: amountToDebit,
          p_type: "refund",
          p_reference_type: "subscription_upgrade_refund",
          p_reference_id: body.subscription_id,
          p_description: `Refund: upgrade to ${body.new_tier} returned success=false`,
          p_metadata: null,
        }).catch((refundErr) => {
          console.error("Refund failed after upgrade error:", refundErr);
        });
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: result.error || "Upgrade failed",
          code: result.code || "UPGRADE_FAILED",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response: UpgradeResponse = {
      success: true,
      prorated_credit: result.prorated_credit,
      amount_due: result.amount_due,
      new_tier: result.new_tier,
      new_billing_interval: result.new_billing_interval,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("upgrade-subscription error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
