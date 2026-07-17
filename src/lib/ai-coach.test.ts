import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    rpc: vi.fn(),
  },
}));

import { supabase } from "@/integrations/supabase/client";
import { aiCoachService } from "@/lib/ai-coach";

const invoke = vi.mocked(supabase.functions.invoke);
const rpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>;

describe("aiCoachService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends a stable request identifier without a caller-controlled user id", async () => {
    invoke.mockResolvedValue({
      data: {
        conversation: { id: "conversation-1" },
        message: { id: "message-1", role: "assistant", content: "Focus on protein." },
      },
      error: null,
    });

    await aiCoachService.sendMessage({
      conversationId: "conversation-1",
      message: "What should I focus on?",
      locale: "en",
      requestId: "8fb452df-0acb-47eb-899f-e82b930eed6f",
    });

    expect(invoke).toHaveBeenCalledWith("ai-coach", {
      body: {
        action: "send",
        conversationId: "conversation-1",
        message: "What should I focus on?",
        locale: "en",
        requestId: "8fb452df-0acb-47eb-899f-e82b930eed6f",
      },
    });
    expect(JSON.stringify(invoke.mock.calls[0])).not.toContain("userId");
  });

  it("surfaces the structured edge function error", async () => {
    const context = {
      clone: () => ({
        json: async () => ({ error: "coach_response_unavailable" }),
      }),
    };
    invoke.mockResolvedValue({
      data: null,
      error: Object.assign(new Error("Edge Function returned a non-2xx status code"), { context }),
    });

    await expect(aiCoachService.listConversations()).rejects.toThrow("coach_response_unavailable");
  });

  it("uses the versioned AI Coach consent RPCs", async () => {
    rpc.mockResolvedValue({ data: true, error: null, count: null, status: 200, statusText: "OK" });

    await expect(aiCoachService.hasConsent()).resolves.toBe(true);
    await aiCoachService.setConsent(false);

    expect(rpc).toHaveBeenNthCalledWith(1, "get_ai_coach_consent", {
      p_policy_version: "2026-07-health-ai-v1",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "set_ai_coach_consent", {
      p_granted: false,
      p_policy_version: "2026-07-health-ai-v1",
    });
  });

  it("invokes RPCs through the Supabase client context", async () => {
    const contextAwareRpc = rpc.mockImplementation(function (this: typeof supabase) {
      expect(this).toBe(supabase);
      return Promise.resolve({
        data: true,
        error: null,
        count: null,
        status: 200,
        statusText: "OK",
      });
    });

    await expect(aiCoachService.hasConsent()).resolves.toBe(true);
    expect(contextAwareRpc).toHaveBeenCalledOnce();
  });
});
