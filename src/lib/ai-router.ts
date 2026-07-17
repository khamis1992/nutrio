import { supabase } from "@/integrations/supabase/client";

export type AiTask =
  | "weekly_report"
  | "blood_work"
  | "coach_chat"
  | "meal_explanation"
  | "meal_plan"
  | "translation"
  | "general";

export interface AiTaskRequest {
  task: AiTask;
  systemPrompt: string;
  userPrompt: string;
  retrievalQuery?: string;
  asOf?: string;
}

export interface AiCitation {
  title: string;
  publisher: string;
  version: string;
  sourceUrl: string;
  effectiveFrom: string;
}

export interface AiTaskResult {
  content: string;
  provider: string;
  model: string;
  citations: AiCitation[];
  routed: boolean;
}

const routerIsNotDeployed = (error: unknown) => {
  if (!error) return false;
  const candidate = error as { message?: string; context?: { status?: number } };
  return candidate.context?.status === 404 || /not found|function.*missing/i.test(candidate.message || "");
};

export async function runAiTask(request: AiTaskRequest): Promise<AiTaskResult> {
  const { data, error } = await supabase.functions.invoke("ai-router", { body: request });
  if (!error && data?.content) {
    return {
      content: String(data.content),
      provider: String(data.provider || "unknown"),
      model: String(data.model || "unknown"),
      citations: Array.isArray(data.citations) ? data.citations : [],
      routed: true,
    };
  }

  // Compatibility is authenticated too; the legacy proxy now rejects anon keys.
  if (routerIsNotDeployed(error)
    && ["weekly_report", "blood_work", "coach_chat", "meal_explanation", "meal_plan", "general"].includes(request.task)) {
    const fallback = await supabase.functions.invoke("proxy-openrouter", {
      body: { systemPrompt: request.systemPrompt, userPrompt: request.userPrompt },
    });
    if (!fallback.error && fallback.data?.content) {
      return {
        content: String(fallback.data.content),
        provider: String(fallback.data.provider || "legacy"),
        model: String(fallback.data.model || "legacy"),
        citations: [],
        routed: false,
      };
    }
    throw fallback.error || error || new Error("AI_RESPONSE_EMPTY");
  }

  throw error || new Error("AI_ROUTER_UNAVAILABLE");
}
