import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
  requireAdmin,
  requirePost,
} from "../_shared/security.ts";

interface NotificationRequest {
  user_id: string;
  status: "approved" | "rejected";
  rejection_reason?: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    console.error("Affiliate status email delivery failed", {
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
    const principal = await requireAdmin(req);
    await enforceRateLimit(
      req,
      "affiliate-status-notification",
      principal.user.id,
      60,
      60 * 60,
    );
    const { user_id, status } = await readJsonBody<NotificationRequest>(req, 16 * 1024);
    if (!UUID_PATTERN.test(String(user_id)) || !["approved", "rejected"].includes(status)) {
      throw new HttpError(400, "invalid_notification_request");
    }

    const supabase = getServiceClient();
    const { data: application, error: applicationError } = await supabase
      .from("affiliate_applications")
      .select("id,user_id,status,rejection_reason")
      .eq("user_id", user_id)
      .eq("status", status)
      .order("reviewed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (applicationError) throw new HttpError(503, "application_lookup_failed");
    if (!application) throw new HttpError(409, "affiliate_application_state_mismatch");

    // Get user profile for name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, referral_code")
      .eq("user_id", user_id)
      .maybeSingle();

    const userName = escapeHtml(profile?.full_name || "there");
    const referralCode = escapeHtml(profile?.referral_code || "");
    const safeRejectionReason = status === "rejected" && application.rejection_reason
      ? escapeHtml(String(application.rejection_reason)).slice(0, 1000)
      : "";

    let subject: string;
    let htmlContent: string;

    if (status === "approved") {
      subject = "🎉 Your Affiliate Application Has Been Approved!";
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Our Affiliate Program!</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px;">
            <p style="font-size: 18px;">Hi ${userName},</p>
            
            <p>Great news! Your affiliate application has been <strong style="color: #10b981;">approved</strong>! 🎉</p>
            
            <p>You now have full access to our affiliate program and can start earning commissions by sharing your unique referral link.</p>
            
            <div style="background: white; border: 2px solid #10b981; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <p style="margin: 0 0 10px 0; color: #666;">Your Referral Code:</p>
              <p style="font-size: 24px; font-weight: bold; color: #10b981; margin: 0; letter-spacing: 2px;">${referralCode}</p>
            </div>
            
            <h3 style="color: #333;">What You Can Do Now:</h3>
            <ul style="padding-left: 20px;">
              <li>Share your referral link with friends and family</li>
              <li>Earn commissions on direct referrals (Tier 1)</li>
              <li>Earn additional commissions on Tier 2 and Tier 3 referrals</li>
              <li>Track your earnings and network in the Affiliate dashboard</li>
              <li>Request payouts when you reach the minimum threshold</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", ".lovable.app")}/affiliate" 
                 style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                Go to Affiliate Dashboard
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">Start sharing today and watch your earnings grow!</p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
            <p>You're receiving this because you applied for our affiliate program.</p>
          </div>
        </body>
        </html>
      `;
    } else {
      subject = "Update on Your Affiliate Application";
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Affiliate Application Update</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px;">
            <p style="font-size: 18px;">Hi ${userName},</p>
            
            <p>Thank you for your interest in our affiliate program. After careful review, we were unable to approve your application at this time.</p>
            
            ${safeRejectionReason ? `
              <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #991b1b;"><strong>Reason:</strong> ${safeRejectionReason}</p>
              </div>
            ` : ""}
            
            <p>This doesn't mean the door is closed forever. You're welcome to reapply in the future once the concerns above are addressed.</p>
            
            <p>In the meantime, you can still enjoy all the great features of our platform as a valued customer.</p>
            
            <p style="color: #666; font-size: 14px;">If you have questions about this decision, please contact our support team.</p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
            <p>You're receiving this because you applied for our affiliate program.</p>
          </div>
        </body>
        </html>
      `;
    }

    const delivery = await sendIdempotentEmail(
      user_id,
      subject,
      htmlContent,
      `affiliate-status:${application.id}:${status}`,
    );

    await recordSecurityEvent(req, {
      eventType: "admin.affiliate_status_notification_sent",
      category: "admin",
      severity: "medium",
      outcome: "success",
      principal,
      action: `notify_${status}`,
      resourceType: "auth.user",
      resourceId: user_id,
      metadata: {
        status,
        duplicate: delivery.duplicate,
        suppressed: delivery.suppressed,
      },
    });

    return new Response(JSON.stringify({ success: true, ...delivery }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Affiliate status notification failed", {
      code: error instanceof HttpError ? error.code : "internal_error",
    });
    return errorResponse(req, error);
  }
};

serve(handler);
