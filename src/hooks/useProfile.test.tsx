import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useProfile } from "@/hooks/useProfile";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const createWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

const mockProfileData = {
  id: "p1",
  user_id: "user-1",
  full_name: "Test User",
  avatar_url: null,
  gender: "male",
  age: 30,
  height_cm: 175,
  current_weight_kg: 80,
  target_weight_kg: 75,
  health_goal: "lose",
  activity_level: "moderate",
  daily_calorie_target: 2000,
  protein_target_g: 150,
  carbs_target_g: 200,
  fat_target_g: 65,
  onboarding_completed: true,
  referral_code: null,
  referral_rewards_earned: null,
  referred_by: null,
  affiliate_balance: null,
  total_affiliate_earnings: null,
  affiliate_tier: null,
  streak_days: 5,
  created_at: "2026-01-01",
  updated_at: "2026-04-15",
};

describe("useProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null profile when user is null", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null, session: null, loading: false, signUp: vi.fn(), signIn: vi.fn(), signOut: vi.fn(),
    });

    const { result } = renderHook(() => useProfile(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.profile).toBeNull();
  });

  it("fetches and returns profile data", async () => {
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
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: mockProfileData, error: null }),
        }),
      }),
    });

    const { result } = renderHook(() => useProfile(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.profile).toEqual(mockProfileData);
  });

  it("returns error when fetch fails", async () => {
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
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: new Error("Network error") }),
        }),
      }),
    });

    const { result } = renderHook(() => useProfile(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.error).toBeTruthy());
  });

  it("exposes updateProfile function", async () => {
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
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: mockProfileData, error: null }),
        }),
      }),
    });

    const { result } = renderHook(() => useProfile(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(typeof result.current.updateProfile).toBe("function");
  });
});