import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RATE_LIMIT = 100;
const RATE_WINDOW_MS = 60 * 60 * 1000;

interface BarcodeCacheRow {
  barcode: string;
  name: string;
  brand: string | null;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fiber_per_100g: number;
  image_url: string | null;
  raw_response: Record<string, unknown> | null;
  last_fetched_at: string;
}

interface OpenFoodFactsProduct {
  status: number;
  product?: {
    product_name?: string;
    product_name_en?: string;
    brands?: string;
    nutriments?: {
      "energy-kcal_100g"?: number;
      proteins_100g?: number;
      carbohydrates_100g?: number;
      fat_100g?: number;
      fiber_100g?: number;
    };
    image_url?: string;
    image_front_url?: string;
  };
  status_verbose?: string;
}

async function validateAuth(req: Request): Promise<{ userId: string | null; error: string | null }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { userId: null, error: "Missing Authorization header" };

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return { userId: null, error: "Invalid Authorization header format" };

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return { userId: null, error: "Invalid or expired token" };
    return { userId: user.id, error: null };
  } catch {
    return { userId: null, error: "Authentication service error" };
  }
}

async function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function checkRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const supabase = await getServiceClient();
    const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
    const { count, error } = await supabase
      .from("api_logs")
      .select("*", { count: "exact", head: true })
      .eq("endpoint", "/functions/v1/lookup-barcode")
      .eq("partner_id", userId)
      .eq("status_code", 200)
      .gte("created_at", windowStart);
    if (error) return { allowed: true, remaining: RATE_LIMIT };
    return { allowed: (count || 0) < RATE_LIMIT, remaining: Math.max(0, RATE_LIMIT - (count || 0)) };
  } catch {
    return { allowed: true, remaining: RATE_LIMIT };
  }
}

async function logApiCall(userId: string, barcode: string, statusCode: number, source: string, errorMessage?: string) {
  try {
    const supabase = await getServiceClient();
    await supabase.from("api_logs").insert({
      endpoint: "/functions/v1/lookup-barcode",
      method: "POST",
      status_code: statusCode,
      partner_id: userId,
      request_body: { barcode },
      error_message: errorMessage,
      metadata: { source },
    });
  } catch (e) {
    console.error("Failed to log API call:", e);
  }
}

async function lookupFromCache(supabase: ReturnType<typeof createClient>, barcode: string): Promise<BarcodeCacheRow | null> {
  const { data } = await supabase
    .from("barcode_products")
    .select("*")
    .eq("barcode", barcode)
    .single();
  return data;
}

async function fetchFromOpenFoodFacts(barcode: string): Promise<OpenFoodFactsProduct | null> {
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
      { headers: { "User-Agent": "Nutrio/1.0 (nutrition tracking app)" } },
    );
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    console.error("Open Food Facts fetch error:", e);
    return null;
  }
}

function mapOpenFoodFactsToCache(product: NonNullable<OpenFoodFactsProduct["product"]>, barcode: string): Partial<BarcodeCacheRow> {
  const nutriments = product.nutriments || {};
  return {
    barcode,
    name: product.product_name_en || product.product_name || "Unknown Product",
    brand: product.brands || null,
    calories_per_100g: Math.round(nutriments["energy-kcal_100g"] || 0),
    protein_per_100g: Math.round(nutriments.proteins_100g || 0),
    carbs_per_100g: Math.round(nutriments.carbohydrates_100g || 0),
    fat_per_100g: Math.round(nutriments.fat_100g || 0),
    fiber_per_100g: Math.round(nutriments.fiber_100g || 0),
    image_url: product.image_front_url || product.image_url || null,
    raw_response: product as unknown as Record<string, unknown>,
  };
}

async function upsertCache(supabase: ReturnType<typeof createClient>, row: Partial<BarcodeCacheRow>) {
  const { error } = await supabase
    .from("barcode_products")
    .upsert({ ...row, last_fetched_at: new Date().toISOString() }, { onConflict: "barcode" });
  if (error) console.error("Cache upsert error:", error);
}

function formatResponse(data: BarcodeCacheRow) {
  return {
    success: true,
    product: {
      name: data.name,
      barcode: data.barcode,
      brand: data.brand,
      calories: data.calories_per_100g,
      protein: data.protein_per_100g,
      carbs: data.carbs_per_100g,
      fat: data.fat_per_100g,
      fiber: data.fiber_per_100g,
      imageUrl: data.image_url,
    },
    cached: true,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const { userId, error: authError } = await validateAuth(req);
  if (!userId) {
    return new Response(
      JSON.stringify({ success: false, error: authError || "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const rateLimit = await checkRateLimit(userId);
  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({ success: false, error: "Rate limit exceeded", remaining: 0 }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const { barcode } = await req.json() as { barcode: string };
    if (!barcode || !/^\d{8,13}$/.test(barcode)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid barcode format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = await getServiceClient();

    const cached = await lookupFromCache(supabase, barcode);
    if (cached) {
      const age = Date.now() - new Date(cached.last_fetched_at).getTime();
      if (age < CACHE_TTL_MS) {
        await logApiCall(userId, barcode, 200, "cache");
        return new Response(
          JSON.stringify(formatResponse(cached)),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const offData = await fetchFromOpenFoodFacts(barcode);
    if (!offData || offData.status !== 1 || !offData.product) {
      await logApiCall(userId, barcode, 404, "openfoodfacts", "Product not found");
      return new Response(
        JSON.stringify({ success: false, error: "Product not found in database" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cacheRow = mapOpenFoodFactsToCache(offData.product, barcode) as BarcodeCacheRow;
    await upsertCache(supabase, cacheRow);
    await logApiCall(userId, barcode, 200, "openfoodfacts");

    return new Response(
      JSON.stringify({
        success: true,
        product: {
          name: cacheRow.name,
          barcode: cacheRow.barcode,
          brand: cacheRow.brand,
          calories: cacheRow.calories_per_100g,
          protein: cacheRow.protein_per_100g,
          carbs: cacheRow.carbs_per_100g,
          fat: cacheRow.fat_per_100g,
          fiber: cacheRow.fiber_per_100g,
          imageUrl: cacheRow.image_url,
        },
        cached: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("lookup-barcode error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
