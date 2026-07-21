import { supabase } from "@/integrations/supabase/client";

export const BLOOD_WORK_AI_CONSENT_VERSION = "2026-07-health-ai-v1";

type RpcError = { message: string };
type RpcResult<T> = { data: T; error: RpcError | null };

type BloodWorkAnalysisResponse = {
  content?: unknown;
  error?: unknown;
  message?: unknown;
};

const invokeRpc = supabase.rpc.bind(supabase) as unknown as <T>(
  functionName: string,
  args: Record<string, unknown>,
) => PromiseLike<RpcResult<T>>;

async function getFunctionErrorCode(error: unknown): Promise<string | null> {
  if (!error || typeof error !== "object") return null;
  const context = (error as { context?: unknown }).context;
  if (!(context instanceof Response)) return null;

  try {
    const body = await context.clone().json() as BloodWorkAnalysisResponse;
    return typeof body.error === "string" ? body.error : null;
  } catch {
    return null;
  }
}

export async function hasBloodWorkAiConsent(): Promise<boolean> {
  const { data, error } = await invokeRpc<boolean>("get_ai_data_consent", {
    p_purpose: "blood_work_analysis",
    p_policy_version: BLOOD_WORK_AI_CONSENT_VERSION,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

export async function setBloodWorkAiConsent(granted: boolean): Promise<void> {
  const { error } = await invokeRpc<unknown>("set_ai_data_consent", {
    p_purpose: "blood_work_analysis",
    p_granted: granted,
    p_policy_version: BLOOD_WORK_AI_CONSENT_VERSION,
  });
  if (error) throw new Error(error.message);
}

export async function analyzeBloodWork(recordId: string): Promise<string> {
  const requestId = crypto.randomUUID();
  const { data, error } = await supabase.functions.invoke<BloodWorkAnalysisResponse>(
    "analyze-blood-work",
    { body: { recordId, requestId } },
  );

  if (error) {
    const code = await getFunctionErrorCode(error);
    if (code === "health_ai_consent_required") {
      throw new Error("AI health data permission is required before generating this insight.");
    }
    if (code === "daily_ai_analysis_limit_reached") {
      throw new Error("You have reached today's AI health insight limit. Try again tomorrow.");
    }
    if (code === "blood_markers_required") {
      throw new Error("Add blood marker values before generating an AI insight.");
    }
    throw new Error("Nutrio could not generate this insight securely. Please try again.");
  }

  if (typeof data?.content !== "string" || !data.content.trim()) {
    throw new Error("Nutrio returned an empty insight. Please try again.");
  }

  return data.content.trim();
}
