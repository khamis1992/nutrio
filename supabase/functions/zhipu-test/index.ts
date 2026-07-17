import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  enforceRateLimit,
  handlePreflight,
  HttpError,
  jsonResponse,
  recordSecurityEvent,
  requireAdmin,
  requirePost,
  type SecurityPrincipal,
} from "../_shared/security.ts";

const MAX_PROVIDER_RESPONSE_BYTES = 256 * 1024;

async function readProviderResponse(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_PROVIDER_RESPONSE_BYTES
  ) {
    throw new HttpError(502, "provider_response_too_large");
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
        throw new HttpError(502, "provider_response_too_large");
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

function testErrorResponse(req: Request, error: unknown): Response {
  if (error instanceof HttpError) {
    const messages: Record<string, string> = {
      authentication_required: "Unauthorized",
      invalid_or_expired_token: "Unauthorized",
      admin_required: "Administrator access required",
      rate_limit_exceeded: "Rate limit exceeded",
      request_too_large: "Request is too large",
      provider_response_too_large: "AI provider returned an invalid response",
      zhipu_not_configured: "AI service is not configured",
      zhipu_request_failed: "AI provider request failed",
    };
    return jsonResponse(
      req,
      { error: messages[error.code] || "Request failed" },
      error.status,
    );
  }

  console.error("Unexpected zhipu-test failure");
  return jsonResponse(req, { error: "Internal server error" }, 500);
}

serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  let principal: SecurityPrincipal | null = null;
  try {
    requirePost(req);

    const declaredLength = Number(req.headers.get("content-length") || 0);
    if (Number.isFinite(declaredLength) && declaredLength > 1024) {
      throw new HttpError(413, "request_too_large");
    }

    principal = await requireAdmin(req);
    const apiKey = Deno.env.get("ZHIPU_API_KEY");
    if (!apiKey) throw new HttpError(503, "zhipu_not_configured");

    // Reserve the paid test call atomically so concurrent admin requests cannot
    // overspend the diagnostic allowance.
    await enforceRateLimit(req, "zhipu-test", principal.user.id, 5, 60 * 60);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    let providerResponse: Response;
    let responseText: string;
    try {
      providerResponse = await fetch(
        "https://open.bigmodel.cn/api/paas/v4/chat/completions",
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "glm-3-turbo",
            messages: [{ role: "user", content: "Hello, what is your name?" }],
          }),
        },
      );
      responseText = await readProviderResponse(providerResponse);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(502, "zhipu_request_failed");
    } finally {
      clearTimeout(timeout);
    }

    await recordSecurityEvent(req, {
      eventType: "admin.paid_ai_test_executed",
      category: "admin",
      severity: "medium",
      outcome: providerResponse.ok ? "success" : "failure",
      principal,
      action: "test_zhipu_provider",
      resourceType: "ai.provider",
      resourceId: "zhipu",
      metadata: { provider_status: providerResponse.status },
    });

    // Keep the diagnostic response contract for authorized administrators.
    return jsonResponse(req, {
      status: providerResponse.status,
      response: responseText,
    });
  } catch (error) {
    if (principal && !(error instanceof HttpError && error.status < 500)) {
      await recordSecurityEvent(req, {
        eventType: "admin.paid_ai_test_failed",
        category: "admin",
        severity: "medium",
        outcome: "failure",
        principal,
        action: "test_zhipu_provider",
        resourceType: "ai.provider",
        resourceId: "zhipu",
      });
    }
    return testErrorResponse(req, error);
  }
});
