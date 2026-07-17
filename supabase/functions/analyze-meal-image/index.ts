import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  authenticateRequest,
  enforceRateLimit,
  getClientIp,
  getCorsHeaders,
  getServiceClient,
  HttpError,
  jsonResponse,
  recordSecurityEvent,
  requirePost,
  type SecurityPrincipal,
} from "../_shared/security.ts";

const RATE_LIMIT = 50;
const IP_RATE_LIMIT = 100;
const RATE_WINDOW_SECONDS = 60 * 60;
const DAILY_AI_LIMIT = 20;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_REQUEST_BYTES = 8 * 1024 * 1024;
const MAX_PROVIDER_RESPONSE_BYTES = 256 * 1024;
const IMAGE_FETCH_TIMEOUT_MS = 12_000;
const PROVIDER_TIMEOUT_MS = 45_000;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_DIET_TAGS = new Set([
  "dairy-free",
  "gluten-free",
  "halal",
  "high-fiber",
  "high-protein",
  "keto",
  "low-carb",
  "low-fat",
  "low-sodium",
  "nut-free",
  "paleo",
  "pescatarian",
  "sugar-free",
  "vegan",
  "vegetarian",
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface AnalyzeMealRequest {
  imageUrl?: unknown;
  availableTags?: unknown;
  mode?: unknown;
  requestId?: unknown;
}

interface PreparedImage {
  base64: string;
  mimeType: string;
}

function analyzeCorsHeaders(req: Request): Record<string, string> {
  return {
    ...getCorsHeaders(req),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-request-id, x-correlation-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

function analyzeJsonResponse(
  req: Request,
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return jsonResponse(req, body, status, {
    ...analyzeCorsHeaders(req),
    ...extraHeaders,
  });
}

async function readBoundedStream(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  status: number,
  errorCode: string,
): Promise<Uint8Array> {
  if (!stream) return new Uint8Array();

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new HttpError(status, errorCode);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

async function readAnalyzeRequest(req: Request): Promise<AnalyzeMealRequest> {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new HttpError(415, "json_required");
  }

  const declaredLength = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    throw new HttpError(413, "request_too_large");
  }

  const bytes = await readBoundedStream(
    req.body,
    MAX_REQUEST_BYTES,
    413,
    "request_too_large",
  );

  try {
    const raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new HttpError(400, "invalid_json");
    }
    return parsed as AnalyzeMealRequest;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "invalid_json");
  }
}

function getAllowedImageOrigins(): Set<string> {
  const origins = new Set<string>();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");

  if (supabaseUrl) {
    try {
      origins.add(new URL(supabaseUrl).origin);
    } catch {
      // Configuration errors are surfaced when the service client is created.
    }
  }

  for (
    const configured of (Deno.env.get("MEAL_IMAGE_ALLOWED_ORIGINS") || "")
      .split(",")
  ) {
    const value = configured.trim();
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol === "https:") origins.add(url.origin);
    } catch {
      console.error("Ignoring invalid MEAL_IMAGE_ALLOWED_ORIGINS entry");
    }
  }

  return origins;
}

function validateRemoteImageUrl(value: string): URL {
  if (value.length > 4096) throw new HttpError(400, "invalid_image_url");

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new HttpError(400, "invalid_image_url");
  }

  if (
    url.username ||
    url.password ||
    url.hash ||
    !getAllowedImageOrigins().has(url.origin) ||
    !url.pathname.startsWith("/storage/v1/object/")
  ) {
    throw new HttpError(400, "image_url_not_allowed");
  }

  return url;
}

function parseDataImage(value: string): PreparedImage {
  const commaIndex = value.indexOf(",");
  if (commaIndex < 0) throw new HttpError(400, "invalid_image_data");

  const header = value.slice(0, commaIndex).toLowerCase();
  const match = /^data:(image\/(?:jpeg|png|webp));base64$/.exec(header);
  if (!match || !ALLOWED_IMAGE_TYPES.has(match[1])) {
    throw new HttpError(400, "unsupported_image_type");
  }

  const base64 = value.slice(commaIndex + 1);
  const maxEncodedLength = Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 4;
  if (!base64 || base64.length > maxEncodedLength) {
    throw new HttpError(413, "image_too_large");
  }

  try {
    if (atob(base64).length > MAX_IMAGE_BYTES) {
      throw new HttpError(413, "image_too_large");
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "invalid_image_data");
  }

  return { base64, mimeType: match[1] };
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  const chunkSize = 32 * 1024;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(
      String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)),
    );
  }
  return btoa(chunks.join(""));
}

