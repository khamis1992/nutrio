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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Quick scan mode for user meal logging - returns multiple detected food items
    if (mode === "quick_scan") {
      console.log("Quick scan mode - detecting multiple food items");
      
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are a professional nutritionist analyzing meal photos. Your task is to identify EACH INDIVIDUAL food item visible in the image and estimate its nutritional content separately.

Guidelines:
- Identify each distinct food item (e.g., if there are eggs, toast, and bacon, list them as 3 separate items)
- Estimate portion sizes based on visual appearance
- Provide realistic calorie and macro estimates for each item
- Use common serving sizes as reference
- Be specific with food names (e.g., "Fried Egg" not just "Egg", "Whole Wheat Toast" not just "Bread")`,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Analyze this meal image and identify EACH INDIVIDUAL food item separately. For each item, provide its name and estimated nutritional values. List all visible food items as separate entries.",
                },
                {
                  type: "image_url",
                  image_url: { url: imageUrl },
                },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "detect_food_items",
                description: "Return an array of individual food items detected in the meal image",
                parameters: {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      description: "Array of individual food items detected in the image",
                      items: {
                        type: "object",
                        properties: {
                          name: {
                            type: "string",
                            description: "Specific name of the food item (e.g., 'Fried Egg', 'Crispy Bacon', 'Whole Wheat Toast')",
                          },
                          calories: {
                            type: "number",
                            description: "Estimated calories for this specific item",
                          },
                          protein_g: {
                            type: "number",
                            description: "Estimated protein in grams",
                          },
                          carbs_g: {
                            type: "number",
                            description: "Estimated carbohydrates in grams",
                          },
                          fat_g: {
                            type: "number",
                            description: "Estimated fat in grams",
                          },
                        },
                        required: ["name", "calories", "protein_g", "carbs_g", "fat_g"],
                      },
                    },
                  },
                  required: ["items"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "detect_food_items" } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "AI is busy. Please try again in a moment." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: "AI credits exhausted. Please fill in details manually." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const errorText = await response.text();
        console.error("AI gateway error:", response.status, errorText);
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const data = await response.json();
      console.log("AI response for quick scan:", JSON.stringify(data, null, 2));

      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        throw new Error("No structured output received from AI");
      }

      const result = JSON.parse(toolCall.function.arguments);
      
      return new Response(
        JSON.stringify({ success: true, detectedItems: result.items || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Full analysis mode for partner meal creation
    const tagsList = availableTags?.join(", ") || "Balanced, Dairy Free, Gluten Free, High Fiber, High Protein, Keto, Lean, Low Carb, Low Fat, Omega-3, Vegan, Vegetarian";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a professional nutritionist and food expert. Analyze meal images and provide accurate nutritional information and details.

When analyzing, consider:
- Visual appearance and ingredients visible in the image
- Portion size estimation based on standard serving sizes
- Cooking method visible (grilled, fried, steamed, etc.)
- Typical nutritional values for similar dishes

Available diet tags: ${tagsList}
Only select diet tags that clearly apply to the visible dish.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this meal image and provide complete details including name, description, nutritional information, prep time, suggested price, and applicable diet tags.",
              },
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_meal_details",
              description: "Provide structured meal details based on image analysis",
              parameters: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    description: "A catchy, descriptive name for the meal (e.g., 'Grilled Salmon with Herb Butter')",
                  },
                  description: {
                    type: "string",
                    description: "An appetizing description of the meal, 50-100 words, highlighting key ingredients and flavors",
                  },
                  calories: {
                    type: "number",
                    description: "Estimated total calories for the visible portion",
                  },
                  protein_g: {
                    type: "number",
                    description: "Estimated protein content in grams",
                  },
                  carbs_g: {
                    type: "number",
                    description: "Estimated carbohydrate content in grams",
                  },
                  fat_g: {
                    type: "number",
                    description: "Estimated fat content in grams",
                  },
                  fiber_g: {
                    type: "number",
                    description: "Estimated fiber content in grams",
                  },
                  prep_time_minutes: {
                    type: "number",
                    description: "Estimated preparation time in minutes",
                  },
                  suggested_price: {
                    type: "number",
                    description: "Suggested price in USD based on ingredients and preparation complexity",
                  },
                  diet_tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of applicable diet tags from the available list",
                  },
                },
                required: ["name", "description", "calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "prep_time_minutes", "suggested_price", "diet_tags"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_meal_details" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "AI is busy. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please fill in details manually." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response:", JSON.stringify(data, null, 2));

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("No structured output received from AI");
    }

    const mealDetails = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({ success: true, mealDetails }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in analyze-meal-image:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});