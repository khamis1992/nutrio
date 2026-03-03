// Edge Function: handle-freeze-request
// Processes subscription freeze requests with validation

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FreezeRequestInput {
  subscription_id: string;
  freeze_start_date: string; // YYYY-MM-DD
  freeze_end_date: string;   // YYYY-MM-DD
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Auth check
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(jwt);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse body
    const { subscription_id, freeze_start_date, freeze_end_date }: FreezeRequestInput = await req.json();

    if (!subscription_id || !freeze_start_date || !freeze_end_date) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: subscription_id, freeze_start_date, freeze_end_date" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate dates
    const startDate = new Date(freeze_start_date);
    const endDate = new Date(freeze_end_date);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return new Response(
        JSON.stringify({ error: "Invalid date format. Use YYYY-MM-DD" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (startDate >= endDate) {
      return new Response(
        JSON.stringify({ error: "Freeze end date must be after start date" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the subscription belongs to this user and is active
    const { data: subscription, error: subError } = await supabaseClient
      .from("subscriptions")
      .select("id, user_id, status, freeze_days_used")
      .eq("id", subscription_id)
      .single();

    if (subError || !subscription) {
      return new Response(
        JSON.stringify({ error: "Subscription not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (subscription.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Can only freeze your own subscription" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (subscription.status !== "active") {
      return new Response(
        JSON.stringify({ error: "Can only freeze active subscriptions" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delegate to DB RPC (handles overlap check, freeze day deduction, insert)
    const { data: freezeResult, error: freezeError } = await supabaseClient.rpc(
      "request_subscription_freeze",
      {
        p_user_id: subscription.user_id,
        p_subscription_id: subscription_id,
        p_freeze_start_date: freeze_start_date,
        p_freeze_end_date: freeze_end_date,
      }
    );

    if (freezeError) {
      return new Response(
        JSON.stringify({ error: freezeError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = freezeResult as {
      success: boolean;
      freeze_id?: string;
      freeze_days?: number;
      freeze_start?: string;
      freeze_end?: string;
      days_remaining_this_cycle?: number;
      error?: string;
    };

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        freeze_id: result.freeze_id,
        freeze_days: result.freeze_days,
        freeze_start: result.freeze_start,
        freeze_end: result.freeze_end,
        days_remaining_this_cycle: result.days_remaining_this_cycle,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error handling freeze request:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
