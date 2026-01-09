import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AffiliateReport {
  user_id: string;
  email: string;
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

const handler = async (req: Request): Promise<Response> => {
  console.log("Monthly affiliate report function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current month date range
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const monthName = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    console.log(`Generating reports for ${monthName}`);

    // Get all active affiliates (those with any earnings or referrals)
    const { data: affiliates, error: affiliatesError } = await supabase
      .from("profiles")
      .select("user_id, full_name, affiliate_tier, affiliate_balance, total_affiliate_earnings")
      .or("total_affiliate_earnings.gt.0,tier1_referrer_id.not.is.null")
      .not("total_affiliate_earnings", "is", null);

    if (affiliatesError) {
      console.error("Error fetching affiliates:", affiliatesError);
      throw affiliatesError;
    }

    console.log(`Found ${affiliates?.length || 0} affiliates to report`);

    const reports: AffiliateReport[] = [];
    let emailsSent = 0;
    let emailsFailed = 0;

    for (const affiliate of affiliates || []) {
      try {
        // Get user email
        const { data: authUser } = await supabase.auth.admin.getUserById(affiliate.user_id);
        if (!authUser?.user?.email) continue;

        // Get monthly commissions
        const { data: commissions } = await supabase
          .from("affiliate_commissions")
          .select("commission_amount")
          .eq("user_id", affiliate.user_id)
          .gte("created_at", firstDayOfMonth.toISOString())
          .lte("created_at", lastDayOfMonth.toISOString());

        const monthlyCommissions = (commissions || []).reduce((sum, c) => sum + Number(c.commission_amount), 0);
        const monthlyCommissionCount = commissions?.length || 0;

        // Skip if no activity this month and no significant balance
        if (monthlyCommissions === 0 && (affiliate.affiliate_balance || 0) < 10) {
          continue;
        }

        // Get referral counts
        const { count: tier1Count } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("tier1_referrer_id", affiliate.user_id);

        const { count: tier2Count } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("tier2_referrer_id", affiliate.user_id);

        const { count: tier3Count } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("tier3_referrer_id", affiliate.user_id);

        // Get new referrals this month
        const { count: newReferrals } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("tier1_referrer_id", affiliate.user_id)
          .gte("created_at", firstDayOfMonth.toISOString());

        // Get milestones achieved this month
        const { count: milestonesAchieved } = await supabase
          .from("user_milestone_achievements")
          .select("*", { count: "exact", head: true })
          .eq("user_id", affiliate.user_id)
          .gte("achieved_at", firstDayOfMonth.toISOString());

        const report: AffiliateReport = {
          user_id: affiliate.user_id,
          email: authUser.user.email,
          full_name: affiliate.full_name || "Affiliate Partner",
          affiliate_tier: affiliate.affiliate_tier || "Bronze",
          total_earnings: affiliate.total_affiliate_earnings || 0,
          current_balance: affiliate.affiliate_balance || 0,
          monthly_commissions: monthlyCommissions,
          monthly_commission_count: monthlyCommissionCount,
          tier1_referrals: tier1Count || 0,
          tier2_referrals: tier2Count || 0,
          tier3_referrals: tier3Count || 0,
          new_referrals_this_month: newReferrals || 0,
          milestones_achieved: milestonesAchieved || 0,
        };

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

        await resend.emails.send({
          from: "Affiliate Program <onboarding@resend.dev>",
          to: [report.email],
          subject: `📊 Your ${monthName} Affiliate Report`,
          html: `
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
          `,
        });

        emailsSent++;
        console.log(`Report sent to ${report.email}`);
      } catch (err) {
        console.error(`Error processing affiliate ${affiliate.user_id}:`, err);
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
  } catch (error: any) {
    console.error("Error in send-monthly-affiliate-report function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
