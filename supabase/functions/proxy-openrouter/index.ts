import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OpenRouterRequest {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!OPENROUTER_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OpenRouter API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { systemPrompt, userPrompt, model }: OpenRouterRequest = await req.json();

    if (!systemPrompt || !userPrompt) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: systemPrompt, userPrompt" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const models = model
      ? [model]
      : [
          "arcee-ai/trinity-large-preview:free",
          "google/gemini-2.5-flash-lite:free",
          "openai/gpt-oss-120b:free",
          "deepseek/deepseek-v3-0324:free",
          "x-ai/grok-4.1-fast:free",
        ];

    for (const m of models) {
      try {
        const response = await fetch(OPENROUTER_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "HTTP-Referer": "https://nutrio.app",
            "X-Title": "Nutrio",
          },
          body: JSON.stringify({
            model: m,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.6,
            max_tokens: 2000,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          return new Response(
            JSON.stringify({ content: data.choices?.[0]?.message?.content || "" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch {
        continue;
      }
    }

    return new Response(
      JSON.stringify({ error: "All models failed" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
