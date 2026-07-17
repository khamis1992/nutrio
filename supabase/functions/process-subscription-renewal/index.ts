// Synchronizes freezes and expires subscriptions whose paid period ended.
// A verified SADAD payment is the only path that may extend entitlement.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

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
  requireInternalSecret,
  requirePost,
  type SecurityPrincipal,
} from "../_shared/security.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface RenewalInput {
  subscription_id?: string;
  dry_run?: boolean;
}

interface RenewalLifecycleResult {
  subscription_id: string;
  action: "would_expire" | "expired";
  success: true;
}

function getQatarDate(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Qatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

serve(async (req: Request): Promise<Response> => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  let principal: SecurityPrincipal | null = null;
  let internal = false;

  try {
    requirePost(req);
    const body = await readJsonBody<RenewalInput>(req, 8 * 1024);
    const subscriptionId = String(body.subscription_id || "").trim() || null;
    const dryRun = body.dry_run === true;

    if (subscriptionId && !UUID_PATTERN.test(subscriptionId)) {
      throw new HttpError(400, "invalid_subscription_reference");
    }

    if (req.headers.has("x-internal-secret")) {
      await requireInternalSecret(req, "SUBSCRIPTION_RENEWAL_CRON_SECRET");
      internal = true;
    } else {
      principal = await authenticateRequest(req);
      await enforceRateLimit(
        req,
        "subscription-renewal",
        principal.user.id,
        hasAdminAssurance(principal) ? 30 : 5,
        60 * 60,
      );
    }

    const hasAdminAccess = hasAdminAssurance(principal);
    if (!internal && !hasAdminAccess && (!dryRun || !subscriptionId)) {
      throw new HttpError(403, "renewal_preview_scope_forbidden");
    }
    if (!dryRun && !internal && !hasAdminAccess) {
      throw new HttpError(403, "admin_or_scheduler_required");
    }

    const service = getServiceClient();

    // A dry run must be observational. Freeze synchronization and expiry are
    // both intentionally skipped so previewing cannot mutate entitlement.
    if (!dryRun) {
      const syncTarget = internal || hasAdminAccess ? null : principal?.user.id;
      const { error: freezeError } = await service.rpc("sync_subscription_freezes", {
        p_user_id: syncTarget,
      });
      if (freezeError) throw freezeError;

      const { data: expired, error: expireError } = await service.rpc(
        "expire_due_subscriptions",
        {
          p_subscription_id: subscriptionId,
          p_limit: subscriptionId ? 1 : 500,
        },
      );
      if (expireError) throw expireError;

      const results: RenewalLifecycleResult[] = (expired ?? []).map((item) => ({
        subscription_id: String(item.subscription_id),
        action: "expired",
        success: true,
      }));

      await recordSecurityEvent(req, {
        eventType: "subscription.lifecycle_processed",
        category: "payment",
        severity: results.length ? "medium" : "info",
        outcome: "success",
        principal,
        actorType: internal ? "system" : undefined,
        actorRole: internal ? "scheduler" : undefined,
        action: "expire_due_subscriptions",
        resourceType: "public.subscriptions",
        resourceId: subscriptionId || undefined,
        metadata: { processed: results.length, bounded_limit: subscriptionId ? 1 : 500 },
      });

      return jsonResponse(req, {
        success: true,
        processed: results.length,
        // Scheduler responses are aggregate-only to avoid writing customer
        // identifiers into CI provider logs.
        results: internal ? undefined : results,
      });
    }

    const today = getQatarDate();
    let query = service
      .from("subscriptions")
      .select("id,user_id,end_date")
      .in("status", ["active", "cancelled"])
      .is("freeze_active_id", null)
      .not("end_date", "is", null)
      .lt("end_date", today)
      .order("end_date", { ascending: true })
      .limit(subscriptionId ? 1 : 500);

    if (subscriptionId) query = query.eq("id", subscriptionId);
    if (!internal && !hasAdminAccess && principal) {
      query = query.eq("user_id", principal.user.id);
    }

    const { data: subscriptions, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    const results: RenewalLifecycleResult[] = (subscriptions ?? []).map((item) => ({
      subscription_id: String(item.id),
      action: "would_expire",
      success: true,
    }));

    return jsonResponse(req, {
      success: true,
      dry_run: true,
      processed: results.length,
      results: internal ? undefined : results,
    });
  } catch (error) {
    await recordSecurityEvent(req, {
      eventType: "subscription.lifecycle_failed",
      category: "payment",
      severity: error instanceof HttpError && error.status < 500 ? "medium" : "high",
      outcome: error instanceof HttpError && [401, 403, 429].includes(error.status)
        ? "denied"
        : "failure",
      principal,
      actorType: internal ? "system" : undefined,
      actorRole: internal ? "scheduler" : undefined,
      action: "process_subscription_lifecycle",
      metadata: { error_code: error instanceof HttpError ? error.code : "internal_error" },
    });
    return errorResponse(req, error);
  }
});
