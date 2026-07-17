import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  authenticateRequest,
  enforceRateLimit,
  getServiceClient,
  handlePreflight,
  HttpError,
  jsonResponse,
  readJsonBody,
  recordSecurityEvent,
  requirePost,
  type SecurityPrincipal,
} from "../_shared/security.ts";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RATE_LIMIT = 100;
const RATE_WINDOW_SECONDS = 60 * 60;
const MAX_PROVIDER_RESPONSE_BYTES = 1024 * 1024;

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

async function logApiCall(
  userId: string,
  barcode: string,
  statusCode: number,
  source: string,
  errorMessage?: string,
): Promise<void> {
  try {
    const { error } = await getServiceClient().from("api_logs").insert({
      endpoint: "/functions/v1/lookup-barcode",
      method: "POST",
      status_code: statusCode,
      partner_id: userId,
      request_body: { barcode },
      error_message: errorMessage,
      metadata: { source },
    });
    if (error) console.error("Barcode API audit log failed:", error.message);
  } catch (error) {
    console.error("Barcode API audit log unavailable:", error);
  }
}

async function lookupFromCache(
  barcode: string,
): Promise<BarcodeCacheRow | null> {
  const { data, error } = await getServiceClient()
    .from("barcode_products")
    .select("*")
    .eq("barcode", barcode)
    .maybeSingle();
  if (error) {
    console.error("Barcode cache lookup failed:", error.message);
    throw new HttpError(503, "barcode_cache_unavailable");
  }
  return data as BarcodeCacheRow | null;
}

async function readProviderJson(
  response: Response,
): Promise<OpenFoodFactsProduct | null> {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_PROVIDER_RESPONSE_BYTES
  ) {
    return null;
  }
  if (!response.body) return null;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_PROVIDER_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as OpenFoodFactsProduct;
  } catch {
    return null;
  }
}

async function fetchFromOpenFoodFacts(
  barcode: string,
): Promise<{ data: OpenFoodFactsProduct | null; providerFailed: boolean }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
      {
        signal: controller.signal,
        redirect: "error",
        headers: { "User-Agent": "Nutrio/1.0 (nutrition tracking app)" },
      },
    );
    if (!response.ok) {
      return { data: null, providerFailed: response.status >= 500 };
    }
    const data = await readProviderJson(response);
    return { data, providerFailed: !data };
  } catch {
    console.error("Open Food Facts request failed");
    return { data: null, providerFailed: true };
  } finally {
    clearTimeout(timeout);
  }
}

function mapOpenFoodFactsToCache(
  product: NonNullable<OpenFoodFactsProduct["product"]>,
  barcode: string,
): Partial<BarcodeCacheRow> {
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

async function upsertCache(row: Partial<BarcodeCacheRow>): Promise<void> {
  const { error } = await getServiceClient()
    .from("barcode_products")
    .upsert({ ...row, last_fetched_at: new Date().toISOString() }, {
      onConflict: "barcode",
    });
  if (error) console.error("Barcode cache upsert failed:", error.message);
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

function barcodeErrorResponse(req: Request, error: unknown): Response {
  if (error instanceof HttpError) {
    if (error.status === 401) {
      return jsonResponse(req, { success: false, error: "Unauthorized" }, 401);
    }
    if (error.status === 429) {
      return jsonResponse(
        req,
        { success: false, error: "Rate limit exceeded", remaining: 0 },
        429,
      );
    }
    return jsonResponse(
      req,
      {
        success: false,
        error: error.status >= 500 ? "Internal server error" : error.code,
      },
      error.status,
    );
  }

  console.error("Unexpected lookup-barcode failure");
  return jsonResponse(
    req,
    { success: false, error: "Internal server error" },
    500,
  );
}

serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  let principal: SecurityPrincipal | null = null;
  let barcode: string | null = null;

  try {
    requirePost(req);
    principal = await authenticateRequest(req);

    const parsedBody = await readJsonBody<unknown>(req, 2 * 1024);
    if (
      !parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)
    ) {
      return jsonResponse(req, {
        success: false,
        error: "Invalid request body",
      }, 400);
    }
    const body = parsedBody as { barcode?: unknown };
    if (typeof body.barcode !== "string" || !/^\d{8,13}$/.test(body.barcode)) {
      return jsonResponse(req, {
        success: false,
        error: "Invalid barcode format",
      }, 400);
    }
    barcode = body.barcode;

    // Consume quota before either a cache or provider lookup. This atomically
    // counts successful hits, cache misses, and failed provider lookups alike.
    await enforceRateLimit(
      req,
      "lookup-barcode",
      principal.user.id,
      RATE_LIMIT,
      RATE_WINDOW_SECONDS,
    );

    const cached = await lookupFromCache(barcode);
    if (cached) {
      const age = Date.now() - new Date(cached.last_fetched_at).getTime();
      if (age < CACHE_TTL_MS) {
        await logApiCall(principal.user.id, barcode, 200, "cache");
        return jsonResponse(req, formatResponse(cached));
      }
    }

    const provider = await fetchFromOpenFoodFacts(barcode);
    const offData = provider.data;
    if (!offData || offData.status !== 1 || !offData.product) {
      await logApiCall(
        principal.user.id,
        barcode,
        404,
        "openfoodfacts",
        "Product not found",
      );
      if (provider.providerFailed) {
        await recordSecurityEvent(req, {
          eventType: "edge.barcode_provider_failed",
          category: "edge_function",
          severity: "low",
          outcome: "failure",
          principal,
          action: "lookup_barcode",
          resourceType: "api.provider",
          resourceId: "openfoodfacts",
        });
      }
      return jsonResponse(
        req,
        { success: false, error: "Product not found in database" },
        404,
      );
    }

    const cacheRow = mapOpenFoodFactsToCache(
      offData.product,
      barcode,
    ) as BarcodeCacheRow;
    await upsertCache(cacheRow);
    await logApiCall(principal.user.id, barcode, 200, "openfoodfacts");

    return jsonResponse(req, {
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
    });
  } catch (error) {
    if (
      principal && barcode &&
      !(error instanceof HttpError && error.status < 500)
    ) {
      await recordSecurityEvent(req, {
        eventType: "edge.barcode_lookup_failed",
        category: "edge_function",
        severity: "low",
        outcome: "failure",
        principal,
        action: "lookup_barcode",
        resourceType: "barcode",
        resourceId: barcode,
      });
    }
    return barcodeErrorResponse(req, error);
  }
});
