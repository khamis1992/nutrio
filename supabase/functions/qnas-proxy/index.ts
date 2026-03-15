import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const QNAS_BASE = "https://qnas.qa";

// Credentials per environment
const CREDENTIALS: Record<string, { token: string; domain: string }> = {
  production: { token: "80f4c006d03d4caa8663cb0ff9e9ef1d", domain: "nutrio.me" },
  development: { token: "d54c9de96ca44f9f86c4803603836b66", domain: "localhost" },
};

function getCredentials(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
    return CREDENTIALS.development;
  }
  return CREDENTIALS.production;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const { token, domain } = getCredentials(req);

    // Support both query param (GET) and body (POST via functions.invoke)
    let qnasPath = url.searchParams.get("path");

    if (!qnasPath && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      qnasPath = body.path ?? null;
    }

    if (!qnasPath) {
      return new Response(
        JSON.stringify({ error: "Missing 'path' query parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const qnasUrl = `${QNAS_BASE}${qnasPath}`;

    const qnasRes = await fetch(qnasUrl, {
      headers: {
        "X-Token": token,
        "X-Domain": domain,
        "Accept": "application/json",
      },
    });

    const data = await qnasRes.json();

    return new Response(JSON.stringify(data), {
      status: qnasRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Proxy error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
