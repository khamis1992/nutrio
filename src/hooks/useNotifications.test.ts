import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";
import { useNotifications } from "@/hooks/useNotifications";
import { renderHookWithProviders } from "@/test/testUtils";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    }),
    removeChannel: vi.fn(),
  },
}));

vi.mock("@/lib/retry", () => ({
  withRetry: vi.fn((fn) => fn()),
}));

import { supabase } from "@/integrations/supabase/client";

describe("useNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (supabase as any).channel = vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    });
  });

  it("returns 0 unreadCount when userId is undefined", () => {
    const { result } = renderHookWithProviders(() => useNotifications(undefined));
    expect(result.current.unreadCount).toBe(0);
  });

  it("fetches unread count from notifications table", async () => {
    (supabase as any).from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
        }),
      }),
    });

    const { result } = renderHookWithProviders(() => useNotifications("user-1"));

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(5);
    });
  });

  it("returns 0 when fetch returns null count", async () => {
    (supabase as any).from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: null, error: null }),
        }),
      }),
    });

    const { result } = renderHookWithProviders(() => useNotifications("user-1"));

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(0);
    });
  });

  it("returns 0 on fetch error", async () => {
    (supabase as any).from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: null, error: new Error("DB error") }),
        }),
      }),
    });

    const { result } = renderHookWithProviders(() => useNotifications("user-1"));

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(0);
    });
  });

  it("subscribes to realtime channel for user notifications", () => {
    const mockOn = vi.fn().mockReturnThis();
    const mockSubscribe = vi.fn().mockReturnValue({ unsubscribe: vi.fn() });
    (supabase as any).channel = vi.fn().mockReturnValue({
      on: mockOn,
      subscribe: mockSubscribe,
    });
    (supabase as any).from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
        }),
      }),
    });

    renderHookWithProviders(() => useNotifications("user-1"));

    expect(supabase.channel).toHaveBeenCalledWith(expect.stringContaining("user-1"));
    expect(mockOn).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({
        table: "notifications",
        filter: expect.stringContaining("user-1"),
      }),
      expect.any(Function)
    );
    expect(mockSubscribe).toHaveBeenCalled();
  });

  it("removes realtime channel on unmount", () => {
    const mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    };
    mockChannel.subscribe.mockReturnValue(mockChannel);
    (supabase as any).channel = vi.fn().mockReturnValue(mockChannel);
    (supabase as any).from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
        }),
      }),
    });

    const { unmount } = renderHookWithProviders(() => useNotifications("user-1"));
    unmount();

    expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);
  });
});
