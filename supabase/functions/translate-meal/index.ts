import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  authenticateRequest,
  enforceRateLimit,
  getServiceClient,
  hasAdminAssurance,
  handlePreflight,
  HttpError,
  jsonResponse,
  readJsonBody,
  recordSecurityEvent,
  requirePost,
  type SecurityPrincipal,
} from "../_shared/security.ts";

const AZURE_TRANSLATOR_KEY = Deno.env.get("AZURE_TRANSLATOR_KEY");
const AZURE_TRANSLATOR_REGION = Deno.env.get("AZURE_TRANSLATOR_REGION") ||
  "global";
const AZURE_TRANSLATOR_ENDPOINT = Deno.env.get("AZURE_TRANSLATOR_ENDPOINT") ||
  "https://api.cognitive.microsofttranslator.com";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_TRANSLATION_CHARACTERS = 10_000;
const MAX_PROVIDER_RESPONSE_BYTES = 256 * 1024;

interface TranslationRequest {
  mealId?: unknown;
  text?: unknown;
  from?: unknown;
  to?: unknown;
}

interface TranslationResponse {
  success: boolean;
  translations?: Array<{ text: string; to: string }>;
  error?: string;
  charactersTranslated?: number;
  providerStatus?: number;
}

async function readProviderText(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_PROVIDER_RESPONSE_BYTES
  ) {
    throw new HttpError(502, "translation_response_too_large");
  }

  if (!response.body) return "";
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
        throw new HttpError(502, "translation_response_too_large");
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
  return new TextDecoder().decode(bytes);
}

