import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useHasRestaurant } from "@/hooks/useHasRestaurant";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from "@/integrations/supabase/client";

describe("useHasRestaurant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns hasRestaurant=false and loading=false when userId is undefined", () => {
    const { result } = renderHook(() => useHasRestaurant(undefined));
    expect(result.current.hasRestaurant).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("returns hasRestaurant=true when user owns a restaurant", async () => {
    (supabase as any).from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: "r1" }, error: null }),
        }),
      }),
    });

    const { result } = renderHook(() => useHasRestaurant("user-1"));

    await waitFor(() => {
      expect(result.current.hasRestaurant).toBe(true);
      expect(result.current.loading).toBe(false);
    });
  });

  it("returns hasRestaurant=false when user has no restaurant", async () => {
    (supabase as any).from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    const { result } = renderHook(() => useHasRestaurant("user-1"));

    await waitFor(() => {
      expect(result.current.hasRestaurant).toBe(false);
      expect(result.current.loading).toBe(false);
    });
  });

  it("sets error when query fails", async () => {
    (supabase as any).from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: new Error("Query failed"),
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useHasRestaurant("user-1"));

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.hasRestaurant).toBe(false);
      expect(result.current.loading).toBe(false);
    });
  });

  it("sets error on thrown exception", async () => {
    (supabase as any).from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockRejectedValue(new Error("Network error")),
        }),
      }),
    });

    const { result } = renderHook(() => useHasRestaurant("user-1"));

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.hasRestaurant).toBe(false);
      expect(result.current.loading).toBe(false);
    });
  });
});