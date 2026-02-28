import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * GDPR Data Export Edge Function
 * 
 * Exports all user data in a structured JSON format for GDPR compliance.
 * Includes: profile, orders, addresses, meal history, subscriptions, etc.
 * 
 * Rate Limit: 1 export per 24 hours per user
 * Access: User can export own data, admins can export any user data
 */

interface ExportRequest {
  user_id?: string; // For admin exports
  format?: "json" | "csv";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    const adminSupabase = createClient(supabaseUrl, serviceKey);

    // Get JWT from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requesterId = user.id;
    const requestBody: ExportRequest = await req.json().catch(() => ({}));
    const targetUserId = requestBody.user_id || requesterId;

    // Check if requester is admin (for exporting other users' data)
    let isAdmin = false;
    if (targetUserId !== requesterId) {
      const { data: roleData } = await adminSupabase
        .from("user_roles")
        .select("role")
        .eq("user_id", requesterId)
        .eq("role", "admin")
        .maybeSingle();
      
      if (!roleData) {
        return new Response(
          JSON.stringify({ error: "Unauthorized to export other users' data" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      isAdmin = true;
    }

    // Check rate limit (1 export per 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: rateLimitError } = await adminSupabase
      .from("gdpr_export_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", targetUserId)
      .gte("created_at", twentyFourHoursAgo);

    if (rateLimitError) {
      console.error("Rate limit check error:", rateLimitError);
    } else if (count && count >= 1 && !isAdmin) {
      return new Response(
        JSON.stringify({ 
          error: "Rate limit exceeded",
          message: "You can only export your data once per 24 hours. Please try again later."
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Collect all user data
    const exportData: any = {
      export_metadata: {
        user_id: targetUserId,
        exported_at: new Date().toISOString(),
        exported_by: requesterId,
        version: "1.0",
      },
    };

    // 1. Auth user data
    const { data: authUser } = await adminSupabase.auth.admin.getUserById(targetUserId);
    if (authUser?.user) {
      exportData.auth = {
        id: authUser.user.id,
        email: authUser.user.email,
        phone: authUser.user.phone,
        created_at: authUser.user.created_at,
        last_sign_in_at: authUser.user.last_sign_in_at,
        email_confirmed_at: authUser.user.email_confirmed_at,
        phone_confirmed_at: authUser.user.phone_confirmed_at,
      };
    }

    // 2. Profile
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("*")
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (profile) exportData.profile = profile;

    // 3. Restaurants (if partner)
    const { data: restaurants } = await adminSupabase
      .from("restaurants")
      .select("*")
      .eq("owner_id", targetUserId);
    if (restaurants?.length) {
      exportData.restaurants = restaurants;

      // 4. Meals for each restaurant
      const restaurantIds = restaurants.map(r => r.id);
      const { data: meals } = await adminSupabase
        .from("meals")
        .select("*")
        .in("restaurant_id", restaurantIds);
      if (meals?.length) exportData.meals = meals;
    }

    // 5. Addresses
    const { data: addresses } = await adminSupabase
      .from("user_addresses")
      .select("*")
      .eq("user_id", targetUserId);
    if (addresses?.length) exportData.addresses = addresses;

    // 6. Subscriptions
    const { data: subscriptions } = await adminSupabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", targetUserId);
    if (subscriptions?.length) exportData.subscriptions = subscriptions;

    // 7. Orders
    const { data: orders } = await adminSupabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("user_id", targetUserId);
    if (orders?.length) exportData.orders = orders;

    // 8. Meal schedules
    const { data: mealSchedules } = await adminSupabase
      .from("meal_schedules")
      .select("*")
      .eq("user_id", targetUserId);
    if (mealSchedules?.length) exportData.meal_schedules = mealSchedules;

    // 9. Wallet and transactions
    const { data: wallet } = await adminSupabase
      .from("customer_wallets")
      .select("*")
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (wallet) {
      exportData.wallet = wallet;
      
      const { data: transactions } = await adminSupabase
        .from("wallet_transactions")
        .select("*")
        .eq("wallet_id", wallet.id);
      if (transactions?.length) exportData.wallet_transactions = transactions;
    }

    // 10. Meal history
    const { data: mealHistory } = await adminSupabase
      .from("meal_history")
      .select("*")
      .eq("user_id", targetUserId);
    if (mealHistory?.length) exportData.meal_history = mealHistory;

    // 11. Reviews
    const { data: reviews } = await adminSupabase
      .from("meal_reviews")
      .select("*")
      .eq("user_id", targetUserId);
    if (reviews?.length) exportData.reviews = reviews;

    // 12. Affiliate data
    const { data: affiliateData } = await adminSupabase
      .from("affiliate_applications")
      .select("*")
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (affiliateData) exportData.affiliate_application = affiliateData;

    const { data: commissions } = await adminSupabase
      .from("affiliate_commissions")
      .select("*")
      .eq("user_id", targetUserId);
    if (commissions?.length) exportData.affiliate_commissions = commissions;

    // 13. Driver data (if driver)
    const { data: driverData } = await adminSupabase
      .from("drivers")
      .select("*")
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (driverData) {
      exportData.driver_profile = driverData;

      const { data: driverPayouts } = await adminSupabase
        .from("driver_payouts")
        .select("*")
        .eq("driver_id", driverData.id);
      if (driverPayouts?.length) exportData.driver_payouts = driverPayouts;
    }

    // 14. Partner payouts
    const { data: partnerPayouts } = await adminSupabase
      .from("partner_payouts")
      .select("*")
      .eq("partner_id", targetUserId);
    if (partnerPayouts?.length) exportData.partner_payouts = partnerPayouts;

    const { data: partnerEarnings } = await adminSupabase
      .from("partner_earnings")
      .select("*")
      .eq("partner_id", targetUserId);
    if (partnerEarnings?.length) exportData.partner_earnings = partnerEarnings;

    // 15. Notifications
    const { data: notifications } = await adminSupabase
      .from("notifications")
      .select("*")
      .eq("user_id", targetUserId);
    if (notifications?.length) exportData.notifications = notifications;

    // 16. Support tickets
    const { data: tickets } = await adminSupabase
      .from("support_tickets")
      .select("*, ticket_messages(*)")
      .eq("user_id", targetUserId);
    if (tickets?.length) exportData.support_tickets = tickets;

    // 17. Gamification data
    const { data: userBadges } = await adminSupabase
      .from("user_badges")
      .select("*")
      .eq("user_id", targetUserId);
    if (userBadges?.length) exportData.badges = userBadges;

    const { data: userStreaks } = await adminSupabase
      .from("user_streaks")
      .select("*")
      .eq("user_id", targetUserId);
    if (userStreaks?.length) exportData.streaks = userStreaks;

    // 18. Audit logs (activity history)
    const { data: auditLogs } = await adminSupabase
      .from("audit_logs")
      .select("*")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (auditLogs?.length) exportData.activity_log = auditLogs;

    // Log the export
    await adminSupabase.from("gdpr_export_logs").insert({
      user_id: targetUserId,
      exported_by: requesterId,
      is_admin_export: isAdmin,
      data_size_bytes: JSON.stringify(exportData).length,
    });

    // Return the export
    return new Response(
      JSON.stringify(exportData, null, 2),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="gdpr-export-${targetUserId}-${Date.now()}.json"`,
        },
      }
    );

  } catch (error) {
    console.error("GDPR export error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Export failed", 
        details: (error as Error).message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
