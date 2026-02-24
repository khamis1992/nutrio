// Edge Function: process-subscription-renewal
// Handles subscription renewal with rollover credit calculation
// Called by: Cron job (daily), Admin trigger, Automatic renewal

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RenewalInput {
  subscription_id?: string; // If specific subscription, else process all due
  user_id?: string; // If specific user
  dry_run?: boolean; // If true, don't actually renew, just preview
}

interface RenewalResult {
  subscription_id: string;
  user_id: string;
  success: boolean;
  rollover_credits: number;
  new_cycle_start: string;
  new_cycle_end: string;
  total_credits: number;
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

    // Parse request body
    const { subscription_id, user_id, dry_run = false }: RenewalInput = await req.json().catch(() => ({}));

    // Validate JWT for non-cron requests
    const authHeader = req.headers.get("authorization");
    let isAdmin = false;
    let requestingUserId: string | null = null;

    if (authHeader) {
      const jwt = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(jwt);
      
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      requestingUserId = user.id;

      // Check if admin
      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      isAdmin = profile?.role === "admin";
    }

    // If specific subscription requested, verify permissions
    if (subscription_id && !isAdmin && requestingUserId) {
      const { data: sub } = await supabaseClient
        .from("subscriptions")
        .select("user_id")
        .eq("id", subscription_id)
        .single();

      if (sub?.user_id !== requestingUserId) {
        return new Response(
          JSON.stringify({ error: "Forbidden: Can only renew own subscriptions" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Build query to find subscriptions due for renewal
    let query = supabaseClient
      .from("subscriptions")
      .select(`
        id,
        user_id,
        plan_id,
        credits_remaining,
        credits_used,
        rollover_credits,
        billing_cycle_end,
        freeze_days_used,
        status
      `)
      .eq("status", "active");

    if (subscription_id) {
      query = query.eq("id", subscription_id);
    } else if (user_id) {
      query = query.eq("user_id", user_id);
    } else {
      // Find all subscriptions ending within 24 hours (for cron job)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      query = query.lte("billing_cycle_end", tomorrow.toISOString().split("T")[0]);
    }

    const { data: subscriptions, error: fetchError } = await query;

    if (fetchError) {
      throw fetchError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: "No subscriptions due for renewal",
          processed: 0,
          results: []
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: RenewalResult[] = [];

    // Process each subscription
    for (const subscription of subscriptions || []) {
      try {
        // Get plan details
        const { data: plan, error: planError } = await supabaseClient
          .from("subscription_plans")
          .select("meal_credits")
          .eq("id", subscription.plan_id)
          .single();

        if (planError || !plan) {
          results.push({
            subscription_id: subscription.id,
            user_id: subscription.user_id,
            success: false,
            rollover_credits: 0,
            new_cycle_start: "",
            new_cycle_end: "",
            total_credits: 0,
            error: "Plan not found",
          });
          continue;
        }

        if (dry_run) {
          // Calculate without executing
          const monthly_credits = plan.meal_credits;
          const unused_credits = subscription.credits_remaining;
          const max_rollover = Math.floor(monthly_credits * 0.20);
          const rollover_amount = Math.min(unused_credits, max_rollover);
          
          const current_cycle_end = new Date(subscription.billing_cycle_end);
          const new_cycle_start = new Date(current_cycle_end);
          new_cycle_start.setDate(new_cycle_start.getDate() + 1);
          
          const new_cycle_end = new Date(new_cycle_start);
          new_cycle_end.setDate(new_cycle_end.getDate() + 29); // 30 days from start
          
          if (subscription.freeze_days_used > 0) {
            new_cycle_end.setDate(new_cycle_end.getDate() + subscription.freeze_days_used);
          }

          results.push({
            subscription_id: subscription.id,
            user_id: subscription.user_id,
            success: true,
            rollover_credits: rollover_amount,
            new_cycle_start: new_cycle_start.toISOString().split("T")[0],
            new_cycle_end: new_cycle_end.toISOString().split("T")[0],
            total_credits: rollover_amount + monthly_credits,
          });
        } else {
          // Execute the renewal using database function
          const { data: renewalResult, error: renewalError } = await supabaseClient.rpc(
            "calculate_rollover_credits",
            {
              p_subscription_id: subscription.id,
              p_user_id: subscription.user_id,
            }
          );

          if (renewalError) {
            throw renewalError;
          }

          const result = renewalResult as {
            success: boolean;
            rollover_credits: number;
            new_cycle_start: string;
            new_cycle_end: string;
            total_credits: number;
            error?: string;
          };

          results.push({
            subscription_id: subscription.id,
            user_id: subscription.user_id,
            success: result.success,
            rollover_credits: result.rollover_credits,
            new_cycle_start: result.new_cycle_start,
            new_cycle_end: result.new_cycle_end,
            total_credits: result.total_credits,
            error: result.error,
          });

          // Send notification to user if successful
          if (result.success) {
            await supabaseClient.functions.invoke("send-email", {
              body: {
                to: subscription.user_id, // Will be resolved by the email function
                template: "subscription-renewed",
                data: {
                  rollover_credits: result.rollover_credits,
                  total_credits: result.total_credits,
                  new_cycle_end: result.new_cycle_end,
                },
              },
            });
          }
        }
      } catch (error) {
        results.push({
          subscription_id: subscription.id,
          user_id: subscription.user_id,
          success: false,
          rollover_credits: 0,
          new_cycle_start: "",
          new_cycle_end: "",
          total_credits: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: dry_run ? "Dry run completed" : "Renewal processed",
        processed: results.length,
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing subscription renewal:", error);
    
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
