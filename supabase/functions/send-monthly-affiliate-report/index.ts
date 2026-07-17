import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  enforceRateLimit,
  errorResponse,
  escapeHtml,
  getCorsHeaders,
  getClientIp,
  getServiceClient,
  handlePreflight,
  HttpError,
  requireAdminOrInternal,
  requirePost,
} from "../_shared/security.ts";

interface AffiliateReport {
  user_id: string;
  full_name: string;
  affiliate_tier: string;
  total_earnings: number;
  current_balance: number;
  monthly_commissions: number;
  monthly_commission_count: number;
  tier1_referrals: number;
  tier2_referrals: number;
  tier3_referrals: number;
  new_referrals_this_month: number;
  milestones_achieved: number;
}

function financialValue(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000) {
    throw new HttpError(409, "invalid_affiliate_financial_record");
  }
  return amount;
}

function reportCount(value: unknown): number {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 0 || count > 1_000_000_000) {
    throw new HttpError(409, "invalid_affiliate_report_snapshot");
  }
  return count;
}

function normalizeReportSnapshot(
  value: unknown,
  expectedUserId: string,
): AffiliateReport {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(503, "affiliate_report_snapshot_unavailable");
  }
  const snapshot = value as Record<string, unknown>;
  const tier = String(snapshot.affiliate_tier || "").toLowerCase();
  if (
    snapshot.user_id !== expectedUserId ||
    typeof snapshot.full_name !== "string" ||
    snapshot.full_name.length > 300 ||
    !["bronze", "silver", "gold", "platinum", "diamond"].includes(tier)
  ) {
    throw new HttpError(409, "invalid_affiliate_report_snapshot");
  }

  return {
    user_id: expectedUserId,
    full_name: snapshot.full_name,
    affiliate_tier: tier,
    total_earnings: financialValue(snapshot.total_earnings),
    current_balance: financialValue(snapshot.current_balance),
    monthly_commissions: financialValue(snapshot.monthly_commissions),
    monthly_commission_count: reportCount(snapshot.monthly_commission_count),
    tier1_referrals: reportCount(snapshot.tier1_referrals),
    tier2_referrals: reportCount(snapshot.tier2_referrals),
    tier3_referrals: reportCount(snapshot.tier3_referrals),
    new_referrals_this_month: reportCount(snapshot.new_referrals_this_month),
    milestones_achieved: reportCount(snapshot.milestones_achieved),
  };
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
    console.error("Monthly affiliate email delivery failed", {
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
      "monthly-affiliate-report",
      principal?.user.id || getClientIp(req) || "internal",
      2,
      60 * 60,
    );
    const supabase = getServiceClient();

    // Get current month date range
    const now = new Date();
    const firstDayOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const firstDayOfNextMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );
    const monthKey = firstDayOfMonth.toISOString().slice(0, 7);
    const monthName = now.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

    // Get all active affiliates (those with any earnings or referrals)
    const { data: affiliates, error: affiliatesError } = await supabase
      .from("profiles")
      .select("user_id, full_name, affiliate_tier, affiliate_balance, total_affiliate_earnings")
      .or("total_affiliate_earnings.gt.0,tier1_referrer_id.not.is.null")
      .not("total_affiliate_earnings", "is", null);

    if (affiliatesError) {
      console.error("Affiliate report lookup failed", { code: affiliatesError.code });
      throw affiliatesError;
    }

    console.log(`Found ${affiliates?.length || 0} affiliates to report`);

    const reports: AffiliateReport[] = [];
    let emailsSent = 0;
    let emailsFailed = 0;

    for (const affiliate of affiliates || []) {
      try {
        // Get monthly commissions
        const { data: commissions, error: commissionsError } = await supabase
          .from("affiliate_commissions")
          .select("commission_amount")
          .eq("user_id", affiliate.user_id)
          .gte("created_at", firstDayOfMonth.toISOString())
          .lt("created_at", firstDayOfNextMonth.toISOString());
        if (commissionsError) throw new HttpError(503, "commission_report_lookup_failed");

        const monthlyCommissions = (commissions || []).reduce(
          (sum, commission) => sum + financialValue(commission.commission_amount),
          0,
        );
        const monthlyCommissionCount = commissions?.length || 0;
        const affiliateBalance = financialValue(affiliate.affiliate_balance || 0);
        const totalAffiliateEarnings = financialValue(
          affiliate.total_affiliate_earnings || 0,
        );

        // Skip if no activity this month and no significant balance
        if (monthlyCommissions === 0 && affiliateBalance < 10) {
          continue;
        }

        // Get referral counts
        const { count: tier1Count, error: tier1Error } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("tier1_referrer_id", affiliate.user_id);

        const { count: tier2Count, error: tier2Error } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("tier2_referrer_id", affiliate.user_id);

        const { count: tier3Count, error: tier3Error } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("tier3_referrer_id", affiliate.user_id);

        // Get new referrals this month
        const { count: newReferrals, error: newReferralsError } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("tier1_referrer_id", affiliate.user_id)
          .gte("created_at", firstDayOfMonth.toISOString())
          .lt("created_at", firstDayOfNextMonth.toISOString());

        // Get milestones achieved this month
        const { count: milestonesAchieved, error: milestonesError } = await supabase
          .from("user_milestone_achievements")
          .select("*", { count: "exact", head: true })
          .eq("user_id", affiliate.user_id)
          .gte("achieved_at", firstDayOfMonth.toISOString())
          .lt("achieved_at", firstDayOfNextMonth.toISOString());
        if (
          tier1Error || tier2Error || tier3Error || newReferralsError ||
          milestonesError
        ) {
          throw new HttpError(503, "affiliate_report_aggregation_failed");
        }

        const normalizedTier = String(affiliate.affiliate_tier || "bronze")
          .trim()
          .toLowerCase();
        const safeTier = ["bronze", "silver", "gold", "platinum", "diamond"]
          .includes(normalizedTier)
          ? normalizedTier
          : "bronze";
        const draftReport: AffiliateReport = {
          user_id: affiliate.user_id,
          full_name: escapeHtml(affiliate.full_name || "Affiliate Partner"),
          affiliate_tier: safeTier,
          total_earnings: totalAffiliateEarnings,
          current_balance: affiliateBalance,
          monthly_commissions: monthlyCommissions,
          monthly_commission_count: monthlyCommissionCount,
          tier1_referrals: tier1Count || 0,
          tier2_referrals: tier2Count || 0,
          tier3_referrals: tier3Count || 0,
          new_referrals_this_month: newReferrals || 0,
          milestones_achieved: milestonesAchieved || 0,
        };

        const { data: snapshot, error: snapshotError } = await supabase.rpc(
          "get_or_create_monthly_affiliate_report_snapshot",
          {
            p_user_id: affiliate.user_id,
            p_report_month: firstDayOfMonth.toISOString().slice(0, 10),
            p_payload: draftReport,
          },
        );
        if (snapshotError) {
          throw new HttpError(503, "affiliate_report_snapshot_unavailable");
        }
        const report = normalizeReportSnapshot(snapshot, affiliate.user_id);

        reports.push(report);

        // Send email
        const tierColors: Record<string, string> = {
          bronze: "#CD7F32",
          silver: "#C0C0C0",
          gold: "#FFD700",
          platinum: "#E5E4E2",
          diamond: "#B9F2FF",
        };

        const tierColor = tierColors[report.affiliate_tier.toLowerCase()] || "#CD7F32";

        const subject = `📊 Your ${monthName} Affiliate Report`;
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">📊 Monthly Performance Report</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">${monthName}</p>
              </div>
              
              <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
                <p style="font-size: 18px; margin-top: 0;">Hi ${report.full_name},</p>
                
                <p>Here's your affiliate performance summary for this month:</p>

                <!-- Tier Badge -->
                <div style="text-align: center; margin: 20px 0;">
                  <span style="background: ${tierColor}; color: ${report.affiliate_tier.toLowerCase() === 'silver' || report.affiliate_tier.toLowerCase() === 'platinum' ? '#333' : 'white'}; padding: 8px 24px; border-radius: 20px; font-weight: bold; font-size: 14px; text-transform: uppercase;">
                    ${report.affiliate_tier} Tier
                  </span>
                </div>
                
                <!-- This Month's Earnings -->
                <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); border-radius: 12px; padding: 24px; margin: 20px 0; text-align: center;">
                  <p style="margin: 0; color: rgba(255,255,255,0.8); font-size: 14px;">This Month's Earnings</p>
                  <p style="margin: 8px 0 0 0; color: white; font-size: 36px; font-weight: bold;">$${report.monthly_commissions.toFixed(2)}</p>
                  <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.8); font-size: 12px;">${report.monthly_commission_count} commission${report.monthly_commission_count !== 1 ? 's' : ''}</p>
                </div>

                <!-- Stats Grid -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0;">
                  <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center;">
                    <p style="margin: 0; color: #6b7280; font-size: 12px;">Current Balance</p>
                    <p style="margin: 4px 0 0 0; font-size: 24px; font-weight: bold; color: #059669;">$${report.current_balance.toFixed(2)}</p>
                  </div>
                  <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center;">
                    <p style="margin: 0; color: #6b7280; font-size: 12px;">Total Earnings</p>
                    <p style="margin: 4px 0 0 0; font-size: 24px; font-weight: bold; color: #667eea;">$${report.total_earnings.toFixed(2)}</p>
                  </div>
                </div>

                <!-- Referral Network -->
                <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
                  <h3 style="margin: 0 0 16px 0; font-size: 16px;">Your Referral Network</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;">Tier 1 (Direct)</td>
                      <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; text-align: right; font-weight: bold;">${report.tier1_referrals}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;">Tier 2</td>
                      <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; text-align: right; font-weight: bold;">${report.tier2_referrals}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0;">Tier 3</td>
                      <td style="padding: 8px 0; text-align: right; font-weight: bold;">${report.tier3_referrals}</td>
                    </tr>
                  </table>
                </div>

                <!-- Monthly Highlights -->
                ${report.new_referrals_this_month > 0 || report.milestones_achieved > 0 ? `
                <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 20px 0;">
                  <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #92400e;">🌟 Monthly Highlights</h3>
                  <ul style="margin: 0; padding-left: 20px; color: #78350f;">
                    ${report.new_referrals_this_month > 0 ? `<li>${report.new_referrals_this_month} new referral${report.new_referrals_this_month !== 1 ? 's' : ''} this month!</li>` : ''}
                    ${report.milestones_achieved > 0 ? `<li>${report.milestones_achieved} milestone${report.milestones_achieved !== 1 ? 's' : ''} unlocked!</li>` : ''}
                  </ul>
                </div>
                ` : ''}

                <div style="text-align: center; margin-top: 30px;">
                  <a href="#" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Full Dashboard</a>
                </div>

                <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
                  Keep up the great work! Continue sharing your referral link to grow your network and earnings.
                </p>
              </div>
              
              <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
                <p>You're receiving this monthly report as an active affiliate partner.</p>
              </div>
            </body>
            </html>
          `;
        const delivery = await sendIdempotentEmail(
          report.user_id,
          subject,
          html,
          `affiliate-monthly:${monthKey}:${report.user_id}`,
        );

        if (!delivery.duplicate && !delivery.suppressed) emailsSent++;
      } catch (err) {
        console.error("Monthly affiliate report item failed", {
          code: err instanceof HttpError ? err.code : "internal_error",
        });
        emailsFailed++;
      }
    }

    console.log(`Monthly reports complete: ${emailsSent} sent, ${emailsFailed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailsSent, 
        emailsFailed,
        totalAffiliates: reports.length 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Monthly affiliate report failed", {
      code: error instanceof HttpError ? error.code : "internal_error",
    });
    return errorResponse(req, error);
  }
};

serve(handler);
