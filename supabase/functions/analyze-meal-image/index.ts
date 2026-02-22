import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const ZHIPU_API_KEY = Deno.env.get("ZHIPU_API_KEY");
    if (!ZHIPU_API_KEY) {
      console.log("ZHIPU_API_KEY not configured, returning fallback");
      return createFallbackResponse(mode);
    }

    // Use API key directly
    const token = ZHIPU_API_KEY;

    // Try to call Zhipu AI with vision capabilities
    let response;
    try {
      const systemPrompt = mode === "quick_scan" 
        ? "You are a nutrition expert. Analyze the food image and identify visible food items with estimated nutrition values."
        : "You are a nutrition expert. Analyze the meal image and provide detailed nutritional information. Always respond in English.";
      
      const userPrompt = mode === "quick_scan" 
        ? `Analyze this food image and list the visible food items with estimated nutrition values in JSON format. Available diet tags: ${availableTags?.join(", ") || "none"}.

Respond with JSON in this exact format:
{
  "items": [
    {"name": "Food Name", "calories": 100, "protein_g": 10, "carbs_g": 15, "fat_g": 5}
  ]
}`
        : `Analyze this meal image and provide detailed information in JSON format. Available diet tags to choose from: ${availableTags?.join(", ") || "vegetarian, vegan, keto, gluten-free, dairy-free, low-carb, high-protein"}.

Respond with JSON in this exact format:
{
  "name": "Meal Name",
  "description": "Brief description of the meal and visible ingredients",
  "calories": 450,
  "protein_g": 25,
  "carbs_g": 40,
  "fat_g": 18,
  "fiber_g": 8,
  "prep_time_minutes": 20,
  "suggested_price": 35,
  "diet_tags": ["high-protein", "gluten-free"]
}`;

      // glm-4v-plus is the vision model
      const requestBody = {
        model: "glm-4v-plus",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: userPrompt,
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      };
      
      console.log("Request body:", JSON.stringify(requestBody));

      response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();
      console.log("Zhipu AI response status:", response.status);
      console.log("Zhipu AI response text:", responseText);
      
      if (!response.ok) {
        console.error("Zhipu AI API error:", response.status, responseText);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Zhipu AI API error: ${response.status}`,
            details: responseText,
            mealDetails: {
              name: "",
              description: "",
              calories: 0,
              protein_g: 0,
              carbs_g: 0,
              fat_g: 0,
              fiber_g: 0,
              prep_time_minutes: 15,
              diet_tags: []
            }
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error("Failed to parse Zhipu AI response as JSON:", responseText);
        return createFallbackResponse(mode);
      }
      
      console.log("Zhipu AI parsed response:", JSON.stringify(data));
      
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        console.log("No content from Zhipu AI. Response structure:", JSON.stringify(data));
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "No content from Zhipu AI",
            rawResponse: data,
            mealDetails: {
              name: "",
              description: "",
              calories: 0,
              protein_g: 0,
              carbs_g: 0,
              fat_g: 0,
              fiber_g: 0,
              prep_time_minutes: 15,
              diet_tags: []
            }
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.log("Zhipu AI content:", content);

      // Try to parse JSON from content
      try {
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[1]) : JSON.parse(content);
        
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
            error: "Failed to parse AI response as JSON",
            rawContent: content,
            mealDetails: {
              name: "",
              description: "",
              calories: 0,
              protein_g: 0,
              carbs_g: 0,
              fat_g: 0,
              fiber_g: 0,
              prep_time_minutes: 15,
              diet_tags: []
            }
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (error) {
      console.error("Error calling Zhipu AI:", error);
      return createFallbackResponse(mode);
    }
  } catch (error) {
    console.error("Error in analyze-meal-image:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function createFallbackResponse(mode: string | undefined) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (mode === "quick_scan") {
    return new Response(
      JSON.stringify({ 
        success: true, 
        detectedItems: [],
        note: "AI analysis unavailable. Please enter meal details manually."
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Full analysis fallback
  return new Response(
    JSON.stringify({ 
      success: true, 
      mealDetails: {
        name: "",
        description: "",
        calories: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        fiber_g: 0,
        prep_time_minutes: 15,
        suggested_price: 0,
        diet_tags: []
      },
      note: "AI analysis unavailable. Please fill in meal details manually.",
      provider: "fallback"
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
