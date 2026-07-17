import { supabase } from "@/integrations/supabase/client";

export type AiCoachLocale = "ar" | "en";
export type AiCoachRole = "user" | "assistant";
export type AiCoachMemoryType = "preference" | "routine" | "constraint" | "goal" | "context";
export const AI_COACH_CONSENT_VERSION = "2026-07-health-ai-v1";

type RpcError = { message: string };
type RpcResult<T> = { data: T; error: RpcError | null };
async function invokeRpc<T>(
  functionName: string,
  args: Record<string, unknown>,
): Promise<RpcResult<T>> {
  const rpc = supabase.rpc as unknown as (
    this: typeof supabase,
    name: string,
    parameters: Record<string, unknown>,
  ) => Promise<RpcResult<T>>;
  return await rpc.call(supabase, functionName, args);
}

export interface AiCoachConversation {
  id: string;
  title: string;
  locale: AiCoachLocale;
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

export interface AiCoachMessage {
  id: string;
  conversation_id: string;
  role: AiCoachRole;
  content: string;
  created_at: string;
}

export interface AiCoachMemory {
  id: string;
  memory_type: AiCoachMemoryType;
  content: string;
  confidence: number;
  last_confirmed_at: string;
  created_at: string;
}

interface FunctionErrorPayload {
  error?: string;
}

interface FunctionInvokeError extends Error {
  context?: {
    clone?: () => { json: () => Promise<unknown> };
    json?: () => Promise<unknown>;
  };
}

async function readFunctionError(error: FunctionInvokeError | null): Promise<string | undefined> {
  if (!error?.context) return error?.message;

  try {
    const context = error.context.clone?.() ?? error.context;
    const payload = await context.json?.() as FunctionErrorPayload | undefined;
    return payload?.error || error.message;
  } catch {
    return error.message;
  }
}

async function invokeCoach<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("ai-coach", { body });
  const result = data as (T & FunctionErrorPayload) | null;
  if (error || !result || result.error) {
    throw new Error(result?.error || await readFunctionError(error) || "ai_coach_unavailable");
  }
  return result;
}

export const aiCoachService = {
  async hasConsent(): Promise<boolean> {
    const { data, error } = await invokeRpc<boolean>("get_ai_coach_consent", {
      p_policy_version: AI_COACH_CONSENT_VERSION,
    });
    if (error) throw new Error(error.message);
    return data === true;
  },

  async setConsent(granted: boolean): Promise<void> {
    const { error } = await invokeRpc<unknown>("set_ai_coach_consent", {
      p_granted: granted,
      p_policy_version: AI_COACH_CONSENT_VERSION,
    });
    if (error) throw new Error(error.message);
  },

  async listConversations(): Promise<AiCoachConversation[]> {
    const result = await invokeCoach<{ conversations: AiCoachConversation[] }>({ action: "list" });
    return result.conversations;
  },

  async getMessages(conversationId: string): Promise<AiCoachMessage[]> {
    const result = await invokeCoach<{ messages: AiCoachMessage[] }>({
      action: "messages",
      conversationId,
    });
    return result.messages;
  },

  async sendMessage(input: {
    conversationId?: string;
    message: string;
    locale: AiCoachLocale;
    requestId: string;
  }): Promise<{
    conversation: AiCoachConversation;
    userMessage?: AiCoachMessage;
    message: AiCoachMessage;
    memoriesAdded?: number;
    duplicate?: boolean;
  }> {
    return invokeCoach({ action: "send", ...input });
  },

  async archiveConversation(conversationId: string): Promise<void> {
    await invokeCoach({ action: "archive", conversationId });
  },

  async listMemories(): Promise<AiCoachMemory[]> {
    const result = await invokeCoach<{ memories: AiCoachMemory[] }>({ action: "list_memories" });
    return result.memories;
  },

  async deleteMemory(memoryId: string): Promise<void> {
    await invokeCoach({ action: "delete_memory", memoryId });
  },
};
