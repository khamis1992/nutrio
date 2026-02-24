// Edge Function: calculate-health-score
// Calculates weekly health compliance score
// Called by: Cron job (weekly), Manual trigger after body metrics logging

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HealthScoreInput {
  user_id?: string; // If specific user, else calculate for all
  week_start?: string; // YYYY-MM-DD format, defaults to current week
}

interface HealthScoreResult {
  user_id: string;
  success: boolean;
  overall_score?: number;
  category?: "green" | "orange" | "red";
  breakdown?: {
    macro_adherence: number;
    meal_consistency: number;
    weight_logging: number;
    protein_accuracy: number;
  };
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
    const { user_id, week_start }: HealthScoreInput = await req.json().catch(() => ({}));

    // Determine the week to calculate for
    const targetWeekStart = week_start 
      ? new Date(week_start)
      : getWeekStart(new Date());

    // Validate JWT if specific user requested (optional for cron jobs)
    let requestingUserId: string | null = null;
    let isAdmin = false;

    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      const jwt = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(jwt);

      if (!authError && user) {
        requestingUserId = user.id;

        // Check if admin
        const { data: profile } = await supabaseClient
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        isAdmin = profile?.role === "admin";

        // If specific user requested, verify permissions
        if (user_id && user_id !== user.id && !isAdmin) {
          return new Response(
            JSON.stringify({ error: "Forbidden: Can only calculate own health score" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Build query to get users
    let userQuery = supabaseClient
      .from("subscriptions")
      .select("user_id")
      .eq("status", "active");

    if (user_id) {
      userQuery = userQuery.eq("user_id", user_id);
    }

    const { data: activeSubscriptions, error: usersError } = await userQuery;

    if (usersError) {
      throw usersError;
    }

    if (!activeSubscriptions || activeSubscriptions.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: "No active subscriptions found",
          calculated: 0,
          results: []
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get unique user IDs
    const userIds = [...new Set(activeSubscriptions.map((s) => s.user_id))];
    const results: HealthScoreResult[] = [];

    // Calculate health score for each user
    for (const uid of userIds) {
      try {
        const { data: scoreResult, error: scoreError } = await supabaseClient.rpc(
          "calculate_health_compliance_score",
          {
            p_user_id: uid,
            p_week_start: targetWeekStart.toISOString().split("T")[0],
          }
        );

        if (scoreError) {
          results.push({
            user_id: uid,
            success: false,
            error: scoreError.message,
          });
          continue;
        }

        const result = scoreResult as {
          success: boolean;
          overall_score: number;
          category: "green" | "orange" | "red";
          breakdown: {
            macro_adherence: number;
            meal_consistency: number;
            weight_logging: number;
            protein_accuracy: number;
          };
          error?: string;
        };

        results.push({
          user_id: uid,
          success: result.success,
          overall_score: result.overall_score,
          category: result.category,
          breakdown: result.breakdown,
          error: result.error,
        });

        // Send notification if score calculated successfully
        if (result.success) {
          // Get user's email preference
          const { data: userPrefs } = await supabaseClient
            .from("user_preferences")
            .select("email_notifications")
            .eq("user_id", uid)
            .single();

          if (userPrefs?.email_notifications !== false) {
            await supabaseClient.functions.invoke("send-email", {
              body: {
                to: uid,
                template: "health-score-calculated",
                data: {
                  week_start: targetWeekStart.toISOString().split("T")[0],
                  overall_score: result.overall_score,
                  category: result.category,
                  breakdown: result.breakdown,
                },
              },
            });
          }
        }
      } catch (error) {
        results.push({
          user_id: uid,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: "Health scores calculated",
        week_start: targetWeekStart.toISOString().split("T")[0],
        calculated: results.length,
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error calculating health scores:", error);
    
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper function to get the start of the week (Sunday)
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
