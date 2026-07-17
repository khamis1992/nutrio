import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

import { supabase } from "@/integrations/supabase/client";
import { runAiTask } from "@/lib/ai-router";

const invoke = vi.mocked(supabase.functions.invoke);

describe("runAiTask", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the authenticated task router and keeps citations", async () => {
    invoke.mockResolvedValue({
      data: { content: "Evidence-based response", provider: "deepseek", model: "deepseek-chat", citations: [{ title: "Guide" }] },
      error: null,
    } as never);

    await expect(runAiTask({
      task: "weekly_report",
      systemPrompt: "Coach",
      userPrompt: "Summarize",
      retrievalQuery: "protein guidance",
    })).resolves.toMatchObject({ content: "Evidence-based response", routed: true, citations: [{ title: "Guide" }] });
  });

  it("falls back during router deployment", async () => {
    invoke
      .mockResolvedValueOnce({ data: null, error: new Error("function not found") } as never)
      .mockResolvedValueOnce({ data: { content: "Legacy response", provider: "deepseek", model: "deepseek-chat" }, error: null } as never);

    await expect(runAiTask({
      task: "weekly_report",
      systemPrompt: "Coach",
      userPrompt: "Summarize",
    })).resolves.toMatchObject({ content: "Legacy response", routed: false });
    expect(invoke.mock.calls.map(([name]) => name)).toEqual(["ai-router", "proxy-openrouter"]);
  });
});
