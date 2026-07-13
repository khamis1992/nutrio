import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const ALLOWED_REDIRECT_URIS = [
  "http://localhost:5173/auth/google-fit/callback",
  "https://nutrio.app/auth/google-fit/callback",
];

interface TokenRequest {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  try {
    const body: TokenRequest = await req.json();
    const { code, codeVerifier, redirectUri } = body;

    if (!code || !codeVerifier || !redirectUri) {
      return Response.json({ error: "Missing required fields" }, { status: 400, headers: corsHeaders });
    }

    if (!ALLOWED_REDIRECT_URIS.includes(redirectUri)) {
      return Response.json({ error: "Invalid redirect URI" }, { status: 400, headers: corsHeaders });
    }

    const authorization = req.headers.get("Authorization");
    if (!authorization) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const clientId = Deno.env.get("GOOGLE_FIT_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_FIT_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      console.error("Google Fit credentials not configured");
      return Response.json({ error: "Server configuration error" }, { status: 500, headers: corsHeaders });
    }

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google token exchange failed:", errorText);
      return Response.json({ error: "Token exchange failed" }, { status: 401, headers: corsHeaders });
    }

    const data = await response.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: dbError } = await supabase
      .from("user_integrations")
      .upsert({
        user_id: user.id,
        provider: "google_fit",
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Math.floor((Date.now() + data.expires_in * 1000) / 1000),
        updated_at: new Date().toISOString(),
      });

    if (dbError) {
      console.error("Failed to store token:", dbError);
      return Response.json({ error: "Database error" }, { status: 500, headers: corsHeaders });
    }

    return Response.json({
      success: true,
      expires_in: data.expires_in,
    }, { headers: corsHeaders });
  } catch (err) {
    console.error("Token exchange error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
});
