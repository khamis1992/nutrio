import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeRequest {
  user_id: string;
  referral_code: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Affiliate welcome email function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, referral_code }: WelcomeRequest = await req.json();

    console.log(`Sending welcome email to user ${user_id} with code ${referral_code}`);

    // Get user email
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(user_id);

    if (authError || !authUser?.user?.email) {
      console.error("Error fetching user email:", authError);
      return new Response(
        JSON.stringify({ error: "User not found or no email" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userEmail = authUser.user.email;

    // Get user profile and affiliate settings
    const [profileResult, settingsResult] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("user_id", user_id).single(),
      supabase.from("platform_settings").select("value").eq("key", "affiliate_settings").single(),
    ]);

    const userName = profileResult.data?.full_name || "Partner";
    const settings = settingsResult.data?.value as any || {
      tier1_commission: 5,
      tier2_commission: 2,
      tier3_commission: 1,
    };

    const referralLink = `https://your-app.com/auth?ref=${referral_code}`;

    // Send welcome email
    const emailResponse = await resend.emails.send({
      from: "Affiliate Program <onboarding@resend.dev>",
      to: [userEmail],
      subject: "🎉 Welcome to Our Affiliate Program!",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <div style="font-size: 56px; margin-bottom: 16px;">🎉</div>
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Our<br>Affiliate Program!</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 18px; margin-top: 0;">Hi ${userName},</p>
            
            <p>We're thrilled to have you as part of our affiliate family! You're now set up to earn commissions by sharing healthy meals with your friends, family, and followers.</p>

            <!-- Referral Code Box -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
              <p style="margin: 0 0 8px 0; color: rgba(255,255,255,0.8); font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Your Referral Code</p>
              <p style="margin: 0; color: white; font-size: 32px; font-weight: bold; font-family: monospace; letter-spacing: 4px;">${referral_code}</p>
            </div>

            <!-- Commission Structure -->
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin: 24px 0;">
              <h3 style="margin: 0 0 16px 0; color: #333; font-size: 18px;">💰 Your Commission Structure</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
                    <strong style="color: #667eea;">Tier 1</strong> - Direct Referrals
                  </td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; text-align: right; font-weight: bold; color: #059669; font-size: 18px;">
                    ${settings.tier1_commission}%
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
                    <strong style="color: #8b5cf6;">Tier 2</strong> - Their Referrals
                  </td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; text-align: right; font-weight: bold; color: #059669; font-size: 18px;">
                    ${settings.tier2_commission}%
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0;">
                    <strong style="color: #06b6d4;">Tier 3</strong> - Extended Network
                  </td>
                  <td style="padding: 12px 0; text-align: right; font-weight: bold; color: #059669; font-size: 18px;">
                    ${settings.tier3_commission}%
                  </td>
                </tr>
              </table>
            </div>

            <!-- How It Works -->
            <div style="background: #fef3c7; border-radius: 12px; padding: 24px; margin: 24px 0;">
              <h3 style="margin: 0 0 16px 0; color: #92400e; font-size: 18px;">📋 How It Works</h3>
              <ol style="margin: 0; padding-left: 20px; color: #78350f;">
                <li style="margin-bottom: 12px;"><strong>Share your code</strong> - Send your referral code or link to friends</li>
                <li style="margin-bottom: 12px;"><strong>They sign up</strong> - When they join using your code, they become your referral</li>
                <li style="margin-bottom: 12px;"><strong>Earn commissions</strong> - Get a percentage of every order they place</li>
                <li style="margin-bottom: 0;"><strong>Grow your network</strong> - Earn from their referrals too (up to 3 tiers!)</li>
              </ol>
            </div>

            <!-- Tier Progression -->
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin: 24px 0;">
              <h3 style="margin: 0 0 16px 0; color: #333; font-size: 18px;">🏆 Tier Progression</h3>
              <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 14px;">Earn more by growing your network! Higher tiers mean higher commissions.</p>
              <div style="display: flex; justify-content: space-between; text-align: center; flex-wrap: wrap; gap: 8px;">
                <div style="flex: 1; min-width: 80px; padding: 12px; background: linear-gradient(135deg, #CD7F32 0%, #8B4513 100%); border-radius: 8px;">
                  <p style="margin: 0; font-size: 20px;">🥉</p>
                  <p style="margin: 4px 0 0 0; color: white; font-size: 12px; font-weight: bold;">Bronze</p>
                </div>
                <div style="flex: 1; min-width: 80px; padding: 12px; background: linear-gradient(135deg, #C0C0C0 0%, #A8A8A8 100%); border-radius: 8px;">
                  <p style="margin: 0; font-size: 20px;">🥈</p>
                  <p style="margin: 4px 0 0 0; color: #333; font-size: 12px; font-weight: bold;">Silver</p>
                </div>
                <div style="flex: 1; min-width: 80px; padding: 12px; background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); border-radius: 8px;">
                  <p style="margin: 0; font-size: 20px;">🥇</p>
                  <p style="margin: 4px 0 0 0; color: white; font-size: 12px; font-weight: bold;">Gold</p>
                </div>
                <div style="flex: 1; min-width: 80px; padding: 12px; background: linear-gradient(135deg, #E5E4E2 0%, #BCC6CC 100%); border-radius: 8px;">
                  <p style="margin: 0; font-size: 20px;">💎</p>
                  <p style="margin: 4px 0 0 0; color: #333; font-size: 12px; font-weight: bold;">Platinum</p>
                </div>
                <div style="flex: 1; min-width: 80px; padding: 12px; background: linear-gradient(135deg, #B9F2FF 0%, #00CED1 100%); border-radius: 8px;">
                  <p style="margin: 0; font-size: 20px;">👑</p>
                  <p style="margin: 4px 0 0 0; color: #333; font-size: 12px; font-weight: bold;">Diamond</p>
                </div>
              </div>
            </div>

            <!-- CTA -->
            <div style="text-align: center; margin-top: 30px;">
              <a href="#" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">Start Earning Now</a>
            </div>

            <p style="margin-top: 24px; color: #6b7280; font-size: 14px; text-align: center;">
              Questions? Reply to this email or visit our help center.
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
            <p>Welcome to the team! We're excited to have you.</p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Welcome email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailResponse }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-affiliate-welcome function:", error);
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
