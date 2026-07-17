import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import {
  authenticateRequest,
  enforceRateLimit,
  errorResponse,
  getClientIp,
  getSupabasePublishableKey,
  handlePreflight,
  HttpError,
  jsonResponse,
  readJsonBody,
  recordSecurityEvent,
  requirePost,
} from "../_shared/security.ts";

type AiTask =
  | "weekly_report"
  | "blood_work"
  | "coach_chat"
  | "meal_explanation"
  | "meal_plan"
  | "translation"
  | "general";

interface AiRouterRequest {
  task: AiTask;
  systemPrompt: string;
  userPrompt: string;
  retrievalQuery?: string;
  asOf?: string;
}

const policies: Record<AiTask, { temperature: number; maxTokens: number; retrieval: boolean }> = {
  weekly_report: { temperature: 0.4, maxTokens: 2000, retrieval: true },
  blood_work: { temperature: 0.25, maxTokens: 2200, retrieval: true },
  coach_chat: { temperature: 0.45, maxTokens: 900, retrieval: true },
  meal_explanation: { temperature: 0.35, maxTokens: 700, retrieval: true },
  meal_plan: { temperature: 0.3, maxTokens: 2400, retrieval: false },
  translation: { temperature: 0.1, maxTokens: 1200, retrieval: false },
  general: { temperature: 0.4, maxTokens: 1000, retrieval: false },
};

serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    requirePost(req);
    const principal = await authenticateRequest(req);
    const clientIp = getClientIp(req) || "unknown";

    await Promise.all([
      enforceRateLimit(req, "ai-router:user", principal.user.id, 40, 60 * 60),
      enforceRateLimit(req, "ai-router:ip", clientIp, 12, 60),
    ]);

    const body = await readJsonBody<AiRouterRequest>(req, 56 * 1024);
    const policy = policies[body.task];
    if (!policy) throw new HttpError(400, "unsupported_ai_task");

    const systemPrompt = body.systemPrompt?.trim();
    const userPrompt = body.userPrompt?.trim();
    if (!systemPrompt || !userPrompt) throw new HttpError(400, "prompts_required");
    if (systemPrompt.length > 12_000 || userPrompt.length > 30_000) {
      throw new HttpError(413, "prompt_too_large");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    let publishableKey: string;
    try {
      publishableKey = getSupabasePublishableKey();
    } catch {
      throw new HttpError(503, "ai_provider_not_configured");
    }
    const deepseekKey = Deno.env.get("DEEPSEEK_API_KEY");
    if (!supabaseUrl || !deepseekKey) {
      throw new HttpError(503, "ai_provider_not_configured");
    }

    let citations: Array<Record<string, unknown>> = [];
    if (policy.retrieval && body.retrievalQuery?.trim()) {
      const authorization = req.headers.get("authorization") || "";
      const retrievalResponse = await fetch(
        `${supabaseUrl}/rest/v1/rpc/search_nutrition_knowledge`,
        {
          method: "POST",
          headers: {
            apikey: publishableKey,
            Authorization: authorization,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            p_query: body.retrievalQuery.slice(0, 500),
            p_as_of: body.asOf || new Date().toISOString().slice(0, 10),
            p_limit: 5,
          }),
        },
      );
      if (retrievalResponse.ok) citations = await retrievalResponse.json();
    }

    const knowledgeContext = citations.length > 0
      ? `\n\nREFERENCE CONTEXT (cite sources by title and version; do not exceed the evidence):\n${citations
        .map((citation, index) =>
          `[${index + 1}] ${citation.title} (${citation.publisher}, ${citation.version})\n${citation.content}`
        )
        .join("\n\n")}`
      : "";
    const safety =
      "Do not diagnose, prescribe, or replace a qualified clinician. Clearly mark uncertainty and recommend professional review for clinical concerns.";

    const aiResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${deepseekKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: `${systemPrompt}\n\n${safety}${knowledgeContext}` },
          { role: "user", content: userPrompt },
        ],
        temperature: policy.temperature,
        max_tokens: policy.maxTokens,
      }),
    });

    const aiData = await aiResponse.json().catch(() => null);
    if (!aiResponse.ok) {
      console.error("AI provider failed:", aiResponse.status, aiData?.error?.message || "unknown");
      await recordSecurityEvent(req, {
        eventType: "edge.ai_provider_failure",
        category: "edge_function",
        severity: aiResponse.status === 429 ? "medium" : "low",
        outcome: "failure",
        principal,
        action: body.task,
        resourceType: "edge_function",
        resourceId: "ai-router",
        metadata: { task: body.task, provider_status: aiResponse.status },
      });
      throw new HttpError(502, "ai_provider_failed");
    }

    const content = aiData?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new HttpError(502, "empty_ai_response");
    }

    await recordSecurityEvent(req, {
      eventType: "edge.ai_request_completed",
      category: "edge_function",
      severity: "info",
      outcome: "success",
      principal,
      action: body.task,
      resourceType: "edge_function",
      resourceId: "ai-router",
      metadata: {
        task: body.task,
        retrieval_sources: citations.length,
        response_chars: content.length,
      },
    });

    return jsonResponse(req, {
      content,
      task: body.task,
      provider: "deepseek",
      model: "deepseek-chat",
      citations: citations.map((citation) => ({
        title: citation.title,
        publisher: citation.publisher,
        version: citation.version,
        sourceUrl: citation.source_url,
        effectiveFrom: citation.effective_from,
      })),
    });
  } catch (error) {
    return errorResponse(req, error);
  }
});
