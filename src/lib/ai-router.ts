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

  throw error || new Error("AI_ROUTER_UNAVAILABLE");
}
