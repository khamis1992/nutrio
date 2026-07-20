import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  authenticateRequest,
  enforceRateLimit,
  getClientIp,
  getCorsHeaders,
  getServiceClient,
  hasAdminAssurance,
  handlePreflight,
  HttpError,
  jsonResponse,
  readJsonBody,
  recordSecurityEvent,
  requirePost,
  type SecurityPrincipal,
} from "../_shared/security.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EXPORT_WINDOW_SECONDS = 24 * 60 * 60;

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

function exportRateLimitResponse(req: Request): Response {
  return jsonResponse(
    req,
    {
      error: "Rate limit exceeded",
      message:
        "You can only export your data once per 24 hours. Please try again later.",
    },
    429,
  );
}

function exportErrorResponse(req: Request, error: unknown): Response {
  if (error instanceof HttpError) {
    if (error.status === 401) {
      return jsonResponse(req, { error: "Invalid or expired token" }, 401);
    }
    if (error.status === 429) return exportRateLimitResponse(req);
    return jsonResponse(
      req,
      {
        error: error.status >= 500 ? "Export failed" : error.code,
      },
      error.status,
    );
  }

  console.error("Unexpected GDPR export failure");
  return jsonResponse(req, { error: "Export failed" }, 500);
}

serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  let principal: SecurityPrincipal | null = null;
  let targetUserId: string | null = null;

  try {
    requirePost(req);
    principal = await authenticateRequest(req);
    const requesterId = principal.user.id;
    const parsedBody: unknown = req.body &&
        req.headers.get("content-length") !== "0"
      ? await readJsonBody<unknown>(req, 2 * 1024)
      : {};
    if (
      !parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)
    ) {
      return jsonResponse(req, { error: "Invalid request body" }, 400);
    }
    const requestBody = parsedBody as ExportRequest;

    if (
      requestBody.user_id !== undefined &&
      (typeof requestBody.user_id !== "string" ||
        !UUID_PATTERN.test(requestBody.user_id))
    ) {
      return jsonResponse(req, { error: "Invalid user ID" }, 400);
    }
    if (
      requestBody.format !== undefined &&
      requestBody.format !== "json" &&
      requestBody.format !== "csv"
    ) {
      return jsonResponse(req, { error: "Invalid export format" }, 400);
    }

    targetUserId = requestBody.user_id || requesterId;
    if (targetUserId !== requesterId && !hasAdminAssurance(principal)) {
      await recordSecurityEvent(req, {
        eventType: "authorization.user_data_export_denied",
        category: "authorization",
        severity: "high",
        outcome: "denied",
        principal,
        action: "export_user_data",
        resourceType: "auth.user",
        resourceId: targetUserId,
      });
      return jsonResponse(req, {
        error: "Unauthorized to export other users' data",
      }, 403);
    }

    const isAdmin = targetUserId !== requesterId && hasAdminAssurance(principal);
    const adminSupabase = getServiceClient();

    // Preserve the historical log-based window during rollout, then atomically
    // claim the current window before doing any expensive export work.
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString();
    const { count, error: rateLimitError } = await adminSupabase
      .from("gdpr_export_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", targetUserId)
      .gte("created_at", twentyFourHoursAgo);

    if (rateLimitError) {
      console.error(
        "Historical export throttle lookup failed:",
        rateLimitError.message,
      );
    } else if (count && count >= 1 && !isAdmin) {
      await recordSecurityEvent(req, {
        eventType: "api.user_data_export_rate_limited",
        category: "api",
        severity: "medium",
        outcome: "blocked",
        principal,
        action: "export_user_data",
        resourceType: "auth.user",
        resourceId: targetUserId,
      });
      return exportRateLimitResponse(req);
    }

    if (!isAdmin) {
      await enforceRateLimit(
        req,
        "export-user-data",
        targetUserId,
        1,
        EXPORT_WINDOW_SECONDS,
      );
    }

    // Collect all user data
    const exportData: Record<string, unknown> = {
      export_metadata: {
        user_id: targetUserId,
        exported_at: new Date().toISOString(),
        exported_by: requesterId,
        version: "1.0",
      },
    };

    // 1. Auth user data
    const { data: authUser } = await adminSupabase.auth.admin.getUserById(
      targetUserId,
    );
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
      const restaurantIds = restaurants.map((r) => r.id);
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

    // 19. Private health-context journal, preferences, and consent history.
    // Fail closed so the user never receives an export presented as complete
    // while this especially sensitive dataset is missing.
    const [
      healthContextPreferences,
      healthContextEntries,
      healthContextConsent,
      healthContextConsentEvents,
    ] = await Promise.all([
      adminSupabase.from("health_context_preferences").select("*")
        .eq("user_id", targetUserId).maybeSingle(),
      adminSupabase.from("health_context_entries").select("*")
        .eq("user_id", targetUserId).order("entry_date", { ascending: true }),
      adminSupabase.from("ai_data_consents").select("*")
        .eq("user_id", targetUserId).eq("purpose", "health_context_summary").maybeSingle(),
      adminSupabase.from("health_context_consent_events").select("*")
        .eq("user_id", targetUserId).order("created_at", { ascending: true }),
    ]);
    const healthContextError = [
      healthContextPreferences.error,
      healthContextEntries.error,
      healthContextConsent.error,
      healthContextConsentEvents.error,
    ].find(Boolean);
    if (healthContextError) {
      console.error("Health context export collection failed:", healthContextError.message);
      throw new HttpError(503, "health_context_export_unavailable");
    }
    exportData.health_context = {
      preferences: healthContextPreferences.data,
      entries: healthContextEntries.data ?? [],
      ai_consent: healthContextConsent.data,
      consent_events: healthContextConsentEvents.data ?? [],
    };

    // 20. User-owned health support program data. This is collected as one
    // fail-closed group because omitting symptom or consent history would make
    // the export materially incomplete.
    const [
      programEnrollments,
      programBaselines,
      programCheckins,
      programTasks,
      programConsents,
      programSafetyEvents,
    ] = await Promise.all([
      adminSupabase.from("health_program_enrollments").select("*")
        .eq("user_id", targetUserId).order("created_at", { ascending: true }),
      adminSupabase.from("health_program_baselines").select("*")
        .eq("user_id", targetUserId).order("created_at", { ascending: true }),
      adminSupabase.from("health_program_checkins").select("*")
        .eq("user_id", targetUserId).order("checkin_date", { ascending: true }),
      adminSupabase.from("health_program_task_completions").select("*")
        .eq("user_id", targetUserId).order("task_date", { ascending: true }),
      adminSupabase.from("health_program_consent_events").select("*")
        .eq("user_id", targetUserId).order("created_at", { ascending: true }),
      adminSupabase.from("health_program_safety_events").select("*")
        .eq("user_id", targetUserId).order("created_at", { ascending: true }),
    ]);
    const healthProgramError = [
      programEnrollments.error,
      programBaselines.error,
      programCheckins.error,
      programTasks.error,
      programConsents.error,
      programSafetyEvents.error,
    ].find(Boolean);
    if (healthProgramError) {
      console.error("Health program export collection failed:", healthProgramError.message);
      throw new HttpError(503, "health_program_export_unavailable");
    }
    exportData.health_support_programs = {
      enrollments: programEnrollments.data ?? [],
      baselines: programBaselines.data ?? [],
      checkins: programCheckins.data ?? [],
      task_completions: programTasks.data ?? [],
      consent_events: programConsents.data ?? [],
      safety_events: programSafetyEvents.data ?? [],
    };

    const serializedExport = JSON.stringify(exportData, null, 2);
    const dataSizeBytes = new TextEncoder().encode(serializedExport).byteLength;

    // Do not release personal data unless the compliance record is durable.
    const { error: exportLogError } = await adminSupabase.from(
      "gdpr_export_logs",
    ).insert({
      user_id: targetUserId,
      exported_by: requesterId,
      is_admin_export: isAdmin,
      data_size_bytes: dataSizeBytes,
      ip_address: getClientIp(req),
      user_agent: (req.headers.get("user-agent") || "unknown").slice(0, 1000),
    });
    if (exportLogError) {
      console.error(
        "GDPR export compliance log failed:",
        exportLogError.message,
      );
      throw new HttpError(503, "export_logging_unavailable");
    }

    await recordSecurityEvent(req, {
      eventType: "data_change.user_data_exported",
      category: isAdmin ? "admin" : "data_change",
      severity: "high",
      outcome: "success",
      principal,
      action: "export_user_data",
      resourceType: "auth.user",
      resourceId: targetUserId,
      metadata: {
        is_admin_export: isAdmin,
        data_size_bytes: dataSizeBytes,
        format: requestBody.format || "json",
      },
    });

    // Return the export
    return new Response(
      serializedExport,
      {
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition":
            `attachment; filename="gdpr-export-${targetUserId}-${Date.now()}.json"`,
        },
      },
    );
  } catch (error) {
    if (
      principal && targetUserId &&
      !(error instanceof HttpError && error.status < 500)
    ) {
      await recordSecurityEvent(req, {
        eventType: "edge.user_data_export_failed",
        category: "edge_function",
        severity: "high",
        outcome: "failure",
        principal,
        action: "export_user_data",
        resourceType: "auth.user",
        resourceId: targetUserId,
      });
    }
    return exportErrorResponse(req, error);
  }
});
