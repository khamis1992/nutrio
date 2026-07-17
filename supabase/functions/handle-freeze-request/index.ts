import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  authenticateRequest,
  enforceRateLimit,
  errorResponse,
  getServiceClient,
  hasAdminAssurance,
  handlePreflight,
  HttpError,
  jsonResponse,
  readJsonBody,
  recordSecurityEvent,
  requirePost,
} from "../_shared/security.ts";

interface FreezeRequestInput {
  subscription_id: string;
  freeze_start_date: string;
  freeze_end_date: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    requirePost(req);
    const principal = await authenticateRequest(req);
    await enforceRateLimit(req, "subscription-freeze", principal.user.id, 8, 86400);

    const body = await readJsonBody<FreezeRequestInput>(req, 8 * 1024);
    const { subscription_id, freeze_start_date, freeze_end_date } = body;
    if (!UUID_PATTERN.test(subscription_id || "")) {
      throw new HttpError(400, "invalid_subscription_id");
    }
    if (
      !DATE_PATTERN.test(freeze_start_date || "") ||
      !DATE_PATTERN.test(freeze_end_date || "")
    ) {
      throw new HttpError(400, "invalid_freeze_dates");
    }

    const startDate = new Date(`${freeze_start_date}T00:00:00.000Z`);
    const endDate = new Date(`${freeze_end_date}T00:00:00.000Z`);
    const freezeDays = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000);
    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      freezeDays < 1 ||
      freezeDays > 90
    ) {
      throw new HttpError(400, "invalid_freeze_range");
    }

    const supabase = getServiceClient();
    const { data: subscription, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("id, user_id, status")
      .eq("id", subscription_id)
      .maybeSingle();

    if (subscriptionError) throw subscriptionError;
    if (!subscription) throw new HttpError(404, "subscription_not_found");
    if (
      subscription.user_id !== principal.user.id &&
      !hasAdminAssurance(principal)
    ) {
      await recordSecurityEvent(req, {
        eventType: "authorization.subscription_freeze_denied",
        category: "authorization",
        severity: "high",
        outcome: "denied",
        principal,
        action: "freeze_other_subscription",
        resourceType: "public.subscriptions",
        resourceId: subscription_id,
      });
      throw new HttpError(403, "forbidden");
    }
    if (subscription.status !== "active") {
      throw new HttpError(409, "subscription_not_active");
    }

    const { data, error } = await supabase.rpc("request_subscription_freeze", {
      p_user_id: subscription.user_id,
      p_subscription_id: subscription_id,
      p_freeze_start_date: freeze_start_date,
      p_freeze_end_date: freeze_end_date,
    });
    if (error) {
      console.error("Subscription freeze RPC failed:", error.message);
      throw new HttpError(400, "freeze_request_rejected");
    }

    const result = data as {
      success?: boolean;
      freeze_id?: string;
      freeze_days?: number;
      freeze_start?: string;
      freeze_end?: string;
      days_remaining_this_cycle?: number;
    };
    if (!result?.success) throw new HttpError(400, "freeze_request_rejected");

    await recordSecurityEvent(req, {
      eventType: "subscription.freeze.requested",
      category: "data_change",
      severity: "medium",
      outcome: "success",
      principal,
      action: "request_freeze",
      resourceType: "public.subscriptions",
      resourceId: subscription_id,
      metadata: {
        freeze_start: freeze_start_date,
        freeze_end: freeze_end_date,
        freeze_days: result.freeze_days || freezeDays,
      },
    });

    return jsonResponse(req, {
      success: true,
      freeze_id: result.freeze_id,
      freeze_days: result.freeze_days,
      freeze_start: result.freeze_start,
      freeze_end: result.freeze_end,
      days_remaining_this_cycle: result.days_remaining_this_cycle,
    });
  } catch (error) {
    console.error("Freeze request failed:", error);
    return errorResponse(req, error);
  }
});
