// Edge Function: calculate-health-score
// Calculates weekly health compliance score
// Called by: Cron job (weekly), Manual trigger after body metrics logging

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  enforceRateLimit,
  errorResponse,
  escapeHtml,
  getClientIp,
  getServiceClient,
  handlePreflight,
  HttpError,
  jsonResponse,
  readJsonBody,
  recordSecurityEvent,
  requireAdmin,
  requireInternalSecret,
  requirePost,
  requireSelfOrAdmin,
  type SecurityPrincipal,
} from "../_shared/security.ts";

interface HealthScoreInput {
  user_id?: string; // If specific user, otherwise calculate a bounded page
  week_start?: string; // YYYY-MM-DD format, defaults to current week
  limit?: number;
  after_user_id?: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    requirePost(req);
    const { user_id, week_start, limit = 3, after_user_id } =
      await readJsonBody<HealthScoreInput>(
        req,
        8 * 1024,
      );

    if (user_id && !UUID_PATTERN.test(user_id)) {
      throw new HttpError(400, "invalid_user_id");
    }
    if (after_user_id && !UUID_PATTERN.test(after_user_id)) {
      throw new HttpError(400, "invalid_health_score_cursor");
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 3) {
      throw new HttpError(400, "invalid_batch_limit");
    }

    let principal: SecurityPrincipal | null = null;
    if (req.headers.has("x-internal-secret")) {
      await requireInternalSecret(req, "HEALTH_SCORE_CRON_SECRET");
    } else if (user_id) {
      principal = await requireSelfOrAdmin(req, user_id);
    } else {
      principal = await requireAdmin(req);
    }

    await enforceRateLimit(
      req,
      "health-score",
      principal?.user.id || getClientIp(req) || "internal",
      user_id ? 20 : 12,
      3600,
    );

    const supabaseClient = getServiceClient();

    // Determine the week to calculate for
    if (week_start && !/^\d{4}-\d{2}-\d{2}$/.test(week_start)) {
      throw new HttpError(400, "invalid_week_start");
    }
    const targetWeekStart = week_start
      ? new Date(`${week_start}T00:00:00.000Z`)
      : getWeekStart(new Date());
    if (Number.isNaN(targetWeekStart.getTime())) {
      throw new HttpError(400, "invalid_week_start");
    }

    // Build query to get users
    let userQuery = supabaseClient
      .from("subscriptions")
      .select("user_id")
      .eq("status", "active");

    if (user_id) {
      userQuery = userQuery.eq("user_id", user_id);
    } else {
      userQuery = userQuery.order("user_id", { ascending: true }).limit(limit);
      if (after_user_id) {
        userQuery = userQuery.gt("user_id", after_user_id);
      }
    }

    const { data: activeSubscriptions, error: usersError } = await userQuery;

    if (usersError) {
      throw usersError;
    }

    if (!activeSubscriptions || activeSubscriptions.length === 0) {
      return jsonResponse(req, {
        message: "No active subscriptions found",
        calculated: 0,
        batch_limit: user_id ? 1 : limit,
        next_cursor: null,
        results: [],
      });
    }

    // Get unique user IDs
    const userIds = [...new Set(activeSubscriptions.map((s) => s.user_id))];
    const nextCursor = !user_id && activeSubscriptions.length === limit
      ? userIds[userIds.length - 1] ?? null
      : null;
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
          try {
            const downstreamSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET") || "";
            if (downstreamSecret) {
              const week = targetWeekStart.toISOString().split("T")[0];
              const subject = "Your Nutrio weekly health score is ready";
              const message = `Your health score for the week of ${week} is ${result.overall_score} (${result.category}).`;
              const { data: notificationData, error: notificationError } = await supabaseClient.functions.invoke(
                "send-email",
                {
                  headers: { "x-internal-secret": downstreamSecret },
                  body: {
                    user_id: uid,
                    preference: "health_insights",
                    subject,
                    text: message,
                    html: `<p>${escapeHtml(message)}</p>`,
                    idempotency_key: `health-score:${uid}:${week}`,
                  },
                },
              );
              if (notificationError || notificationData?.success !== true) {
                console.error("Health score notification failed", {
                  code: notificationError?.name || "delivery_rejected",
                });
              }
            }
          } catch (notificationError) {
            console.error("Health score notification unavailable", {
              name: notificationError instanceof Error ? notificationError.name : "unknown",
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

    const successful = results.filter((result) => result.success).length;
    const failed = results.length - successful;
    await recordSecurityEvent(req, {
      eventType: user_id
        ? "health.score.calculated"
        : "system.health_score.batch_completed",
      category: "data_change",
      severity: failed ? "medium" : "info",
      outcome: failed ? "failure" : "success",
      principal,
      actorType: principal ? undefined : "system",
      action: user_id ? "calculate_health_score" : "calculate_health_scores_batch",
      resourceType: user_id ? "auth.user" : "system.batch",
      resourceId: user_id || "health-scores",
      metadata: { calculated: results.length, successful, failed },
    });

    return jsonResponse(req, {
      message: "Health scores calculated",
      week_start: targetWeekStart.toISOString().split("T")[0],
      calculated: results.length,
      successful,
      failed,
      batch_limit: user_id ? 1 : limit,
      next_cursor: nextCursor,
      results,
    });
  } catch (error) {
    console.error("Error calculating health scores:", error);
    return errorResponse(req, error);
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
