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
  userId: string;
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body: TokenRequest = await req.json();
    const { code, codeVerifier, redirectUri, userId } = body;

    if (!code || !codeVerifier || !redirectUri || !userId) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!ALLOWED_REDIRECT_URIS.includes(redirectUri)) {
      return Response.json({ error: "Invalid redirect URI" }, { status: 400 });
    }

    const clientId = Deno.env.get("GOOGLE_FIT_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_FIT_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      console.error("Google Fit credentials not configured");
      return Response.json({ error: "Server configuration error" }, { status: 500 });
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
      return Response.json({ error: "Token exchange failed" }, { status: 401 });
    }

    const data = await response.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: dbError } = await supabase
      .from("user_integrations")
      .upsert({
        user_id: userId,
        provider: "google_fit",
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Math.floor((Date.now() + data.expires_in * 1000) / 1000),
        updated_at: new Date().toISOString(),
      });

    if (dbError) {
      console.error("Failed to store token:", dbError);
      return Response.json({ error: "Database error" }, { status: 500 });
    }

    return Response.json({
      success: true,
      expires_in: data.expires_in,
    });
  } catch (err) {
    console.error("Token exchange error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});