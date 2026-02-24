// Edge Function: handle-freeze-request
// Processes subscription freeze requests with validation
// Called by: Customer portal, Admin portal

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FreezeRequestInput {
  subscription_id: string;
  freeze_start_date: string; // YYYY-MM-DD format
  freeze_end_date: string; // YYYY-MM-DD format
}

interface FreezeRequestResult {
  success: boolean;
  freeze_id?: string;
  freeze_days?: number;
  freeze_start?: string;
  freeze_end?: string;
  days_remaining_this_cycle?: number;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get JWT from authorization header
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

    // Parse request body
    const { subscription_id, freeze_start_date, freeze_end_date }: FreezeRequestInput = await req.json();

    // Validate required fields
    if (!subscription_id || !freeze_start_date || !freeze_end_date) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: subscription_id, freeze_start_date, freeze_end_date" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate date format and logic
    const startDate = new Date(freeze_start_date);
    const endDate = new Date(freeze_end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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

    // Must schedule at least 24 hours in advance
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (startDate < tomorrow) {
      return new Response(
        JSON.stringify({ error: "Freeze must be scheduled at least 24 hours in advance" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user owns the subscription or is admin
    const { data: subscription, error: subError } = await supabaseClient
      .from("subscriptions")
      .select("user_id, billing_cycle_start, billing_cycle_end, freeze_days_used, status")
      .eq("id", subscription_id)
      .single();

    if (subError || !subscription) {
      return new Response(
        JSON.stringify({ error: "Subscription not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check user permissions
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.role === "admin";

    if (subscription.user_id !== user.id && !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Can only freeze own subscriptions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check subscription status
    if (subscription.status !== "active") {
      return new Response(
        JSON.stringify({ error: "Can only freeze active subscriptions" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if freeze dates are within billing cycle
    const cycleStart = new Date(subscription.billing_cycle_start);
    const cycleEnd = new Date(subscription.billing_cycle_end);

    if (startDate < cycleStart || endDate > cycleEnd) {
      return new Response(
        JSON.stringify({ error: "Freeze period must be within current billing cycle" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate freeze days
    const freezeDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    // Check freeze days remaining (max 7 per cycle)
    const daysRemaining = 7 - (subscription.freeze_days_used || 0);
    if (freezeDays > daysRemaining) {
      return new Response(
        JSON.stringify({ 
          error: `Only ${daysRemaining} freeze days remaining this cycle`,
          days_remaining: daysRemaining 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for overlapping freezes using database function
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

    const result = freezeResult as FreezeRequestResult;

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send notification to user
    await supabaseClient.functions.invoke("send-email", {
      body: {
        to: subscription.user_id,
        template: "freeze-scheduled",
        data: {
          freeze_start: freeze_start_date,
          freeze_end: freeze_end_date,
          freeze_days: freezeDays,
          days_remaining: daysRemaining - freezeDays,
        },
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Freeze scheduled successfully",
        freeze_id: result.freeze_id,
        freeze_days: freezeDays,
        freeze_start: freeze_start_date,
        freeze_end: freeze_end_date,
        days_remaining_this_cycle: daysRemaining - freezeDays,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error handling freeze request:", error);
    
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
