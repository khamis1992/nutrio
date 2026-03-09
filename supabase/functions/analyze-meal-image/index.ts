import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Validates JWT token from Authorization header
 * Returns user ID if valid, null if invalid
 */
async function validateAuthToken(req: Request): Promise<{ userId: string | null; error: string | null }> {
  const authHeader = req.headers.get("Authorization");
  
  if (!authHeader) {
    return { userId: null, error: "Missing Authorization header" };
  }

  // Extract token from "Bearer <token>" format
  const token = authHeader.replace("Bearer ", "").trim();
  
  if (!token) {
    return { userId: null, error: "Invalid Authorization header format" };
  }

  try {
    // Create Supabase client with anon key to verify JWT
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Verify the token by getting the user
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error("JWT validation failed:", error?.message || "No user found");
      return { userId: null, error: "Invalid or expired token" };
    }

    // Log successful auth for audit trail
    console.log(`Authenticated user: ${user.id}`);
    
    return { userId: user.id, error: null };
  } catch (err) {
    console.error("Auth validation error:", err);
    return { userId: null, error: "Authentication service error" };
  }
}

/**
 * Logs failed auth attempts for security monitoring
 */
async function logFailedAuth(ip: string | null, error: string, userAgent: string | null) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    await supabase.from("api_logs").insert({
      endpoint: "/functions/v1/analyze-meal-image",
      method: "POST",
      status_code: 401,
      error_message: `Auth failed: ${error}`,
      ip_address: ip,
      user_agent: userAgent,
      request_body: { error },
    });
  } catch (e) {
    console.error("Failed to log auth failure:", e);
  }
}

/**
 * Logs successful analysis for rate limiting and audit
 */
async function logSuccessfulAnalysis(userId: string, ip: string | null) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    await supabase.from("api_logs").insert({
      endpoint: "/functions/v1/analyze-meal-image",
      method: "POST",
      status_code: 200,
      partner_id: userId,
      ip_address: ip,
    });
  } catch (e) {
    console.error("Failed to log successful analysis:", e);
  }
}

/**
 * Checks rate limiting for AI analysis requests
 * Returns true if request should be allowed
 */
