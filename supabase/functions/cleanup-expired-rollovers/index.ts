// Edge Function: cleanup-expired-rollovers
// Handles expired rollover credits and updates subscription records
// Called by: Cron job (daily at 2 AM)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  enforceRateLimit,
  errorResponse,
  escapeHtml,
  getCorsHeaders,
  getServiceClient,
  handlePreflight,
  HttpError,
  readJsonBody,
  recordSecurityEvent,
  requireAdminOrInternal,
  requirePost,
} from "../_shared/security.ts";

interface CleanupRequest {
  limit?: number;
}

interface ExpiredRollover {
  rollover_id: string;
  user_id: string;
  subscription_id: string;
  expired_credits: number;
  expiry_date: string;
}

interface CleanupResult {
  expired_rollovers: number;
  subscriptions_updated: number;
  errors: string[];
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  try {
    requirePost(req);
    const principal = await requireAdminOrInternal(req, "ROLLOVER_CLEANUP_CRON_SECRET");
    await enforceRateLimit(
      req,
      "cleanup-expired-rollovers",
      principal?.user.id || "internal",
      6,
      60 * 60,
    );
    const supabaseClient = getServiceClient();
    const body = req.body
      ? await readJsonBody<CleanupRequest>(req, 4 * 1024)
      : {};
    const limit = body.limit ?? 5;
    if (!Number.isInteger(limit) || limit < 1 || limit > 5) {
      throw new HttpError(400, "invalid_batch_limit");
    }
    const downstreamSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET") || "";
    if (!downstreamSecret) {
      // Fail before mutating rollover state. Otherwise a configuration error
      // would consume the only row that can drive the customer notification.
      throw new HttpError(503, "notification_delivery_unavailable");
    }

    const result: CleanupResult = {
      expired_rollovers: 0,
      subscriptions_updated: 0,
      errors: [],
    };

    const today = new Date().toISOString().split("T")[0];

    // Claim and expire a bounded batch atomically in Postgres. The RPC uses
    // FOR UPDATE SKIP LOCKED and recomputes each subscription's remaining
    // active rollover balance in the same transaction.
    const { data: expiredData, error: fetchError } = await supabaseClient.rpc(
      "cleanup_expired_rollover_batch",
      { p_limit: limit },
    );

    if (fetchError) {
      console.error("Expired rollover batch claim failed", {
        code: fetchError.code,
      });
      throw new HttpError(503, "rollover_store_unavailable");
    }

    const expiredRollovers = Array.isArray(expiredData)
      ? expiredData as ExpiredRollover[]
      : [];

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
        existing.total_expired += Number(rollover.expired_credits);
        existing.rollover_ids.push(rollover.rollover_id);
      } else {
        subscriptionMap.set(rollover.subscription_id, {
          user_id: rollover.user_id,
          total_expired: Number(rollover.expired_credits),
          rollover_ids: [rollover.rollover_id],
        });
      }
    }

    // Process each subscription
    for (const [subscriptionId, data] of subscriptionMap) {
      try {
        result.subscriptions_updated++;

        // Log the expiration
        const { error: auditError } = await supabaseClient.from("retention_audit_logs").insert({
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
        if (auditError) {
          result.errors.push(`Rollover audit failed for subscription ${subscriptionId}`);
        }

        const subject = "Your Nutrio rollover credits have expired";
        const message = `${data.total_expired} rollover credit(s) expired on ${today}.`;
        const batchHash = await sha256Hex([...data.rollover_ids].sort().join(","));
        const { data: notificationData, error: notificationError } = await supabaseClient.functions.invoke(
          "send-email",
          {
            headers: { "x-internal-secret": downstreamSecret },
            body: {
              user_id: data.user_id,
              preference: "subscription_updates",
              subject,
              text: message,
              html: `<p>${escapeHtml(message)}</p>`,
              idempotency_key:
                `rollover-expired:${subscriptionId}:${batchHash}`,
            },
          },
        );
        if (notificationError || notificationData?.success !== true) {
          result.errors.push(`Rollover notification failed for subscription ${subscriptionId}`);
        }
      } catch (error) {
        result.errors.push(`Error processing subscription ${subscriptionId}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    await recordSecurityEvent(req, {
      eventType: "system.expired_rollovers_cleaned",
      category: "data_change",
      severity: "medium",
      outcome: result.errors.length > 0 ? "failure" : "success",
      principal,
      actorType: principal ? undefined : "service",
      action: "cleanup_expired_rollovers",
      resourceType: "subscription_rollovers",
      metadata: {
        expired_rollovers: result.expired_rollovers,
        subscriptions_updated: result.subscriptions_updated,
        error_count: result.errors.length,
      },
    });

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
    return errorResponse(req, error);
  }
});
