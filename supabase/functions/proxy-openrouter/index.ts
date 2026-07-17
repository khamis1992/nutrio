import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import {
  authenticateRequest,
  enforceRateLimit,
  errorResponse,
  getClientIp,
  handlePreflight,
  HttpError,
  jsonResponse,
  readJsonBody,
  recordSecurityEvent,
  requirePost,
} from "../_shared/security.ts";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

interface AIProxyRequest {
  systemPrompt: string;
  userPrompt: string;
}

serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    requirePost(req);
    const principal = await authenticateRequest(req);
    const clientIp = getClientIp(req) || "unknown";

    await Promise.all([
      enforceRateLimit(req, "ai-proxy:user", principal.user.id, 30, 60 * 60),
      enforceRateLimit(req, "ai-proxy:ip", clientIp, 10, 60),
    ]);

    const body = await readJsonBody<AIProxyRequest>(req, 48 * 1024);
    const systemPrompt = body.systemPrompt?.trim();
    const userPrompt = body.userPrompt?.trim();
    if (!systemPrompt || !userPrompt) {
      throw new HttpError(400, "prompts_required");
    }
    if (systemPrompt.length > 12_000 || userPrompt.length > 30_000) {
      throw new HttpError(413, "prompt_too_large");
    }

    const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
    if (!apiKey) throw new HttpError(503, "ai_provider_not_configured");

    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 2000,
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      await recordSecurityEvent(req, {
        eventType: "edge.ai_provider_failure",
        category: "edge_function",
        severity: response.status === 429 ? "medium" : "low",
        outcome: "failure",
        principal,
        action: "generate_ai_content",
        resourceType: "edge_function",
        resourceId: "proxy-openrouter",
        metadata: { provider_status: response.status },
      });
      console.error("DeepSeek request failed:", response.status, data?.error?.message || "unknown");
      throw new HttpError(502, "ai_provider_failed");
    }

    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new HttpError(502, "empty_ai_response");
    }

    await recordSecurityEvent(req, {
      eventType: "edge.ai_request_completed",
      category: "edge_function",
      severity: "info",
      outcome: "success",
      principal,
      action: "generate_ai_content",
      resourceType: "edge_function",
      resourceId: "proxy-openrouter",
      metadata: { response_chars: content.length },
    });

    return jsonResponse(req, {
      content,
      provider: "deepseek",
      model: "deepseek-chat",
    });
  } catch (error) {
    return errorResponse(req, error);
  }
});
