import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useFavoriteRestaurants } from "@/hooks/useFavoriteRestaurants";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

describe("useFavoriteRestaurants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty set when user is null", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null, session: null, loading: false, signUp: vi.fn(), signIn: vi.fn(), signOut: vi.fn(),
    });

    const { result } = renderHook(() => useFavoriteRestaurants());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.favoriteIds.size).toBe(0);
    expect(result.current.isFavorite("r1")).toBe(false);
  });

  it("fetches favorites and returns correct isFavorite", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-1", email: "test@example.com" },
      session: null,
      loading: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    (supabase as any).from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [{ restaurant_id: "r1" }, { restaurant_id: "r2" }],
          error: null,
        }),
      }),
    });

    const { result } = renderHook(() => useFavoriteRestaurants());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isFavorite("r1")).toBe(true);
    expect(result.current.isFavorite("r2")).toBe(true);
    expect(result.current.isFavorite("r3")).toBe(false);
  });

  it("toggles favorite add", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-1", email: "test@example.com" },
      session: null,
      loading: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    (supabase as any).from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
      insert: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const { result } = renderHook(() => useFavoriteRestaurants());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggleFavorite("r1", "Restaurant 1");
    });

    expect(result.current.isFavorite("r1")).toBe(true);
  });

  it("handles fetch error gracefully", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-1", email: "test@example.com" },
      session: null,
      loading: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    (supabase as any).from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: new Error("DB error") }),
      }),
    });

    const { result } = renderHook(() => useFavoriteRestaurants());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.favoriteIds.size).toBe(0);
  });

  it("toggles favorite remove (unfavorite)", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-1", email: "test@example.com" },
      session: null,
      loading: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    (supabase as any).from = vi.fn().mockImplementation((table: string) => {
      if (table === "user_favorite_restaurants") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [{ restaurant_id: "r1" }], error: null }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const { result } = renderHook(() => useFavoriteRestaurants());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isFavorite("r1")).toBe(true);

    await act(async () => {
      await result.current.toggleFavorite("r1", "Restaurant 1");
    });

    expect(result.current.isFavorite("r1")).toBe(false);
  });

  it("toggles favorite failure reverts optimistic update", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-1", email: "test@example.com" },
      session: null,
      loading: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    (supabase as any).from = vi.fn().mockImplementation((table: string) => {
      if (table === "user_favorite_restaurants") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          insert: vi.fn().mockResolvedValue({ error: new Error("Insert failed") }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const { result } = renderHook(() => useFavoriteRestaurants());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggleFavorite("r1", "Restaurant 1");
    });

    expect(result.current.isFavorite("r1")).toBe(false);
  });
});