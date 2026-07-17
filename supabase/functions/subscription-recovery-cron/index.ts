import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  enforceRateLimit,
  errorResponse,
  escapeHtml,
  getServiceClient,
  handlePreflight,
  HttpError,
  jsonResponse,
  readJsonBody,
  recordSecurityEvent,
  requireAdminOrInternal,
  requirePost,
  type SecurityPrincipal,
} from "../_shared/security.ts";
import { getNotificationRecipient } from "../_shared/notificationRecipient.ts";

interface RecoveryRequest {
  dry_run?: boolean;
  limit?: number;
}

interface ClaimedRecovery {
  recovery_id: string;
  user_id: string;
  expired_at: string;
  timing: RecoveryTiming;
  delay_days: number;
  claim_token: string | null;
}

type RecoveryTiming =
  | "t_plus_1"
  | "t_plus_3"
  | "t_plus_7";

const TIMING_LABELS: Record<RecoveryTiming, string> = {
  t_plus_1: "t+1d",
  t_plus_3: "t+3d",
  t_plus_7: "t+7d",
};

function buildNotificationPayload(delayDays: number, rawUserName: unknown) {
  const sanitizedName = Array.from(String(rawUserName ?? "there"))
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 ? " " : character;
    })
    .join("");
  const userName = sanitizedName
    .trim()
    .slice(0, 80) || "there";
  const absoluteDays = Math.max(1, Math.abs(delayDays));

  return {
    title: "We miss you! Come back to Nutrio",
    message: `Hey ${userName}, it's been ${absoluteDays} day${
      absoluteDays > 1 ? "s" : ""
    } since your subscription ended. Get an exclusive offer to reactivate!`,
    type: "subscription_recovery",
  };
}

async function completeRecovery(
  recovery: ClaimedRecovery,
  succeeded: boolean,
): Promise<boolean> {
  if (!recovery.claim_token) return false;
  const service = getServiceClient();
  const { data, error } = await service.rpc(
    "complete_subscription_recovery_notification",
    {
      p_recovery_id: recovery.recovery_id,
      p_claim_token: recovery.claim_token,
      p_succeeded: succeeded,
      p_error_code: succeeded ? null : "delivery_failed",
    },
  );
  if (error) {
    console.error("Recovery notification completion failed", {
      code: error.code,
    });
    throw new HttpError(503, "recovery_store_unavailable");
  }
  return data === true;
}

serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  let principal: SecurityPrincipal | null = null;
  let authorizedInternal = false;

  try {
    requirePost(req);
    principal = await requireAdminOrInternal(
      req,
      "SUBSCRIPTION_RECOVERY_CRON_SECRET",
    );
    authorizedInternal = principal === null;
    await enforceRateLimit(
      req,
      "subscription-recovery-cron",
      principal?.user.id || "internal",
      12,
      5 * 60,
    );

    const body = req.body
      ? await readJsonBody<RecoveryRequest>(req, 4 * 1024)
      : {};
    if (body.dry_run !== undefined && typeof body.dry_run !== "boolean") {
      throw new HttpError(400, "invalid_dry_run");
    }
    const dryRun = body.dry_run === true;
    const limit = body.limit ?? 2;
    if (!Number.isInteger(limit) || limit < 1 || limit > 2) {
      throw new HttpError(400, "invalid_batch_limit");
    }

    const downstreamSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET") || "";
    if (!dryRun && !downstreamSecret) {
      throw new HttpError(503, "notification_delivery_unavailable");
    }

    const service = getServiceClient();
    let expireResult: unknown = { dry_run: true };
    if (!dryRun) {
      const { data, error } = await service.rpc(
        "check_and_expire_subscriptions",
      );
      if (error) {
        console.error("Subscription expiry RPC failed", { code: error.code });
        throw new HttpError(503, "subscription_store_unavailable");
      }
      expireResult = data;
    }

    const { data: claimData, error: claimError } = await service.rpc(
      "claim_subscription_recovery_notifications",
      {
        p_limit: limit,
        p_lease_seconds: 120,
        p_dry_run: dryRun,
      },
    );
    if (claimError) {
      console.error("Recovery notification claim failed", {
        code: claimError.code,
      });
      throw new HttpError(503, "recovery_store_unavailable");
    }

    const recoveries = Array.isArray(claimData)
      ? claimData as ClaimedRecovery[]
      : [];
    if (recoveries.length === 0) {
      return jsonResponse(req, {
        message: "No notifications due",
        processed: 0,
        results: [{ step: "expire_cancelled", result: expireResult }],
      });
    }

    const notificationResults: Record<string, unknown>[] = [];
    let deliveredCount = 0;
    let failedCount = 0;
    let suppressedCount = 0;

    for (const recovery of recoveries) {
      if (!(recovery.timing in TIMING_LABELS)) {
        if (!dryRun) await completeRecovery(recovery, false);
        failedCount += 1;
        continue;
      }

      let recipient;
      try {
        recipient = await getNotificationRecipient(recovery.user_id);
      } catch (error) {
        console.error("Recovery recipient lookup failed", {
          code: error instanceof HttpError ? error.code : "unknown",
        });
        if (!dryRun) await completeRecovery(recovery, false);
        failedCount += 1;
        continue;
      }

      const payload = buildNotificationPayload(
        Number(recovery.delay_days),
        recipient.fullName,
      );
      const daysSinceExpiry = Math.floor(
        (Date.now() - new Date(recovery.expired_at).getTime()) /
          (24 * 60 * 60 * 1_000),
      );

      if (dryRun) {
        notificationResults.push({
          recovery_id: recovery.recovery_id,
          action: "dry_run_notification",
          timing: TIMING_LABELS[recovery.timing],
          days_since_expiry: daysSinceExpiry,
          payload,
        });
        continue;
      }

      const baseIdempotencyKey =
        `recovery:${recovery.recovery_id}:${recovery.timing}`;
      let pushSucceeded = false;
      let pushSuppressed = false;
      let emailSucceeded = false;
      let emailSuppressed = false;
      const subscriptionNotificationsEnabled = recipient.subscriptionUpdatesEnabled;

      if (subscriptionNotificationsEnabled && recipient.pushEnabled) {
        try {
          const { data, error } = await service.functions.invoke(
            "send-push-notification",
            {
              headers: { "x-internal-secret": downstreamSecret },
              body: {
                user_id: recovery.user_id,
                title: payload.title,
                message: payload.message,
                type: payload.type,
                data: { recovery_id: recovery.recovery_id },
                idempotency_key: `${baseIdempotencyKey}:push`,
              },
            },
          );
          pushSuppressed = !error && data?.success === true &&
            data?.suppressed === true;
          pushSucceeded = !error && data?.success === true &&
            data?.suppressed !== true;
        } catch (error) {
          console.error("Recovery push invocation failed", {
            name: error instanceof Error ? error.name : "unknown",
          });
        }
      }

      const email = recipient.email;
      if (subscriptionNotificationsEnabled && recipient.emailEnabled && email) {
        try {
          const { data, error } = await service.functions.invoke("send-email", {
            headers: { "x-internal-secret": downstreamSecret },
            body: {
              user_id: recovery.user_id,
              preference: "subscription_updates",
              subject: payload.title,
              text: payload.message,
              html: `<p>${escapeHtml(payload.message)}</p>`,
              idempotency_key: `${baseIdempotencyKey}:email`,
            },
          });
          emailSuppressed = !error && data?.success === true &&
            data?.suppressed === true;
          emailSucceeded = !error && data?.success === true &&
            data?.suppressed !== true;
        } catch (error) {
          console.error("Recovery email invocation failed", {
            name: error instanceof Error ? error.name : "unknown",
          });
        }
      }

      const delivered = pushSucceeded || emailSucceeded;
      const anyChannelEnabled = subscriptionNotificationsEnabled && (
        (recipient.pushEnabled && !pushSuppressed) ||
        (recipient.emailEnabled && Boolean(email) && !emailSuppressed)
      );
      const suppressed = !anyChannelEnabled;
      const completed = await completeRecovery(recovery, delivered || suppressed);
      if (delivered && completed) deliveredCount += 1;
      else if (suppressed && completed) suppressedCount += 1;
      else failedCount += 1;

      notificationResults.push({
        recovery_id: recovery.recovery_id,
        action: delivered && completed
          ? "notification_sent"
          : suppressed && completed
          ? "notification_suppressed"
          : "notification_deferred",
        timing: TIMING_LABELS[recovery.timing],
        days_since_expiry: daysSinceExpiry,
        channels: {
          push: pushSucceeded
            ? "sent"
            : pushSuppressed
            ? "suppressed"
            : subscriptionNotificationsEnabled && recipient.pushEnabled
            ? "failed"
            : "disabled",
          email: emailSucceeded
            ? "sent"
            : emailSuppressed
            ? "suppressed"
            : subscriptionNotificationsEnabled && recipient.emailEnabled && email
            ? "failed"
            : "disabled",
        },
      });
    }

    await recordSecurityEvent(req, {
      eventType: "notification.subscription_recovery_processed",
      category: "edge_function",
      severity: failedCount > 0 ? "medium" : "info",
      outcome: failedCount > 0 ? "failure" : "success",
      principal,
      actorType: authorizedInternal ? "service" : undefined,
      action: "process_subscription_recovery",
      resourceType: "subscription_recovery",
      metadata: {
        dry_run: dryRun,
        claimed: recoveries.length,
        delivered: deliveredCount,
        suppressed: suppressedCount,
        failed: failedCount,
      },
    });

    return jsonResponse(req, {
      message: dryRun
        ? "Dry run completed"
        : "Recovery notifications processed",
      expired_subscriptions: expireResult,
      notifications_processed: notificationResults.length,
      delivered: deliveredCount,
      suppressed: suppressedCount,
      failed: failedCount,
      results: notificationResults,
    });
  } catch (error) {
    await recordSecurityEvent(req, {
      eventType: "notification.subscription_recovery_failed",
      category: "edge_function",
      severity: "high",
      outcome: "failure",
      principal,
      actorType: authorizedInternal ? "service" : undefined,
      action: "process_subscription_recovery",
      resourceType: "subscription_recovery",
      metadata: {
        code: error instanceof HttpError ? error.code : "internal_error",
      },
    });
    return errorResponse(req, error);
  }
});
