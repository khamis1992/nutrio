import { supabase } from "@/integrations/supabase/client";

export type AiTask =
  | "weekly_report"
  | "meal_plan";

export interface AiTaskRequest {
  task: AiTask;
  input: Record<string, unknown>;
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

async function normalizeAiRouterError(error: unknown): Promise<Error> {
  const context = error && typeof error === "object"
    ? (error as { context?: unknown }).context
    : null;

  if (context instanceof Response) {
    const payload = await context.clone().json().catch(() => null) as {
      error?: unknown;
      message?: unknown;
    } | null;
    const code = typeof payload?.error === "string"
      ? payload.error
      : typeof payload?.message === "string"
        ? payload.message
        : null;
    if (code) return new Error(code);
  }

  return error instanceof Error ? error : new Error("AI_ROUTER_UNAVAILABLE");
}

export async function runAiTask(request: AiTaskRequest): Promise<AiTaskResult> {
  const { data, error } = await supabase.functions.invoke("ai-router", {
    body: { ...request, requestId: crypto.randomUUID() },
  });
  if (!error && data?.content) {
    return {
      content: String(data.content),
      provider: String(data.provider || "unknown"),
      model: String(data.model || "unknown"),
      citations: Array.isArray(data.citations) ? data.citations : [],
      routed: true,
    };
  }

  throw error
    ? await normalizeAiRouterError(error)
    : new Error("AI_ROUTER_UNAVAILABLE");
}
