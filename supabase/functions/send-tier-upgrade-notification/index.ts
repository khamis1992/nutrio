import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TierUpgradeRequest {
  user_id: string;
  old_tier: string;
  new_tier: string;
}

const tierConfig: Record<string, { color: string; gradient: string; icon: string; benefits: string[] }> = {
  bronze: {
    color: "#CD7F32",
    gradient: "linear-gradient(135deg, #CD7F32 0%, #8B4513 100%)",
    icon: "🥉",
    benefits: ["5% Tier 1 commission", "2% Tier 2 commission", "1% Tier 3 commission"],
  },
  silver: {
    color: "#C0C0C0",
    gradient: "linear-gradient(135deg, #C0C0C0 0%, #A8A8A8 100%)",
    icon: "🥈",
    benefits: ["7% Tier 1 commission", "3% Tier 2 commission", "1.5% Tier 3 commission", "Priority support"],
  },
  gold: {
    color: "#FFD700",
    gradient: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
    icon: "🥇",
    benefits: ["10% Tier 1 commission", "4% Tier 2 commission", "2% Tier 3 commission", "Priority support", "Exclusive promotions"],
  },
  platinum: {
    color: "#E5E4E2",
    gradient: "linear-gradient(135deg, #E5E4E2 0%, #BCC6CC 100%)",
    icon: "💎",
    benefits: ["12% Tier 1 commission", "5% Tier 2 commission", "2.5% Tier 3 commission", "Dedicated account manager", "Early access to features"],
  },
  diamond: {
    color: "#B9F2FF",
    gradient: "linear-gradient(135deg, #B9F2FF 0%, #00CED1 100%)",
    icon: "👑",
    benefits: ["15% Tier 1 commission", "6% Tier 2 commission", "3% Tier 3 commission", "VIP support", "Custom promotional materials", "Quarterly bonus"],
  },
};

const handler = async (req: Request): Promise<Response> => {
  console.log("Tier upgrade notification function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, old_tier, new_tier }: TierUpgradeRequest = await req.json();

    console.log(`Processing tier upgrade for user ${user_id}: ${old_tier} → ${new_tier}`);

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
    const newTierLower = new_tier.toLowerCase();
    const oldTierLower = old_tier.toLowerCase();
    const newTierConfig = tierConfig[newTierLower] || tierConfig.bronze;
    const oldTierConfig = tierConfig[oldTierLower] || tierConfig.bronze;

    // Send email notification
    const emailResponse = await resend.emails.send({
      from: "Affiliate Program <onboarding@resend.dev>",
      to: [userEmail],
      subject: `${newTierConfig.icon} Congratulations! You've been promoted to ${new_tier}!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: ${newTierConfig.gradient}; padding: 40px 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <div style="font-size: 64px; margin-bottom: 16px;">${newTierConfig.icon}</div>
            <h1 style="color: ${newTierLower === 'silver' || newTierLower === 'platinum' ? '#333' : 'white'}; margin: 0; font-size: 28px;">Tier Upgrade!</h1>
            <p style="color: ${newTierLower === 'silver' || newTierLower === 'platinum' ? '#555' : 'rgba(255,255,255,0.9)'}; margin: 10px 0 0 0; font-size: 16px;">
              ${old_tier} → <strong>${new_tier}</strong>
            </p>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 20px; margin-top: 0;">Congratulations, ${userName}! 🎉</p>
            
            <p>Your hard work and dedication have paid off! You've been promoted from <strong>${old_tier}</strong> to <strong>${new_tier}</strong> tier in our affiliate program.</p>
            
            <!-- New Tier Badge -->
            <div style="text-align: center; margin: 30px 0;">
              <div style="display: inline-block; background: ${newTierConfig.gradient}; padding: 20px 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                <p style="margin: 0; font-size: 48px;">${newTierConfig.icon}</p>
                <p style="margin: 8px 0 0 0; font-size: 24px; font-weight: bold; color: ${newTierLower === 'silver' || newTierLower === 'platinum' ? '#333' : 'white'}; text-transform: uppercase; letter-spacing: 2px;">
                  ${new_tier}
                </p>
              </div>
            </div>

            <!-- New Benefits -->
            <div style="background: white; border: 2px solid ${newTierConfig.color}; border-radius: 12px; padding: 24px; margin: 20px 0;">
              <h3 style="margin: 0 0 16px 0; color: #333; font-size: 18px;">✨ Your New ${new_tier} Benefits</h3>
              <ul style="margin: 0; padding-left: 20px; color: #4b5563;">
                ${newTierConfig.benefits.map(benefit => `<li style="margin-bottom: 8px;">${benefit}</li>`).join('')}
              </ul>
            </div>

            <!-- Encouragement -->
            <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
              <p style="margin: 0; color: #065f46; font-size: 16px;">
                <strong>Keep growing!</strong><br>
                Continue building your network to unlock even more rewards and reach the next tier.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="#" style="background: ${newTierConfig.gradient}; color: ${newTierLower === 'silver' || newTierLower === 'platinum' ? '#333' : 'white'}; padding: 14px 36px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">View Your Dashboard</a>
            </div>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
            <p>You're receiving this email because you achieved a tier upgrade in our affiliate program.</p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    // Also create an in-app notification
    await supabase.from("notifications").insert({
      user_id: user_id,
      type: "tier_upgrade",
      title: `${newTierConfig.icon} Tier Upgrade!`,
      message: `Congratulations! You've been promoted from ${old_tier} to ${new_tier} tier.`,
      metadata: { old_tier, new_tier },
    });

    return new Response(
      JSON.stringify({ success: true, emailResponse }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-tier-upgrade-notification function:", error);
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
