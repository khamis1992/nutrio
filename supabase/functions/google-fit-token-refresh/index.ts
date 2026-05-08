import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const clientId = Deno.env.get("GOOGLE_FIT_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_FIT_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      console.error("Google Fit credentials not configured");
      return Response.json({ error: "Server configuration error" }, { status: 500, headers: corsHeaders });
    }

    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: tokenRow, error: tokenErr } = await adminClient
      .from("user_integrations")
      .select("refresh_token")
      .eq("user_id", user.id)
      .eq("provider", "google_fit")
      .maybeSingle();

    if (tokenErr || !tokenRow?.refresh_token) {
      return Response.json({ error: "No refresh token on file" }, { status: 404, headers: corsHeaders });
    }

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokenRow.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Google Fit token refresh failed:", errorText);
      return Response.json({ error: "Token refresh failed" }, { status: 401, headers: corsHeaders });
    }

    const newTokenData = await tokenResponse.json();
    const expiresAt = Math.floor((Date.now() + newTokenData.expires_in * 1000) / 1000);

    const { error: updateErr } = await adminClient
      .from("user_integrations")
      .update({
        access_token: newTokenData.access_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("provider", "google_fit");

    if (updateErr) {
      console.error("Failed to persist refreshed token:", updateErr);
      return Response.json({ error: "Database error" }, { status: 500, headers: corsHeaders });
    }

    return Response.json(
      { success: true, access_token: newTokenData.access_token, expires_at: expiresAt },
      { headers: corsHeaders }
    );
  } catch (err) {
    console.error("Token refresh error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
});
