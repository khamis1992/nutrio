import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PayoutNotificationRequest {
  user_id: string;
  amount: number;
  status: string;
  payout_method: string;
  notes: string | null;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Payout notification function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, amount, status, payout_method, notes }: PayoutNotificationRequest = await req.json();

    console.log(`Processing payout notification for user ${user_id}: $${amount} - ${status}`);

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

    // Get user profile for name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, affiliate_balance")
      .eq("user_id", user_id)
      .single();

    const userName = profile?.full_name || "Affiliate Partner";
    const currentBalance = profile?.affiliate_balance || 0;

    const isApproved = status === "approved";
    const statusColor = isApproved ? "#059669" : "#dc2626";
    const statusIcon = isApproved ? "✅" : "❌";
    const statusText = isApproved ? "Approved" : "Rejected";

    const payoutMethodDisplay = payout_method?.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) || "Bank Transfer";

    // Send email notification
    const emailResponse = await resend.emails.send({
      from: "Affiliate Program <onboarding@resend.dev>",
      to: [userEmail],
      subject: `${statusIcon} Your payout request has been ${statusText.toLowerCase()}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: ${isApproved ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)'}; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">${statusIcon} Payout ${statusText}</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 18px; margin-top: 0;">Hi ${userName},</p>
            
            <p>Your payout request has been <strong style="color: ${statusColor};">${statusText.toLowerCase()}</strong>.</p>
            
            <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
                    <strong>Amount:</strong>
                  </td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">
                    <strong style="font-size: 20px; color: ${statusColor};">$${amount.toFixed(2)}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
                    <strong>Payment Method:</strong>
                  </td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">
                    ${payoutMethodDisplay}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0;">
                    <strong>Status:</strong>
                  </td>
                  <td style="padding: 10px 0; text-align: right;">
                    <span style="background: ${isApproved ? '#dcfce7' : '#fee2e2'}; color: ${statusColor}; padding: 4px 12px; border-radius: 20px; font-weight: bold;">
                      ${statusText}
                    </span>
                  </td>
                </tr>
              </table>
            </div>
            
            ${isApproved ? `
              <div style="background: #ecfdf5; border-radius: 8px; padding: 15px; margin: 20px 0; border-left: 4px solid #059669;">
                <p style="margin: 0; color: #065f46;">
                  <strong>🎉 Great news!</strong><br>
                  Your payout will be processed within 3-5 business days. You'll receive the funds via your selected payment method.
                </p>
              </div>
            ` : `
              <div style="background: #fef2f2; border-radius: 8px; padding: 15px; margin: 20px 0; border-left: 4px solid #dc2626;">
                <p style="margin: 0; color: #991b1b;">
                  <strong>Reason:</strong><br>
                  ${notes || "Please contact support for more information about why your payout was rejected."}
                </p>
              </div>
            `}
            
            <div style="background: #f3f4f6; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #4b5563;">
                <strong>Current Balance:</strong> $${currentBalance.toFixed(2)}
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="#" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Your Account</a>
            </div>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
            <p>You're receiving this email because you requested a payout from our affiliate program.</p>
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
    console.error("Error in send-payout-notification function:", error);
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
