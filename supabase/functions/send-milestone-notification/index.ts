import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MilestoneNotificationRequest {
  user_id: string;
  milestone_name: string;
  milestone_description: string;
  bonus_amount: number;
  referral_count: number;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Milestone notification function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, milestone_name, milestone_description, bonus_amount, referral_count }: MilestoneNotificationRequest = await req.json();

    console.log(`Processing milestone notification for user ${user_id}: ${milestone_name}`);

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

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, affiliate_balance, total_affiliate_earnings")
      .eq("user_id", user_id)
      .single();

    const userName = profile?.full_name || "Affiliate Partner";
    const currentBalance = profile?.affiliate_balance || 0;
    const totalEarnings = profile?.total_affiliate_earnings || 0;

    // Send email notification
    const emailResponse = await resend.emails.send({
      from: "Affiliate Program <onboarding@resend.dev>",
      to: [userEmail],
      subject: `🏆 Milestone Unlocked: ${milestone_name}!`,
      html: `
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
              <p style="margin: 0 0 16px 0; color: #92400e; font-size: 14px;">${referral_count} Referrals</p>
              <div style="background: white; border-radius: 8px; padding: 16px; display: inline-block;">
                <p style="margin: 0; color: #065f46; font-size: 14px;">Bonus Earned</p>
                <p style="margin: 0; color: #059669; font-size: 32px; font-weight: bold;">$${bonus_amount.toFixed(2)}</p>
              </div>
            </div>
            
            <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
                    <strong>Current Balance:</strong>
                  </td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right; color: #059669; font-weight: bold;">
                    $${currentBalance.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0;">
                    <strong>Total Earnings:</strong>
                  </td>
                  <td style="padding: 10px 0; text-align: right; color: #059669; font-weight: bold;">
                    $${totalEarnings.toFixed(2)}
                  </td>
                </tr>
              </table>
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
    console.error("Error in send-milestone-notification function:", error);
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
