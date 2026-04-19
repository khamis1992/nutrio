import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useFeaturedRestaurants } from "@/hooks/useFeaturedRestaurants";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from "@/integrations/supabase/client";

describe("useFeaturedRestaurants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array initially and loading true", () => {
    (supabase as any).from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          filter: vi.fn().mockReturnValue({
            filter: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useFeaturedRestaurants());
    expect(result.current.loading).toBe(true);
  });

  it("fetches and maps featured restaurants", async () => {
    const mockListings = [
      { id: "fl1", package_type: "premium", ends_at: "2026-05-01", restaurant_id: "r1" },
    ];
    const mockRestaurants = [
      { id: "r1", name: "Healthy Bites", description: "Fresh meals", logo_url: "logo.png", rating: "4.5", total_orders: 120 },
    ];
    const mockMeals = [
      { restaurant_id: "r1", id: "m1" },
      { restaurant_id: "r1", id: "m2" },
    ];

    let callIndex = 0;
    (supabase as any).from = vi.fn().mockImplementation((table: string) => {
      callIndex++;
      if (table === "featured_listings") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              filter: vi.fn().mockReturnValue({
                filter: vi.fn().mockResolvedValue({ data: mockListings, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "restaurants") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: mockRestaurants, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "meals") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: mockMeals, error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const { result } = renderHook(() => useFeaturedRestaurants());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.featuredRestaurants).toHaveLength(1);
    expect(result.current.featuredRestaurants[0].name).toBe("Healthy Bites");
    expect(result.current.featuredRestaurants[0].meal_count).toBe(2);
  });

  it("returns empty array when no featured listings", async () => {
    (supabase as any).from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          filter: vi.fn().mockReturnValue({
            filter: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useFeaturedRestaurants());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.featuredRestaurants).toHaveLength(0);
  });

  it("handles error gracefully", async () => {
    (supabase as any).from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          filter: vi.fn().mockReturnValue({
            filter: vi.fn().mockResolvedValue({ data: null, error: new Error("DB error") }),
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useFeaturedRestaurants());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.featuredRestaurants).toHaveLength(0);
  });

  it("isFeatured returns true for featured restaurant ids", async () => {
    const mockListings = [
      { id: "fl1", package_type: "premium", ends_at: "2026-05-01", restaurant_id: "r1" },
    ];
    const mockRestaurants = [
      { id: "r1", name: "Healthy Bites", description: "Fresh", logo_url: null, rating: "4.5", total_orders: 50 },
    ];
    const mockMeals = [
      { restaurant_id: "r1", id: "m1" },
    ];

    let callIndex = 0;
    (supabase as any).from = vi.fn().mockImplementation((table: string) => {
      callIndex++;
      if (table === "featured_listings") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              filter: vi.fn().mockReturnValue({
                filter: vi.fn().mockResolvedValue({ data: mockListings, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "restaurants") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: mockRestaurants, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "meals") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: mockMeals, error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const { result } = renderHook(() => useFeaturedRestaurants());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isFeatured("r1")).toBe(true);
    expect(result.current.isFeatured("r999")).toBe(false);
  });

  it("handles restaurant with zero meals (meal_count = 0)", async () => {
    const mockListings = [
      { id: "fl1", package_type: "premium", ends_at: "2026-05-01", restaurant_id: "r1" },
    ];
    const mockRestaurants = [
      { id: "r1", name: "New Restaurant", description: "Coming soon", logo_url: null, rating: "0", total_orders: 0 },
    ];

    let callIndex = 0;
    (supabase as any).from = vi.fn().mockImplementation((table: string) => {
      callIndex++;
      if (table === "featured_listings") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              filter: vi.fn().mockReturnValue({
                filter: vi.fn().mockResolvedValue({ data: mockListings, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "restaurants") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: mockRestaurants, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "meals") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const { result } = renderHook(() => useFeaturedRestaurants());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.featuredRestaurants).toHaveLength(1);
    expect(result.current.featuredRestaurants[0].meal_count).toBe(0);
  });
});