// Edge Function: cleanup-expired-rollovers
// Handles expired rollover credits and updates subscription records
// Called by: Cron job (daily at 2 AM)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CleanupResult {
  expired_rollovers: number;
  subscriptions_updated: number;
  errors: string[];
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

    // This endpoint can be called by cron jobs (no auth) or admins
    const authHeader = req.headers.get("authorization");
    let isAdmin = false;

    if (authHeader) {
      const jwt = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(jwt);

      if (!authError && user) {
        const { data: profile } = await supabaseClient
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        isAdmin = profile?.role === "admin";
      }

      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: "Forbidden: Admin access required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const result: CleanupResult = {
      expired_rollovers: 0,
      subscriptions_updated: 0,
      errors: [],
    };

    const today = new Date().toISOString().split("T")[0];

    // Find all expired rollover credits
    const { data: expiredRollovers, error: fetchError } = await supabaseClient
      .from("subscription_rollovers")
      .select("id, user_id, subscription_id, rollover_credits, expiry_date")
      .eq("is_consumed", false)
      .lt("expiry_date", today);

    if (fetchError) {
      throw fetchError;
    }

    if (!expiredRollovers || expiredRollovers.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No expired rollovers found",
          ...result,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    result.expired_rollovers = expiredRollovers.length;

    // Group by subscription for efficient updates
    const subscriptionMap = new Map<string, { 
      user_id: string; 
      total_expired: number;
      rollover_ids: string[];
    }>();

    for (const rollover of expiredRollovers) {
      const existing = subscriptionMap.get(rollover.subscription_id);
      if (existing) {
        existing.total_expired += rollover.rollover_credits;
        existing.rollover_ids.push(rollover.id);
      } else {
        subscriptionMap.set(rollover.subscription_id, {
          user_id: rollover.user_id,
          total_expired: rollover.rollover_credits,
          rollover_ids: [rollover.id],
        });
      }
    }

    // Process each subscription
    for (const [subscriptionId, data] of subscriptionMap) {
      try {
        // Update rollover records to mark as consumed
        const { error: updateRolloverError } = await supabaseClient
          .from("subscription_rollovers")
          .update({
            is_consumed: true,
            consumed_at: new Date().toISOString(),
          })
          .in("id", data.rollover_ids);

        if (updateRolloverError) {
          result.errors.push(`Failed to update rollovers for subscription ${subscriptionId}: ${updateRolloverError.message}`);
          continue;
        }

        // Update subscription to reduce rollover credits
        const { error: updateSubError } = await supabaseClient
          .from("subscriptions")
          .update({
            rollover_credits: 0,
            rollover_expiry_date: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", subscriptionId);

        if (updateSubError) {
          result.errors.push(`Failed to update subscription ${subscriptionId}: ${updateSubError.message}`);
          continue;
        }

        result.subscriptions_updated++;

        // Log the expiration
        await supabaseClient.from("retention_audit_logs").insert({
          user_id: data.user_id,
          subscription_id: subscriptionId,
          action_type: "rollover_expired",
          action_details: {
            expired_credits: data.total_expired,
            rollover_ids: data.rollover_ids,
            expiry_date: today,
          },
          triggered_by: "system",
        });

        // Notify user about expired rollover
        await supabaseClient.functions.invoke("send-email", {
          body: {
            to: data.user_id,
            template: "rollover-expired",
            data: {
              expired_credits: data.total_expired,
              expiry_date: today,
            },
          },
        });
      } catch (error) {
        result.errors.push(`Error processing subscription ${subscriptionId}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    return new Response(
      JSON.stringify({
        message: "Cleanup completed",
        date: today,
        ...result,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error cleaning up expired rollovers:", error);
    
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
