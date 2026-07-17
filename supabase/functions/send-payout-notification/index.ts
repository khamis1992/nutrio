import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import { getNotificationRecipient } from "../_shared/notificationRecipient.ts";
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
  requireAdmin,
  requirePost,
  type SecurityPrincipal,
} from "../_shared/security.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function sendIdempotentEmail(
  userId: string,
  subject: string,
  html: string,
  idempotencyKey: string,
): Promise<{ duplicate: boolean; suppressed: boolean }> {
  const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET") || "";
  if (!internalSecret) throw new HttpError(503, "email_delivery_not_configured");

  const { data, error, response } = await getServiceClient().functions.invoke(
    "send-email",
    {
      headers: { "x-internal-secret": internalSecret },
      body: {
        user_id: userId,
        subject,
        html,
        preference: "email_notifications",
        idempotency_key: idempotencyKey,
      },
    },
  );
  if (error) {
    if (response?.status === 409) return { duplicate: true, suppressed: false };
    console.error("Payout email delivery failed", {
      status: response?.status || 0,
      name: error.name,
    });
    throw new HttpError(502, "email_delivery_failed");
  }
  const result = data && typeof data === "object"
    ? data as Record<string, unknown>
    : {};
  return {
    duplicate: result.duplicate === true,
    suppressed: result.suppressed === true,
  };
}

function safeAppUrl(): string | null {
  const configured = Deno.env.get("APP_URL") || "";
  try {
    const parsed = new URL(configured);
    return parsed.protocol === "https:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

serve(async (req: Request): Promise<Response> => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  let principal: SecurityPrincipal | null = null;
  let payoutId: string | null = null;

  try {
    requirePost(req);
    principal = await requireAdmin(req);
    await enforceRateLimit(
      req,
      "payout-notification",
      principal.user.id,
      30,
      60 * 60,
    );

    const body = await readJsonBody<{ payout_id?: string }>(req, 4 * 1024);
    payoutId = String(body.payout_id || "").trim();
    if (!UUID_PATTERN.test(payoutId)) {
      throw new HttpError(400, "invalid_payout_reference");
    }

    const service = getServiceClient();
    const { data: payout, error: payoutError } = await service
      .from("affiliate_payouts")
      .select("id,user_id,amount,status,payout_method,notes")
      .eq("id", payoutId)
      .maybeSingle();
    if (payoutError) throw payoutError;
    if (!payout) throw new HttpError(404, "payout_not_found");
    if (!["processing", "completed", "rejected"].includes(payout.status)) {
      throw new HttpError(409, "payout_status_not_notifiable");
    }

    const recipient = await getNotificationRecipient(payout.user_id);
    if (!recipient.email || !recipient.emailEnabled) {
      await recordSecurityEvent(req, {
        eventType: "affiliate.payout_notification.skipped",
        category: "admin",
        severity: "info",
        outcome: "success",
        principal,
        action: "send_payout_notification",
        resourceType: "public.affiliate_payouts",
        resourceId: payout.id,
        metadata: { reason: recipient.email ? "email_disabled" : "verified_email_missing" },
      });
      return jsonResponse(req, { success: true, delivered: false, skipped: true });
    }

    const statusLabel = payout.status === "processing"
      ? "approved for transfer"
      : payout.status === "completed"
        ? "transferred"
        : "rejected";
    const amount = Number(payout.amount || 0);
    if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000) {
      throw new HttpError(409, "invalid_payout_record");
    }
    const payoutMethod = escapeHtml(
      String(payout.payout_method || "bank_transfer").replaceAll("_", " ").slice(0, 100),
    );
    const rejectionReason = payout.status === "rejected" && payout.notes
      ? escapeHtml(String(payout.notes).slice(0, 1000))
      : "";
    const appUrl = safeAppUrl();
    const subject = `Affiliate payout ${statusLabel}`;
    const html = `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a">
          <h1 style="font-size:24px">Payout ${escapeHtml(statusLabel)}</h1>
          <p>Hi ${escapeHtml(recipient.fullName || "Affiliate Partner")},</p>
          <p>Your QAR ${escapeHtml(amount.toFixed(2))} payout is now <strong>${escapeHtml(statusLabel)}</strong>.</p>
          <p>Method: ${payoutMethod}</p>
          ${rejectionReason ? `<p>Reason: ${rejectionReason}</p>` : ""}
          ${appUrl ? `<p><a href="${escapeHtml(appUrl)}/affiliate">View payout history</a></p>` : ""}
        </div>
      `;
    const delivery = await sendIdempotentEmail(
      payout.user_id,
      subject,
      html,
      `affiliate-payout:${payout.id}:${payout.status}`,
    );

    await recordSecurityEvent(req, {
      eventType: "affiliate.payout_notification.sent",
      category: "admin",
      severity: "info",
      outcome: "success",
      principal,
      action: "send_payout_notification",
      resourceType: "public.affiliate_payouts",
      resourceId: payout.id,
      metadata: {
        status: payout.status,
        channel: "email",
        duplicate: delivery.duplicate,
        suppressed: delivery.suppressed,
      },
    });

    return jsonResponse(req, {
      success: true,
      delivered: !delivery.suppressed,
      duplicate: delivery.duplicate,
      suppressed: delivery.suppressed,
      payout_id: payout.id,
    });
  } catch (error) {
    if (principal) {
      await recordSecurityEvent(req, {
        eventType: "affiliate.payout_notification.failed",
        category: "admin",
        severity: "medium",
        outcome: error instanceof HttpError && [401, 403, 429].includes(error.status)
          ? "denied"
          : "failure",
        principal,
        action: "send_payout_notification",
        resourceType: "public.affiliate_payouts",
        resourceId: payoutId || undefined,
        metadata: { error_code: error instanceof HttpError ? error.code : "internal_error" },
      });
    }
    return errorResponse(req, error);
  }
});