async function translateWithAzure(
  texts: string[],
  fromLang: string,
  toLang: string,
): Promise<TranslationResponse> {
  if (!AZURE_TRANSLATOR_KEY) {
    return { success: false, error: "translation_service_unavailable" };
  }

  let endpoint: URL;
  try {
    endpoint = new URL(AZURE_TRANSLATOR_ENDPOINT);
    if (endpoint.protocol !== "https:") {
      return { success: false, error: "translation_service_unavailable" };
    }
    endpoint.pathname = `${endpoint.pathname.replace(/\/$/, "")}/translate`;
    endpoint.search = "";
    endpoint.searchParams.set("api-version", "3.0");
    endpoint.searchParams.set("from", fromLang);
    endpoint.searchParams.set("to", toLang);
  } catch {
    return { success: false, error: "translation_service_unavailable" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": AZURE_TRANSLATOR_KEY,
        "Ocp-Apim-Subscription-Region": AZURE_TRANSLATOR_REGION,
      },
      body: JSON.stringify(texts.map((text) => ({ text }))),
    });
    const responseText = await readProviderText(response);

    if (!response.ok) {
      console.error("Azure Translator request failed", response.status);
      return {
        success: false,
        error: "translation_service_unavailable",
        providerStatus: response.status,
      };
    }

    let data: unknown;
    try {
      data = JSON.parse(responseText);
    } catch {
      return { success: false, error: "invalid_translation_response" };
    }
    if (!Array.isArray(data) || data.length !== texts.length) {
      return { success: false, error: "invalid_translation_response" };
    }

    const translations = data.map((item) => {
      const candidate = item as {
        translations?: Array<{ text?: unknown; to?: unknown }>;
      };
      const translated = candidate.translations?.[0];
      if (typeof translated?.text !== "string") {
        throw new HttpError(502, "invalid_translation_response");
      }
      return {
        text: translated.text,
        to: typeof translated.to === "string" ? translated.to : toLang,
      };
    });

    return {
      success: true,
      translations,
      charactersTranslated: texts.reduce(
        (total, text) => total + text.length,
        0,
      ),
      providerStatus: response.status,
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error("Azure Translator request could not be completed");
    return { success: false, error: "translation_service_unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}

async function authorizeMeal(
  req: Request,
  principal: SecurityPrincipal,
  mealId: string,
): Promise<void> {
  const service = getServiceClient();
  const { data: meal, error: mealError } = await service
    .from("meals")
    .select("id,restaurant_id")
    .eq("id", mealId)
    .maybeSingle();

  if (mealError) {
    console.error("Meal authorization lookup failed:", mealError.message);
    throw new HttpError(503, "authorization_unavailable");
  }
  if (!meal) throw new HttpError(404, "meal_not_found");
  if (hasAdminAssurance(principal)) return;

  const { data: restaurant, error: restaurantError } = await service
    .from("restaurants")
    .select("owner_id")
    .eq("id", meal.restaurant_id)
    .maybeSingle();
  if (restaurantError) {
    console.error(
      "Restaurant authorization lookup failed:",
      restaurantError.message,
    );
    throw new HttpError(503, "authorization_unavailable");
  }

  if (!restaurant || restaurant.owner_id !== principal.user.id) {
    await recordSecurityEvent(req, {
      eventType: "authorization.meal_translation_denied",
      category: "authorization",
      severity: "high",
      outcome: "denied",
      principal,
      action: "translate_meal",
      resourceType: "meal",
      resourceId: mealId,
    });
    throw new HttpError(403, "meal_access_denied");
  }
}

async function storeTranslation(
  mealId: string,
  name: string,
  description: string | null,
): Promise<void> {
  const { error } = await getServiceClient()
    .from("meal_translations")
    .update({
      name,
      description,
      is_auto_translated: true,
      review_status: "pending",
      translation_api: "azure",
      updated_at: new Date().toISOString(),
    })
    .eq("meal_id", mealId)
    .eq("language_code", "ar");

  if (error) {
    console.error("Meal translation storage failed:", error.message);
    throw new HttpError(500, "translation_storage_failed");
  }
}

function translationErrorResponse(req: Request, error: unknown): Response {
  if (error instanceof HttpError) {
    const messages: Record<string, string> = {
      authentication_required: "Unauthorized",
      invalid_or_expired_token: "Unauthorized",
      meal_access_denied: "Forbidden",
      meal_not_found: "Meal not found",
      rate_limit_exceeded: "Rate limit exceeded",
      invalid_json: "Invalid request body",
      json_required: "JSON request body required",
      request_too_large: "Request is too large",
      authorization_unavailable: "Authorization service unavailable",
      invalid_translation_response: "Translation service unavailable",
      translation_response_too_large: "Translation service unavailable",
      translation_storage_failed:
        "Translation succeeded but failed to store in database",
    };
    return jsonResponse(
      req,
      { success: false, error: messages[error.code] || "Request failed" },
      error.status,
    );
  }

  console.error("Unexpected translate-meal failure");
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
  let mealId: string | null = null;

  try {
    requirePost(req);
    principal = await authenticateRequest(req);
    const parsedBody = await readJsonBody<unknown>(req, 16 * 1024);
    if (
      !parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)
    ) {
      return jsonResponse(req, {
        success: false,
        error: "Invalid request body",
      }, 400);
    }
    const body = parsedBody as TranslationRequest;

    if (
      typeof body.mealId !== "string" ||
      !Array.isArray(body.text) ||
      body.text.length === 0
    ) {
      return jsonResponse(
        req,
        { error: "Missing required fields: mealId, text array" },
        400,
      );
    }

    mealId = body.mealId;
    if (!UUID_PATTERN.test(mealId)) {
      return jsonResponse(
        req,
        { success: false, error: "Invalid meal ID" },
        400,
      );
    }
    if (
      body.text.length > 2 || body.text.some((text) => typeof text !== "string")
    ) {
      return jsonResponse(
        req,
        { success: false, error: "Invalid text array" },
        400,
      );
    }

    const texts = body.text as string[];
    const charactersTranslated = texts.reduce(
      (total, text) => total + text.length,
      0,
    );
    if (
      !texts[0]?.trim() ||
      texts.some((text) => text.length > MAX_TRANSLATION_CHARACTERS) ||
      charactersTranslated > MAX_TRANSLATION_CHARACTERS
    ) {
      return jsonResponse(req, {
        success: false,
        error: "Translation text is too long",
      }, 400);
    }

    const from = body.from === undefined ? "en" : body.from;
    const to = body.to === undefined ? "ar" : body.to;
    if (from !== "en" || to !== "ar") {
      return jsonResponse(req, {
        success: false,
        error: "Unsupported language pair",
      }, 400);
    }

    await authorizeMeal(req, principal, mealId);
    await enforceRateLimit(
      req,
      "translate-meal",
      principal.user.id,
      60,
      60 * 60,
    );

    const translationResult = await translateWithAzure(texts, from, to);
    if (!translationResult.success || !translationResult.translations) {
      await recordSecurityEvent(req, {
        eventType: "edge.meal_translation_failed",
        category: "edge_function",
        severity: translationResult.providerStatus === 429 ? "medium" : "low",
        outcome: "failure",
        principal,
        action: "translate_meal",
        resourceType: "meal",
        resourceId: mealId,
        metadata: {
          reason: translationResult.error || "translation_failed",
          ...(translationResult.providerStatus
            ? { provider_status: translationResult.providerStatus }
            : {}),
        },
      });
      return jsonResponse(
        req,
        { success: false, error: "Translation service unavailable" },
        500,
      );
    }

    const translatedName = translationResult.translations[0]?.text || texts[0];
    const translatedDescription = translationResult.translations[1]?.text ||
      texts[1] || null;
    await storeTranslation(mealId, translatedName, translatedDescription);

    await recordSecurityEvent(req, {
      eventType: "data_change.meal_translation_updated",
      category: "data_change",
      severity: "info",
      outcome: "success",
      principal,
      action: "translate_meal",
      resourceType: "meal",
      resourceId: mealId,
      metadata: {
        characters_translated: translationResult.charactersTranslated || 0,
      },
    });

    return jsonResponse(req, {
      success: true,
      mealId,
      translations: translationResult.translations,
      charactersTranslated: translationResult.charactersTranslated,
      reviewStatus: "pending",
    });
  } catch (error) {
    if (
      principal && mealId && !(error instanceof HttpError && error.status < 500)
    ) {
      await recordSecurityEvent(req, {
        eventType: "edge.meal_translation_failed",
        category: "edge_function",
        severity: "medium",
        outcome: "failure",
        principal,
        action: "translate_meal",
        resourceType: "meal",
        resourceId: mealId,
      });
    }
    return translationErrorResponse(req, error);
  }
});