async function fetchRemoteImage(url: URL): Promise<PreparedImage> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
      headers: { "User-Agent": "NutrioImageAnalyzer/1.0" },
    });

    if (response.status >= 300 && response.status < 400) {
      throw new HttpError(400, "image_redirect_not_allowed");
    }
    if (!response.ok) throw new Error("remote_image_unavailable");

    const mimeType = (response.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
      throw new HttpError(400, "unsupported_image_type");
    }

    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
      throw new HttpError(413, "image_too_large");
    }

    const bytes = await readBoundedStream(
      response.body,
      MAX_IMAGE_BYTES,
      413,
      "image_too_large",
    );
    if (!bytes.byteLength) throw new Error("remote_image_empty");

    return { base64: bytesToBase64(bytes), mimeType };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeTags(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 20) {
    throw new HttpError(400, "invalid_available_tags");
  }

  return [...new Set(value.map((tag) => {
    if (typeof tag !== "string") {
      throw new HttpError(400, "invalid_available_tags");
    }
    const normalized = tag.trim().toLowerCase();
    if (!ALLOWED_DIET_TAGS.has(normalized)) {
      throw new HttpError(400, "invalid_available_tags");
    }
    return normalized;
  }))];
}

function boundedNumber(
  value: unknown,
  minimum: number,
  maximum: number,
): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new HttpError(502, "provider_output_invalid");
  }
  return Math.round(number * 100) / 100;
}

function boundedText(value: unknown, maximumLength: number): string {
  if (typeof value !== "string") {
    throw new HttpError(502, "provider_output_invalid");
  }
  const normalized = value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > maximumLength) {
    throw new HttpError(502, "provider_output_invalid");
  }
  return normalized;
}

function normalizeQuickScanOutput(value: unknown): Array<Record<string, number | string>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(502, "provider_output_invalid");
  }
  const items = (value as Record<string, unknown>).items;
  if (!Array.isArray(items) || items.length > 20) {
    throw new HttpError(502, "provider_output_invalid");
  }
  return items.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new HttpError(502, "provider_output_invalid");
    }
    const record = item as Record<string, unknown>;
    return {
      name: boundedText(record.name, 120),
      calories: boundedNumber(record.calories, 0, 5000),
      protein_g: boundedNumber(record.protein_g, 0, 1000),
      carbs_g: boundedNumber(record.carbs_g, 0, 2000),
      fat_g: boundedNumber(record.fat_g, 0, 1000),
    };
  });
}

function normalizeMealOutput(
  value: unknown,
  availableTags: string[],
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(502, "provider_output_invalid");
  }
  const record = value as Record<string, unknown>;
  const allowedForRequest = new Set(
    availableTags.length ? availableTags : ALLOWED_DIET_TAGS,
  );
  const dietTags = Array.isArray(record.diet_tags)
    ? [...new Set(record.diet_tags
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => allowedForRequest.has(tag)))]
      .slice(0, 10)
    : [];

  return {
    name: boundedText(record.name, 160),
    description: boundedText(record.description, 1000),
    calories: boundedNumber(record.calories, 0, 10000),
    protein_g: boundedNumber(record.protein_g, 0, 1000),
    carbs_g: boundedNumber(record.carbs_g, 0, 2000),
    fat_g: boundedNumber(record.fat_g, 0, 1000),
    fiber_g: boundedNumber(record.fiber_g ?? 0, 0, 500),
    prep_time_minutes: boundedNumber(record.prep_time_minutes, 0, 1440),
    suggested_price: boundedNumber(record.suggested_price ?? 0, 0, 100000),
    diet_tags: dietTags,
  };
}