async function checkRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const RATE_LIMIT = 50; // 50 requests per hour
  const WINDOW_MS = 60 * 60 * 1000; // 1 hour window

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const windowStart = new Date(Date.now() - WINDOW_MS).toISOString();

    // Count requests in the current window
    const { count, error } = await supabase
      .from("api_logs")
      .select("*", { count: "exact", head: true })
      .eq("endpoint", "/functions/v1/analyze-meal-image")
      .eq("partner_id", userId)
      .eq("status_code", 200)
      .gte("created_at", windowStart);

    if (error) {
      console.error("Rate limit check error:", error);
      // Allow on error to prevent blocking legitimate users
      return { allowed: true, remaining: RATE_LIMIT, resetAt: new Date(Date.now() + WINDOW_MS) };
    }

    const requestCount = count || 0;
    const remaining = Math.max(0, RATE_LIMIT - requestCount);
    const allowed = requestCount < RATE_LIMIT;
    const resetAt = new Date(Date.now() + WINDOW_MS);

    return { allowed, remaining, resetAt };
  } catch (e) {
    console.error("Rate limit exception:", e);
    return { allowed: true, remaining: RATE_LIMIT, resetAt: new Date(Date.now() + WINDOW_MS) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Get client info for logging
  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null;
  const userAgent = req.headers.get("user-agent");

  // AUTHENTICATION CHECK
  const { userId, error: authError } = await validateAuthToken(req);
  
  if (!userId) {
    await logFailedAuth(clientIp, authError || "Unknown auth error", userAgent);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Unauthorized",
        message: authError || "Valid authentication required"
      }),
      { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }

  // RATE LIMITING CHECK
  const rateLimit = await checkRateLimit(userId);
  
  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Rate limit exceeded",
        message: `You have exceeded the limit of 50 analyses per hour. Please try again after ${rateLimit.resetAt.toISOString()}`,
        resetAt: rateLimit.resetAt.toISOString(),
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-RateLimit-Limit": "50",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": rateLimit.resetAt.toISOString(),
        },
      }
    );
  }

  try {
    const { imageUrl, availableTags, mode } = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "Image URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use OpenAI-compatible API key (supports gemini-2.5-flash with vision)
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY not configured");
      return createFallbackResponse(mode, "OPENAI_API_KEY not configured");
    }

    // Fetch image and convert to base64
    let imageBase64: string;
    let mimeType = "image/jpeg";
    try {
      if (imageUrl.startsWith("data:")) {
        // Already a base64 data URI (e.g. from Capacitor Camera.getPhoto)
        // Extract mimeType and base64 payload directly — fetch() cannot handle data: URIs
        const commaIndex = imageUrl.indexOf(",");
        const header = imageUrl.substring(0, commaIndex);
        const mimeMatch = header.match(/data:([^;]+)/);
        if (mimeMatch) mimeType = mimeMatch[1];
        imageBase64 = imageUrl.substring(commaIndex + 1);
        console.log(`Using data URI directly, mimeType=${mimeType}, base64 length=${imageBase64.length}`);
      } else {
        // Remote HTTP/HTTPS URL — fetch and convert to base64
        const imgResponse = await fetch(imageUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; NutrioBot/1.0)" }
        });
        if (!imgResponse.ok) throw new Error(`Failed to fetch image: ${imgResponse.status}`);
        const contentType = imgResponse.headers.get("content-type");
        if (contentType) mimeType = contentType.split(";")[0].trim();
        const arrayBuffer = await imgResponse.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        imageBase64 = btoa(binary);
        console.log(`Fetched remote image, mimeType=${mimeType}, base64 length=${imageBase64.length}`);
      }
    } catch (e) {
      console.error("Failed to fetch/convert image:", e);
      return createFallbackResponse(mode, `Image fetch failed: ${(e as Error).message}`);
    }

    const systemPrompt = mode === "quick_scan"
      ? "You are a nutrition expert. Analyze the food image and identify visible food items with estimated nutrition values. Always respond with valid JSON only, no markdown."
      : "You are a nutrition expert. Analyze the meal image and provide detailed nutritional information. Always respond with valid JSON only, no markdown. Always respond in English.";

    const userPrompt = mode === "quick_scan"
      ? "Analyze this food image and list the visible food items with estimated nutrition values. Available diet tags: " + (availableTags?.join(", ") || "none") + ". Respond with JSON in this exact format: {\"items\": [{\"name\": \"Food Name\", \"calories\": 100, \"protein_g\": 10, \"carbs_g\": 15, \"fat_g\": 5}]}"
      : "Analyze this meal image and provide detailed information. Available diet tags to choose from: " + (availableTags?.join(", ") || "vegetarian, vegan, keto, gluten-free, dairy-free, low-carb, high-protein") + ". Respond with JSON in this exact format: {\"name\": \"Meal Name\", \"description\": \"Brief description\", \"calories\": 450, \"protein_g\": 25, \"carbs_g\": 40, \"fat_g\": 18, \"fiber_g\": 8, \"prep_time_minutes\": 20, \"suggested_price\": 35, \"diet_tags\": [\"high-protein\", \"gluten-free\"]}";

    console.log(`Calling gemini-2.5-flash (vision) for user ${userId} via OpenAI-compatible API...`);

    const response = await fetch("https://api.manus.im/api/llm-proxy/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
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
      console.error("Vision AI error:", response.status, errText);
      return createFallbackResponse(mode, `Vision API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("No content from Vision AI response");
      return createFallbackResponse(mode);
    }

    console.log("Vision AI response received, parsing...");

    // Parse JSON from content (may be wrapped in ```json blocks)
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[1].trim()) : JSON.parse(content.trim());

      // Log successful analysis
      await logSuccessfulAnalysis(userId, clientIp);

      if (mode === "quick_scan") {
        return new Response(
          JSON.stringify({ 
            success: true, 
            detectedItems: parsed.items || [],
            rateLimit: {
              remaining: rateLimit.remaining - 1,
              resetAt: rateLimit.resetAt.toISOString(),
            }
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        return new Response(
          JSON.stringify({ 
            success: true, 
            mealDetails: parsed,
            rateLimit: {
              remaining: rateLimit.remaining - 1,
              resetAt: rateLimit.resetAt.toISOString(),
            }
          }),
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

function createFallbackResponse(mode: string | undefined, errorDetail?: string) {
  const note = errorDetail 
    ? `AI analysis unavailable: ${errorDetail}` 
    : "AI analysis unavailable. Please fill in meal details manually.";
    
  if (mode === "quick_scan") {
    return new Response(
      JSON.stringify({ success: true, detectedItems: [], note, provider: "fallback", error: errorDetail }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  return new Response(
    JSON.stringify({
      success: true,
      mealDetails: { name: "", description: "", calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, prep_time_minutes: 15, suggested_price: 0, diet_tags: [] },
      note,
      provider: "fallback",
      error: errorDetail
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
