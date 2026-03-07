// Supabase Edge Function: Translate Meal Content using Azure Translator
// This function translates meal names and descriptions from English to Arabic

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const AZURE_TRANSLATOR_KEY = Deno.env.get("AZURE_TRANSLATOR_KEY");
const AZURE_TRANSLATOR_REGION = Deno.env.get("AZURE_TRANSLATOR_REGION") || "global";
const AZURE_TRANSLATOR_ENDPOINT = Deno.env.get("AZURE_TRANSLATOR_ENDPOINT") || "https://api.cognitive.microsofttranslator.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface TranslationRequest {
  mealId: string;
  text: string[]; // Array of texts to translate [name, description]
  from?: string;  // Source language (default: 'en')
  to?: string;    // Target language (default: 'ar')
}

interface TranslationResponse {
  success: boolean;
  translations?: {
    text: string;
    to: string;
  }[];
  error?: string;
  charactersTranslated?: number;
}

/**
 * Translate text using Azure Translator API
 */
async function translateWithAzure(
  texts: string[],
  fromLang: string = "en",
  toLang: string = "ar"
): Promise<TranslationResponse> {
  if (!AZURE_TRANSLATOR_KEY) {
    return {
      success: false,
      error: "Azure Translator API key not configured",
    };
  }

  try {
    // Azure Translator API endpoint
    const url = `${AZURE_TRANSLATOR_ENDPOINT}/translate?api-version=3.0&from=${fromLang}&to=${toLang}`;

    // Prepare request body
    const body = texts.map(text => ({ text: text || "" }));

    // Call Azure Translator API
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": AZURE_TRANSLATOR_KEY,
        "Ocp-Apim-Subscription-Region": AZURE_TRANSLATOR_REGION,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Azure Translator API error:", {
        status: response.status,
        error: errorData,
      });
      return {
        success: false,
        error: `Translation API error: ${response.status}`,
      };
    }

    const data = await response.json();

    // Calculate characters translated (for monitoring)
    const charactersTranslated = texts.reduce((acc, text) => acc + (text?.length || 0), 0);

    // Extract translations
    const translations = data.map((item: any) => ({
      text: item.translations[0]?.text || "",
      to: item.translations[0]?.to || toLang,
    }));

    console.log("Translation successful:", {
      charactersTranslated,
      from: fromLang,
      to: toLang,
    });

    return {
      success: true,
      translations,
      charactersTranslated,
    };
  } catch (error) {
    console.error("Translation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Store translation in database
 */
async function storeTranslation(
  supabaseUrl: string,
  supabaseServiceKey: string,
  mealId: string,
  name: string,
  description: string | null,
  charactersTranslated: number
): Promise<boolean> {
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/meal_translations?meal_id=eq.${mealId}&language_code=eq.ar`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseServiceKey,
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({
          name,
          description,
          is_auto_translated: true,
          review_status: "pending",
          translation_api: "azure",
          updated_at: new Date().toISOString(),
        }),
      }
    );

    if (!response.ok) {
      console.error("Failed to store translation:", await response.text());
      return false;
    }

    console.log("Translation stored successfully:", { mealId, charactersTranslated });
    return true;
  } catch (error) {
    console.error("Error storing translation:", error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get Supabase credentials from environment
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Supabase credentials not configured");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const { mealId, text, from = "en", to = "ar" }: TranslationRequest = await req.json();

    // Validate request
    if (!mealId || !text || !Array.isArray(text) || text.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: mealId, text array" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Translation request:", { mealId, from, to, textCount: text.length });

    // Perform translation
    const translationResult = await translateWithAzure(text, from, to);

    if (!translationResult.success || !translationResult.translations) {
      return new Response(
        JSON.stringify({
          success: false,
          error: translationResult.error || "Translation failed",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Extract translated texts
    const translatedName = translationResult.translations[0]?.text || text[0] || "";
    const translatedDescription = translationResult.translations[1]?.text || text[1] || null;

    // Store in database
    const stored = await storeTranslation(
      supabaseUrl,
      supabaseServiceKey,
      mealId,
      translatedName,
      translatedDescription,
      translationResult.charactersTranslated || 0
    );

    if (!stored) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Translation succeeded but failed to store in database",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        mealId,
        translations: translationResult.translations,
        charactersTranslated: translationResult.charactersTranslated,
        reviewStatus: "pending",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Edge Function error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

/*
Environment Variables Required:
- AZURE_TRANSLATOR_KEY: Your Azure Translator API key
- AZURE_TRANSLATOR_REGION: Azure region (e.g., 'westeurope', 'eastus')
- AZURE_TRANSLATOR_ENDPOINT: API endpoint (optional, defaults to global)
- SUPABASE_URL: Supabase project URL
- SUPABASE_SERVICE_ROLE_KEY: Supabase service role key

Azure Setup:
1. Create Azure Translator resource in Azure Portal
2. Get API key and region from Keys and Endpoint page
3. Add to Supabase Edge Function secrets
4. Free tier: 2 million characters/month
*/
