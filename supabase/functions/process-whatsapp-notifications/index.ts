// Supabase Edge Function for processing WhatsApp notifications via Ultramsg API
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

// Environment variables
const ULTRAMSG_INSTANCE_ID = Deno.env.get("ULTRAMSG_INSTANCE_ID");
const ULTRAMSG_API_TOKEN = Deno.env.get("ULTRAMSG_API_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationQueueItem {
  id: string;
  phone: string;
  message: string;
  template: string;
}

// Create Supabase client with service role for database access
const createSupabaseClient = () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase credentials not configured");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
};

// Send WhatsApp message via Ultramsg API
const sendWhatsAppMessage = async (
  phone: string,
  message: string
): Promise<{ success: boolean; error?: string }> => {
  if (!ULTRAMSG_INSTANCE_ID || !ULTRAMSG_API_TOKEN) {
    return { success: false, error: "Ultramsg credentials not configured" };
  }

  // Format phone number (remove any non-numeric characters)
  const formattedPhone = phone.replace(/\D/g, "");

  // Validate phone number
  if (formattedPhone.length < 10) {
    return { success: false, error: "Invalid phone number" };
  }

  const apiUrl = `https://api.ultramsg.com/${ULTRAMSG_INSTANCE_ID}/messages/chat`;

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: ULTRAMSG_API_TOKEN,
        to: formattedPhone,
        body: message,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Ultramsg API error:", data);
      return {
        success: false,
        error: data.error || `API error: ${response.status}`,
      };
    }

    console.log("WhatsApp message sent successfully:", {
      phone: formattedPhone,
      messageId: data.id || data.messageId,
    });

    return { success: true };
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

// Process pending notifications
const processNotifications = async (): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> => {
  const supabase = createSupabaseClient();
  
  const stats = { processed: 0, succeeded: 0, failed: 0 };

  // Fetch pending notifications (limit to 50 per run)
  const { data: notifications, error: fetchError } = await supabase
    .from("notification_queue")
    .select("id, phone, message, template")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50);

  if (fetchError) {
    console.error("Error fetching notifications:", fetchError);
    return stats;
  }

  if (!notifications || notifications.length === 0) {
    return stats;
  }

  console.log(`Processing ${notifications.length} pending notifications...`);

  // Process each notification
  for (const notification of notifications as NotificationQueueItem[]) {
    stats.processed++;

    // Send WhatsApp message
    const result = await sendWhatsAppMessage(
      notification.phone,
      notification.message
    );

    // Update notification status
    if (result.success) {
      const { error: updateError } = await supabase
        .from("notification_queue")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", notification.id);

      if (updateError) {
        console.error("Error updating notification status:", updateError);
      } else {
        stats.succeeded++;
      }
    } else {
      const { error: updateError } = await supabase
        .from("notification_queue")
        .update({
          status: "failed",
          error_message: result.error,
          updated_at: new Date().toISOString(),
        })
        .eq("id", notification.id);

      if (updateError) {
        console.error("Error updating notification status:", updateError);
      } else {
        stats.failed++;
      }
    }
  }

  return stats;
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Check if credentials are configured
    if (!ULTRAMSG_INSTANCE_ID || !ULTRAMSG_API_TOKEN) {
      console.error("Ultramsg credentials not configured");
      return new Response(
        JSON.stringify({ 
          error: "WhatsApp service not configured",
          details: "ULTRAMSG_INSTANCE_ID and ULTRAMSG_API_TOKEN must be set"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Process notifications
    const stats = await processNotifications();

    return new Response(
      JSON.stringify({
        success: true,
        processed: stats.processed,
        succeeded: stats.succeeded,
        failed: stats.failed,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing notifications:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