async function callVisionProvider(
  apiKey: string,
  image: PreparedImage,
  userPrompt: string,
  systemPrompt: string,
): Promise<{ status: number; content: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const response = await fetch(
      "https://api.manus.im/api/llm-proxy/v1/chat/completions",
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Authorization": `Bearer ${apiKey}`,
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
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${image.mimeType};base64,${image.base64}`,
                  },
                },
              ],
            },
          ],
          temperature: 0.7,
          max_tokens: 1024,
        }),
      },
    );

    const responseBytes = await readBoundedStream(
      response.body,
      MAX_PROVIDER_RESPONSE_BYTES,
      502,
      "provider_response_too_large",
    );
    const responseText = new TextDecoder().decode(responseBytes);
    if (!response.ok) return { status: response.status, content: null };

    try {
      const data = JSON.parse(responseText) as {
        choices?: Array<{ message?: { content?: unknown } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      return {
        status: response.status,
        content: typeof content === "string" ? content : null,
      };
    } catch {
      return { status: response.status, content: null };
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function logSuccessfulAnalysis(): Promise<void> {
  try {
    const { error } = await getServiceClient().from("api_logs").insert({
      endpoint: "/functions/v1/analyze-meal-image",
      method: "POST",
      status_code: 200,
    });
    if (error) console.error("Analysis audit log failed", { code: error.code });
  } catch {
    console.error("Analysis audit log unavailable");
  }
}

function createFallbackResponse(
  req: Request,
  mode: string | undefined,
  errorCode = "ai_service_unavailable",
): Response {
  const note = "AI analysis unavailable. Please fill in meal details manually.";

  if (mode === "quick_scan") {
    return analyzeJsonResponse(req, {
      success: true,
      detectedItems: [],
      note,
      provider: "fallback",
      error: errorCode,
    });
  }

  return analyzeJsonResponse(req, {
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
      diet_tags: [],
    },
    note,
    provider: "fallback",
    error: errorCode,
  });
}

function rateLimitResponse(req: Request, resetAt: Date): Response {
  return analyzeJsonResponse(
    req,
    {
      success: false,
      error: "Rate limit exceeded",
      message:
        `You have exceeded the limit of 50 analyses per hour. Please try again after ${resetAt.toISOString()}`,
      resetAt: resetAt.toISOString(),
    },
    429,
    {
      "X-RateLimit-Limit": String(RATE_LIMIT),
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": resetAt.toISOString(),
    },
  );
}

async function recordProviderFailure(
  req: Request,
  principal: SecurityPrincipal,
  reason: string,
  providerStatus?: number,
): Promise<void> {
  await recordSecurityEvent(req, {
    eventType: "edge.meal_image_analysis_failed",
    category: "edge_function",
    severity: providerStatus === 429 ? "medium" : "low",
    outcome: "failure",
    principal,
    action: "analyze_meal_image",
    resourceType: "ai.provider",
    resourceId: "gemini-2.5-flash",
    metadata: {
      reason,
      ...(providerStatus ? { provider_status: providerStatus } : {}),
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: analyzeCorsHeaders(req),
    });
  }

  let principal: SecurityPrincipal;
  try {
    requirePost(req);
    principal = await authenticateRequest(req);
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) {
      await recordSecurityEvent(req, {
        eventType: "authentication.meal_image_analysis_denied",
        category: "authentication",
        severity: "medium",
        outcome: "denied",
        action: "analyze_meal_image",
      });
      return analyzeJsonResponse(req, {
        success: false,
        error: "Unauthorized",
        message: "Valid authentication required",
      }, 401);
    }
    if (error instanceof HttpError) {
      return analyzeJsonResponse(
        req,
        { success: false, error: error.code },
        error.status,
      );
    }
    console.error("Meal image authentication failed");
    return analyzeJsonResponse(req, {
      success: false,
      error: "Internal server error",
    }, 500);
  }

  let rateLimit: { remaining: number; resetAt: number };
  try {
    const clientIp = getClientIp(req) || "unknown";
    [rateLimit] = await Promise.all([
      enforceRateLimit(
        req,
        "analyze-meal-image:user",
        principal.user.id,
        RATE_LIMIT,
        RATE_WINDOW_SECONDS,
      ),
      enforceRateLimit(
        req,
        "analyze-meal-image:ip",
        clientIp,
        IP_RATE_LIMIT,
        RATE_WINDOW_SECONDS,
      ),
    ]);
  } catch (error) {
    if (error instanceof HttpError && error.status === 429) {
      return rateLimitResponse(
        req,
        new Date(Date.now() + RATE_WINDOW_SECONDS * 1000),
      );
    }
    return analyzeJsonResponse(req, { error: "Rate limit unavailable" }, 503);
  }

  const service = getServiceClient();
  let budgetRequestId: string | null = null;
  let budgetReserved = false;
  const completeBudget = async (
    status: "completed" | "failed",
    outputChars = 0,
  ): Promise<void> => {
    if (!budgetReserved || !budgetRequestId) return;
    budgetReserved = false;
    const { error } = await service.rpc("complete_ai_request", {
      p_user_id: principal.user.id,
      p_request_id: budgetRequestId,
      p_status: status,
      p_output_chars: outputChars,
    });
    if (error) console.error("Meal image AI usage completion failed", { code: error.code });
  };

  try {
    const body = await readAnalyzeRequest(req);
    if (typeof body.imageUrl !== "string" || !body.imageUrl) {
      return analyzeJsonResponse(req, { error: "Image URL is required" }, 400);
    }

    const mode = body.mode === "quick_scan" ? "quick_scan" : undefined;
    const availableTags = normalizeTags(body.availableTags);
    if (body.requestId !== undefined && !UUID_PATTERN.test(String(body.requestId))) {
      throw new HttpError(400, "invalid_request_identifier");
    }
    budgetRequestId = body.requestId === undefined
      ? crypto.randomUUID()
      : String(body.requestId);

    const inputChars = Math.min(
      100_000,
      body.imageUrl.length + availableTags.join(",").length + (mode?.length ?? 0),
    );
    const { data: budget, error: budgetError } = await service.rpc(
      "reserve_ai_request",
      {
        p_user_id: principal.user.id,
        p_task: "meal_image",
        p_request_id: budgetRequestId,
        p_daily_limit: DAILY_AI_LIMIT,
        p_input_chars: inputChars,
      },
    );
    if (budgetError) throw new HttpError(503, "ai_budget_check_failed");
    if (budget?.duplicate) throw new HttpError(409, "duplicate_ai_request");
    if (!budget?.allowed) throw new HttpError(429, "daily_ai_request_limit_reached");
    budgetReserved = true;

    let image: PreparedImage;
    if (body.imageUrl.startsWith("data:")) {
      image = parseDataImage(body.imageUrl);
    } else {
      let remoteUrl: URL;
      try {
        remoteUrl = validateRemoteImageUrl(body.imageUrl);
      } catch (error) {
        if (
          error instanceof HttpError && error.code === "image_url_not_allowed"
        ) {
          let hostname = "invalid";
          try {
            hostname = new URL(body.imageUrl).hostname.slice(0, 253);
          } catch {
            // Do not echo the untrusted URL into telemetry.
          }
          await recordSecurityEvent(req, {
            eventType: "detection.meal_image_ssrf_blocked",
            category: "detection",
            severity: "high",
            outcome: "blocked",
            principal,
            action: "fetch_meal_image",
            resourceType: "network.destination",
            resourceId: hostname,
          });
        }
        throw error;
      }

      try {
        image = await fetchRemoteImage(remoteUrl);
      } catch (error) {
        if (error instanceof HttpError) throw error;
        console.error("Remote meal image fetch failed");
        await recordProviderFailure(req, principal, "image_fetch_failed");
        await completeBudget("failed");
        return createFallbackResponse(req, mode, "image_fetch_failed");
      }
    }

    const apiKey = Deno.env.get("MANUS_API_KEY");
    if (!apiKey) {
      console.error("Meal image AI provider is not configured");
      await recordProviderFailure(req, principal, "provider_not_configured");
      await completeBudget("failed");
      return createFallbackResponse(req, mode);
    }

    const tagList = availableTags.length
      ? availableTags.join(", ")
      : "vegetarian, vegan, keto, gluten-free, dairy-free, low-carb, high-protein";
    const systemPrompt = mode === "quick_scan"
      ? "You are a nutrition expert. Analyze the food image and identify visible food items with estimated nutrition values. Always respond with valid JSON only, no markdown."
      : "You are a nutrition expert. Analyze the meal image and provide detailed nutritional information. Always respond with valid JSON only, no markdown. Always respond in English.";
    const userPrompt = mode === "quick_scan"
      ? `Analyze this food image and list the visible food items with estimated nutrition values. Available diet tags: ${
        availableTags.length ? tagList : "none"
      }. Respond with JSON in this exact format: {"items": [{"name": "Food Name", "calories": 100, "protein_g": 10, "carbs_g": 15, "fat_g": 5}]}`
      : `Analyze this meal image and provide detailed information. Available diet tags to choose from: ${tagList}. Respond with JSON in this exact format: {"name": "Meal Name", "description": "Brief description", "calories": 450, "protein_g": 25, "carbs_g": 40, "fat_g": 18, "fiber_g": 8, "prep_time_minutes": 20, "suggested_price": 35, "diet_tags": ["high-protein", "gluten-free"]}`;

    let providerResult: { status: number; content: string | null };
    try {
      providerResult = await callVisionProvider(
        apiKey,
        image,
        userPrompt,
        systemPrompt,
      );
    } catch (error) {
      console.error("Meal image AI provider request failed");
      await recordProviderFailure(
        req,
        principal,
        error instanceof HttpError ? error.code : "provider_request_failed",
      );
      await completeBudget("failed");
      return createFallbackResponse(req, mode, "ai_service_unavailable");
    }

    if (!providerResult.content) {
      console.error(
        "Meal image AI provider returned no usable content",
        providerResult.status,
      );
      await recordProviderFailure(
        req,
        principal,
        "provider_response_invalid",
        providerResult.status,
      );
      await completeBudget("failed");
      return createFallbackResponse(req, mode, "ai_service_unavailable");
    }

    try {
      const jsonMatch = providerResult.content.match(
        /```(?:json)?\s*([\s\S]*?)```/,
      );
      const parsed: unknown = JSON.parse(
        jsonMatch ? jsonMatch[1].trim() : providerResult.content.trim(),
      );
      const resetAt = new Date(rateLimit.resetAt).toISOString();
      const normalizedOutput = mode === "quick_scan"
        ? { detectedItems: normalizeQuickScanOutput(parsed) }
        : { mealDetails: normalizeMealOutput(parsed, availableTags) };

      await logSuccessfulAnalysis();
      await recordSecurityEvent(req, {
        eventType: "edge.meal_image_analyzed",
        category: "edge_function",
        severity: "info",
        outcome: "success",
        principal,
        action: "analyze_meal_image",
        resourceType: "ai.provider",
        resourceId: "gemini-2.5-flash",
        metadata: { mode: mode || "detailed" },
      });

      if ("detectedItems" in normalizedOutput) {
        const { detectedItems } = normalizedOutput;
        await completeBudget("completed", JSON.stringify(detectedItems).length);
        return analyzeJsonResponse(req, {
          success: true,
          detectedItems,
          rateLimit: { remaining: rateLimit.remaining, resetAt },
          requestId: budgetRequestId,
        });
      }

      const { mealDetails } = normalizedOutput;
      await completeBudget("completed", JSON.stringify(mealDetails).length);
      return analyzeJsonResponse(req, {
        success: true,
        mealDetails,
        rateLimit: { remaining: rateLimit.remaining, resetAt },
        requestId: budgetRequestId,
      });
    } catch {
      console.error("Meal image AI response could not be parsed");
      await recordProviderFailure(req, principal, "provider_output_invalid");
      await completeBudget("failed");
      return analyzeJsonResponse(req, {
        success: false,
        error: "Failed to parse AI response",
        mealDetails: {
          name: "",
          description: "",
          calories: 0,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
          fiber_g: 0,
          prep_time_minutes: 15,
          diet_tags: [],
        },
      });
    }
  } catch (error) {
    if (error instanceof HttpError) {
      const messages: Record<string, string> = {
        invalid_json: "Invalid request body",
        json_required: "JSON request body required",
        request_too_large: "Request is too large",
        invalid_image_url: "Invalid image URL",
        image_url_not_allowed: "Image URL is not allowed",
        image_redirect_not_allowed: "Image redirects are not allowed",
        invalid_image_data: "Invalid image data",
        unsupported_image_type: "Unsupported image type",
        image_too_large: "Image is too large",
        invalid_available_tags: "Invalid available tags",
        invalid_request_identifier: "Invalid request identifier",
        ai_budget_check_failed: "AI budget is unavailable",
        daily_ai_request_limit_reached: "Daily AI analysis limit reached",
        duplicate_ai_request: "Duplicate AI request",
      };
      await completeBudget("failed");
      return analyzeJsonResponse(
        req,
        { success: false, error: messages[error.code] || error.code },
        error.status,
      );
    }

    await completeBudget("failed");
    console.error("Unexpected analyze-meal-image failure");
    return analyzeJsonResponse(req, { error: "Internal server error" }, 500);
  }
});
