import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CommissionNotificationRequest {
  user_id: string;
  commission_amount: number;
  tier: number;
  order_amount: number;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Commission notification function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, commission_amount, tier, order_amount }: CommissionNotificationRequest = await req.json();

    console.log(`Processing commission notification for user ${user_id}: $${commission_amount} (Tier ${tier})`);

    // Get user email from auth.users
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(user_id);

    if (authError || !authUser?.user?.email) {
      console.error("Error fetching user email:", authError);
      return new Response(
        JSON.stringify({ error: "User not found or no email" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userEmail = authUser.user.email;

    // Get user profile for name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, affiliate_balance, total_affiliate_earnings")
      .eq("user_id", user_id)
      .single();

    const userName = profile?.full_name || "Affiliate Partner";
    const currentBalance = profile?.affiliate_balance || 0;
    const totalEarnings = profile?.total_affiliate_earnings || 0;

    const tierLabels: Record<number, string> = {
      1: "Direct Referral",
      2: "Second-Tier",
      3: "Third-Tier",
    };

    const tierLabel = tierLabels[tier] || `Tier ${tier}`;

    // Send email notification
    const emailResponse = await resend.emails.send({
      from: "Affiliate Program <onboarding@resend.dev>",
      to: [userEmail],
      subject: `🎉 You earned $${commission_amount.toFixed(2)} in commission!`,
      html: `
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
            
            <div style="background: #ecfdf5; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #065f46;">
                <strong>Your current balance:</strong> $${currentBalance.toFixed(2)}<br>
                <strong>Total earnings:</strong> $${totalEarnings.toFixed(2)}
              </p>
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
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailResponse }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-commission-notification function:", error);
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
