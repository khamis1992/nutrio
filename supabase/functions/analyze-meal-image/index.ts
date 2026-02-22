import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, availableTags, mode } = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "Image URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const MOONSHOT_API_KEY = Deno.env.get("MOONSHOT_API_KEY");
    if (!MOONSHOT_API_KEY) {
      console.error("MOONSHOT_API_KEY not configured");
      return createFallbackResponse(mode);
    }

    // Fetch image and convert to base64
    let imageBase64: string;
    let mimeType = "image/jpeg";
    try {
      const imgResponse = await fetch(imageUrl);
      if (!imgResponse.ok) throw new Error(`Failed to fetch image: ${imgResponse.status}`);
      const contentType = imgResponse.headers.get("content-type");
      if (contentType) mimeType = contentType.split(";")[0].trim();
      const arrayBuffer = await imgResponse.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      imageBase64 = btoa(binary);
    } catch (e) {
      console.error("Failed to fetch/convert image:", e);
      return createFallbackResponse(mode);
    }

    const systemPrompt = mode === "quick_scan"
      ? "You are a nutrition expert. Analyze the food image and identify visible food items with estimated nutrition values. Always respond with valid JSON only, no markdown."
      : "You are a nutrition expert. Analyze the meal image and provide detailed nutritional information. Always respond with valid JSON only, no markdown. Always respond in English.";

    const userPrompt = mode === "quick_scan"
      ? `Analyze this food image and list the visible food items with estimated nutrition values. Available diet tags: ${availableTags?.join(", ") || "none"}.

Respond with JSON in this exact format:
{"items": [{"name": "Food Name", "calories": 100, "protein_g": 10, "carbs_g": 15, "fat_g": 5}]}`
      : `Analyze this meal image and provide detailed information. Available diet tags to choose from: ${availableTags?.join(", ") || "vegetarian, vegan, keto, gluten-free, dairy-free, low-carb, high-protein"}.

Respond with JSON in this exact format:
{"name": "Meal Name", "description": "Brief description of the meal and visible ingredients", "calories": 450, "protein_g": 25, "carbs_g": 40, "fat_g": 18, "fiber_g": 8, "prep_time_minutes": 20, "suggested_price": 35, "diet_tags": ["high-protein", "gluten-free"]}`;

    console.log("Calling Moonshot AI (Kimi) with model kimi-k2.5...");

    const response = await fetch("https://api.moonshot.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MOONSHOT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "kimi-k2.5",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            ],
          },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Moonshot AI error:", response.status, errText);
      return createFallbackResponse(mode);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("No content from Moonshot AI response");
      return createFallbackResponse(mode);
    }

    console.log("Moonshot AI response received, parsing...");

    // Parse JSON from content (may be wrapped in ```json blocks)
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[1].trim()) : JSON.parse(content.trim());

      if (mode === "quick_scan") {
        return new Response(
          JSON.stringify({ success: true, detectedItems: parsed.items || [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        return new Response(
          JSON.stringify({ success: true, mealDetails: parsed }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to parse AI response",
          mealDetails: { name: "", description: "", calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, prep_time_minutes: 15, diet_tags: [] }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Error in analyze-meal-image:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function createFallbackResponse(mode: string | undefined) {
  if (mode === "quick_scan") {
    return new Response(
      JSON.stringify({ success: true, detectedItems: [], note: "AI analysis unavailable. Please enter meal details manually." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  return new Response(
    JSON.stringify({
      success: true,
      mealDetails: { name: "", description: "", calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, prep_time_minutes: 15, suggested_price: 0, diet_tags: [] },
      note: "AI analysis unavailable. Please fill in meal details manually.",
      provider: "fallback"
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
