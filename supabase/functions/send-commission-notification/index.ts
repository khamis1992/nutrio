import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  enforceRateLimit,
  errorResponse,
  escapeHtml,
  getClientIp,
  getCorsHeaders,
  getServiceClient,
  handlePreflight,
  HttpError,
  readJsonBody,
  requireAdminOrInternal,
  requirePost,
} from "../_shared/security.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface CommissionNotificationRequest {
  commission_id?: unknown;
  user_id?: unknown;
}

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
    console.error("Commission email delivery failed", {
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

const handler = async (req: Request): Promise<Response> => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  try {
    requirePost(req);
    const principal = await requireAdminOrInternal(req, "AFFILIATE_NOTIFICATION_SECRET");
    await enforceRateLimit(
      req,
      "affiliate-commission-notification",
      principal?.user.id || getClientIp(req) || "internal",
      principal ? 120 : 5000,
      60 * 60,
    );
    const supabase = getServiceClient();

    const body = await readJsonBody<CommissionNotificationRequest>(req, 16 * 1024);
    const commissionId = String(body.commission_id || "").trim();
    if (!UUID_PATTERN.test(commissionId)) {
      throw new HttpError(400, "valid_commission_id_required");
    }

    const { data: commission, error: commissionError } = await supabase
      .from("affiliate_commissions")
      .select("id,user_id,commission_amount,tier,order_amount")
      .eq("id", commissionId)
      .maybeSingle();
    if (commissionError) throw new HttpError(503, "commission_lookup_failed");
    if (!commission) throw new HttpError(404, "commission_not_found");

    const user_id = String(commission.user_id);
    if (body.user_id !== undefined && String(body.user_id) !== user_id) {
      throw new HttpError(409, "commission_recipient_mismatch");
    }
    const commission_amount = Number(commission.commission_amount);
    const tier = Number(commission.tier);
    const order_amount = Number(commission.order_amount);
    if (
      !Number.isFinite(commission_amount) || commission_amount < 0 ||
      !Number.isFinite(order_amount) || order_amount < 0 ||
      ![1, 2, 3].includes(tier)
    ) {
      throw new HttpError(409, "invalid_commission_record");
    }

    // Get user profile for name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user_id)
      .single();

    const userName = escapeHtml(profile?.full_name || "Affiliate Partner");

    const tierLabels: Record<number, string> = {
      1: "Direct Referral",
      2: "Second-Tier",
      3: "Third-Tier",
    };

    const tierLabel = tierLabels[tier] || `Tier ${tier}`;

    const subject = `🎉 You earned $${commission_amount.toFixed(2)} in commission!`;
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Commission Earned!</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 18px; margin-top: 0;">Hi ${userName},</p>
            
            <p>Great news! You've just earned a commission from your affiliate network.</p>
            
            <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
                    <strong>Commission Type:</strong>
                  </td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">
                    ${tierLabel}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
                    <strong>Order Value:</strong>
                  </td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">
                    $${order_amount.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0;">
                    <strong style="font-size: 18px; color: #059669;">Commission Earned:</strong>
                  </td>
                  <td style="padding: 10px 0; text-align: right;">
                    <strong style="font-size: 24px; color: #059669;">$${commission_amount.toFixed(2)}</strong>
                  </td>
                </tr>
              </table>
            </div>
            
            <p>Keep sharing your referral link to earn more commissions!</p>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="#" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Your Dashboard</a>
            </div>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
            <p>You're receiving this email because you're part of our affiliate program.</p>
          </div>
        </body>
        </html>
      `;
    const delivery = await sendIdempotentEmail(
      user_id,
      subject,
      html,
      `affiliate-commission:${commissionId}`,
    );

    return new Response(
      JSON.stringify({ success: true, ...delivery }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Commission notification failed", {
      code: error instanceof HttpError ? error.code : "internal_error",
    });
    return errorResponse(req, error);
  }
};

serve(handler);
