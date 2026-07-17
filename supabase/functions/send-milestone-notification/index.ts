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

interface MilestoneNotificationRequest {
  achievement_id?: unknown;
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
    console.error("Milestone email delivery failed", {
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
      "affiliate-milestone-notification",
      principal?.user.id || getClientIp(req) || "internal",
      principal ? 60 : 500,
      60 * 60,
    );
    const supabase = getServiceClient();

    const body = await readJsonBody<MilestoneNotificationRequest>(req, 16 * 1024);
    const achievementId = String(body.achievement_id || "").trim();
    if (!UUID_PATTERN.test(achievementId)) {
      throw new HttpError(400, "valid_achievement_id_required");
    }

    const { data: achievement, error: achievementError } = await supabase
      .from("user_milestone_achievements")
      .select("id,user_id,milestone_id")
      .eq("id", achievementId)
      .maybeSingle();
    if (achievementError) throw new HttpError(503, "achievement_lookup_failed");
    if (!achievement) throw new HttpError(404, "achievement_not_found");
    const user_id = String(achievement.user_id);
    if (body.user_id !== undefined && String(body.user_id) !== user_id) {
      throw new HttpError(409, "achievement_recipient_mismatch");
    }

    const { data: milestone, error: milestoneError } = await supabase
      .from("referral_milestones")
      .select("name,description,bonus_amount,referral_count")
      .eq("id", achievement.milestone_id)
      .maybeSingle();
    if (milestoneError) throw new HttpError(503, "milestone_lookup_failed");
    if (!milestone) throw new HttpError(404, "milestone_not_found");

    const bonus_amount = Number(milestone.bonus_amount);
    const referral_count = Number(milestone.referral_count);
    const milestone_name = escapeHtml(String(milestone.name || "")).slice(0, 200);
    const milestone_description = escapeHtml(String(milestone.description || ""))
      .slice(0, 1000);
    if (
      !milestone_name || !Number.isFinite(bonus_amount) || bonus_amount < 0 ||
      !Number.isInteger(referral_count) || referral_count < 0
    ) {
      throw new HttpError(409, "invalid_milestone_record");
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user_id)
      .single();

    const userName = escapeHtml(profile?.full_name || "Affiliate Partner");

    const subject = `🏆 Milestone Unlocked: ${milestone_name}!`;
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 10px;">🏆</div>
            <h1 style="color: white; margin: 0; font-size: 28px;">Milestone Unlocked!</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 18px;">${milestone_name}</p>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 18px; margin-top: 0;">Congratulations, ${userName}! 🎉</p>
            
            <p>You've reached an incredible milestone in our affiliate program!</p>
            
            <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 24px; margin: 20px 0; text-align: center; border: 2px solid #f59e0b;">
              <p style="margin: 0 0 8px 0; color: #92400e; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">Milestone Achieved</p>
              <h2 style="margin: 0 0 8px 0; color: #78350f; font-size: 24px;">${milestone_name}</h2>
              ${milestone_description ? `<p style="margin: 0 0 12px 0; color: #92400e;">${milestone_description}</p>` : ""}
              <p style="margin: 0 0 16px 0; color: #92400e; font-size: 14px;">${referral_count} Referrals</p>
              <div style="background: white; border-radius: 8px; padding: 16px; display: inline-block;">
                <p style="margin: 0; color: #065f46; font-size: 14px;">Bonus Earned</p>
                <p style="margin: 0; color: #059669; font-size: 32px; font-weight: bold;">$${bonus_amount.toFixed(2)}</p>
              </div>
            </div>
            
            <div style="background: #ecfdf5; border-radius: 8px; padding: 15px; margin: 20px 0; border-left: 4px solid #059669;">
              <p style="margin: 0; color: #065f46;">
                <strong>Keep going!</strong> Your bonus has been automatically added to your affiliate balance. Continue referring friends to unlock even more rewards!
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="#" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Your Progress</a>
            </div>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
            <p>You're receiving this email because you achieved a milestone in our affiliate program.</p>
          </div>
        </body>
        </html>
      `;
    const delivery = await sendIdempotentEmail(
      user_id,
      subject,
      html,
      `affiliate-milestone:${achievementId}`,
    );

    return new Response(
      JSON.stringify({ success: true, ...delivery }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Milestone notification failed", {
      code: error instanceof HttpError ? error.code : "internal_error",
    });
    return errorResponse(req, error);
  }
};

serve(handler);
