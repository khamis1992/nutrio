import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

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

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new HttpError(503, "email_provider_not_configured");

    const statusLabel = payout.status === "processing"
      ? "approved for transfer"
      : payout.status === "completed"
        ? "transferred"
        : "rejected";
    const amount = Number(payout.amount || 0);
    const appUrl = safeAppUrl();
    const resend = new Resend(resendKey);
    const { error: emailError } = await resend.emails.send({
      from: Deno.env.get("PAYOUT_EMAIL_FROM") || "Nutrio <noreply@nutrio.qa>",
      to: [recipient.email],
      subject: `Affiliate payout ${statusLabel}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a">
          <h1 style="font-size:24px">Payout ${escapeHtml(statusLabel)}</h1>
          <p>Hi ${escapeHtml(recipient.fullName || "Affiliate Partner")},</p>
          <p>Your QAR ${escapeHtml(amount.toFixed(2))} payout is now <strong>${escapeHtml(statusLabel)}</strong>.</p>
          <p>Method: ${escapeHtml(String(payout.payout_method || "bank_transfer").replaceAll("_", " "))}</p>
          ${payout.status === "rejected" && payout.notes ? `<p>Reason: ${escapeHtml(payout.notes)}</p>` : ""}
          ${appUrl ? `<p><a href="${escapeHtml(appUrl)}/affiliate">View payout history</a></p>` : ""}
        </div>
      `,
    });
    if (emailError) {
      console.error("Payout email provider rejected request", { name: emailError.name });
      throw new HttpError(502, "email_send_failed");
    }

    await recordSecurityEvent(req, {
      eventType: "affiliate.payout_notification.sent",
      category: "admin",
      severity: "info",
      outcome: "success",
      principal,
      action: "send_payout_notification",
      resourceType: "public.affiliate_payouts",
      resourceId: payout.id,
      metadata: { status: payout.status, channel: "email" },
    });

    return jsonResponse(req, { success: true, delivered: true, payout_id: payout.id });
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
