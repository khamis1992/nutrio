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
      input: { daysLogged: 5, locale: "en" },
    })).resolves.toMatchObject({ content: "Evidence-based response", routed: true, citations: [{ title: "Guide" }] });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("ai-router", {
      body: expect.objectContaining({
        task: "weekly_report",
        input: { daysLogged: 5, locale: "en" },
        requestId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      }),
    });
  });

  it("fails closed when the task router is unavailable", async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: new Error("function not found"),
    } as never);

    await expect(runAiTask({
      task: "weekly_report",
      input: { daysLogged: 5, locale: "en" },
    })).rejects.toThrow("function not found");
    expect(invoke.mock.calls.map(([name]) => name)).toEqual(["ai-router"]);
  });
});
