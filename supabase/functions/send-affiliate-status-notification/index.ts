import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  user_id: string;
  status: "approved" | "rejected";
  rejection_reason?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, status, rejection_reason }: NotificationRequest = await req.json();

    console.log(`Sending affiliate ${status} notification to user: ${user_id}`);

    // Create Supabase client to fetch user details
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user email from auth
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(user_id);
    
    if (userError || !userData?.user?.email) {
      console.error("Error fetching user:", userError);
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userEmail = userData.user.email;

    // Get user profile for name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, referral_code")
      .eq("id", user_id)
      .single();

    const userName = profile?.full_name || "there";
    const referralCode = profile?.referral_code || "";

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
            
            ${rejection_reason ? `
              <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #991b1b;"><strong>Reason:</strong> ${rejection_reason}</p>
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

    const emailResponse = await resend.emails.send({
      from: "Affiliate Program <onboarding@resend.dev>",
      to: [userEmail],
      subject: subject,
      html: htmlContent,
    });

    console.log(`Email sent successfully to ${userEmail}:`, emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-affiliate-status-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
