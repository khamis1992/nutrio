import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") ?? "sk-f45b97e058804f438efc2cb4725a2a66";
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserContext {
  weeklyMacros: { avgCalories: number; avgProtein: number; avgCarbs: number; avgFat: number };
  goals: { calorieTarget: number; proteinTarget: number; goalType: string };
  mealQuality: { avgScore: number; trend: number | null };
  streak: { current: number; best: number };
  daysLogged: number;
  waterAvg: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const ctx: UserContext = body.context;

    if (!ctx) {
      return new Response(JSON.stringify({ error: "Missing context" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = [
      `Nutrition data for the past 7 days:`,
      `- Days logged: ${ctx.daysLogged}/7`,
      `- Average daily: ${Math.round(ctx.weeklyMacros.avgCalories)} cal, ${Math.round(ctx.weeklyMacros.avgProtein)}g protein, ${Math.round(ctx.weeklyMacros.avgCarbs)}g carbs, ${Math.round(ctx.weeklyMacros.avgFat)}g fat`,
      `- Goals: ${ctx.goals.calorieTarget} cal, ${ctx.goals.proteinTarget}g protein, goal type: ${ctx.goals.goalType}`,
      `- Meal quality score: ${ctx.mealQuality.avgScore}/100${ctx.mealQuality.trend !== null ? ` (${ctx.mealQuality.trend >= 0 ? '+' : ''}${ctx.mealQuality.trend}% vs last week)` : ''}`,
      `- Logging streak: ${ctx.streak.current} days (best: ${ctx.streak.best})`,
      `- Water intake: ${ctx.waterAvg} glasses/day average`,
      ``,
      `Write ONE short, motivational insight sentence (max 80 characters) about this person's nutrition. Be encouraging and specific. Mention the strongest positive and one gentle improvement tip. Format: plain text only, no markdown.`,
    ].join("\n");

    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content:
              "You are a supportive nutrition coach. Give brief, encouraging, specific insights in under 80 characters. Never use markdown or emoji. Be warm but professional.",
          },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 80,
        temperature: 0.7,
      }),
    });

    const result = await response.json();
    const insight = result.choices?.[0]?.message?.content?.trim() ?? "Keep tracking your meals to unlock personalized insights.";

    return new Response(JSON.stringify({ insight }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("AI insight error:", err);
    return new Response(
      JSON.stringify({ insight: "Keep tracking your meals to unlock personalized insights." }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
