import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Get all active users who have completed onboarding
    // and have logged progress in the last 14 days
    const { data: activeUsers, error: fetchError } = await supabase
      .from("profiles")
      .select("user_id, last_goal_adjustment_date")
      .eq("onboarding_completed", true)
      .order("user_id");

    if (fetchError) throw fetchError;

    const results = {
      total: activeUsers?.length || 0,
      processed: 0,
      skipped: 0,
      errors: 0,
      adjustments_created: 0,
      plateaus_detected: 0
    };

    // Process each user
    for (const user of activeUsers || []) {
      try {
        // Check if it's time for adjustment (based on frequency setting)
        const { data: settings } = await supabase
          .from("adaptive_goal_settings")
          .select("adjustment_frequency, auto_adjust_enabled")
          .eq("user_id", user.user_id)
          .maybeSingle();

        if (!settings || !settings.auto_adjust_enabled) {
          results.skipped++;
          continue;
        }

        // Check last adjustment date
        const lastAdjustment = user.last_goal_adjustment_date 
          ? new Date(user.last_goal_adjustment_date) 
          : null;
        
        const now = new Date();
        const daysSinceAdjustment = lastAdjustment 
          ? Math.floor((now.getTime() - lastAdjustment.getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        // Determine if adjustment is due
        let adjustmentDue = false;
        switch (settings.adjustment_frequency) {
          case 'weekly':
            adjustmentDue = daysSinceAdjustment >= 7;
            break;
          case 'biweekly':
            adjustmentDue = daysSinceAdjustment >= 14;
            break;
          case 'monthly':
            adjustmentDue = daysSinceAdjustment >= 30;
            break;
        }

        if (!adjustmentDue) {
          results.skipped++;
          continue;
        }

        // Call adaptive-goals function for this user
        const functionUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/adaptive-goals`;
        const response = await fetch(functionUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ user_id: user.user_id })
        });

        if (!response.ok) {
          throw new Error(`Function call failed: ${response.statusText}`);
        }

        const result = await response.json();
        
        results.processed++;
        
        if (result.adjustment_id) {
          results.adjustments_created++;
        }
        
        if (result.recommendation?.plateau_detected) {
          results.plateaus_detected++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (userError) {
        console.error(`Error processing user ${user.user_id}:`, userError);
        results.errors++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        message: `Processed ${results.processed} users, created ${results.adjustments_created} adjustments, detected ${results.plateaus_detected} plateaus`
      }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in batch processing:", error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
