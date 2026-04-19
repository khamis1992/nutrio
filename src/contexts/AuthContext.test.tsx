import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

vi.mock("@/lib/ipCheck", () => ({
  checkIPLocation: vi.fn().mockResolvedValue({ allowed: true, blocked: false }),
}));

vi.mock("@/components/ProtectedRoute", () => ({
  clearRoleCache: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false },
}));

import { supabase } from "@/integrations/supabase/client";
import { checkIPLocation } from "@/lib/ipCheck";
import { clearRoleCache } from "@/components/ProtectedRoute";

const createWrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach(k => delete store[k]); },
      get length() { return Object.keys(store).length; },
      key: (i: number) => Object.keys(store)[i] ?? null,
    });
    (supabase.auth.getSession as any).mockResolvedValue({ data: { session: null } });
    (supabase.auth.onAuthStateChange as any).mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    (supabase.auth.signUp as any).mockResolvedValue({ error: null });
    (supabase.auth.signInWithPassword as any).mockResolvedValue({ error: null });
    (supabase.auth.signOut as any).mockResolvedValue({ error: null });
  });

  it("starts with loading=true and resolves to null session", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
  });

  it("signUp calls supabase.auth.signUp with email redirect", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    const res = await act(async () => {
      return result.current.signUp("test@example.com", "password123", "Test User");
    });

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password123",
      options: {
        emailRedirectTo: expect.stringContaining("/dashboard"),
        data: { full_name: "Test User" },
      },
    });
    expect(res.error).toBeNull();
  });

  it("signUp returns error on failure", async () => {
    (supabase.auth.signUp as any).mockRejectedValue(new Error("Signup failed"));

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const res = await act(async () => {
      return result.current.signUp("test@example.com", "password123");
    });

    expect(res.error).toBeInstanceOf(Error);
    expect(res.error?.message).toBe("Signup failed");
  });

  it("signIn checks IP and signs in", async () => {
    (checkIPLocation as any).mockResolvedValue({ allowed: true, blocked: false });

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const res = await act(async () => {
      return result.current.signIn("test@example.com", "password123");
    });

    expect(checkIPLocation).toHaveBeenCalled();
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password123",
    });
    expect(res.error).toBeNull();
  });

  it("signIn blocks when IP is blocked", async () => {
    (checkIPLocation as any).mockResolvedValue({ allowed: false, blocked: true });

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const res = await act(async () => {
      return result.current.signIn("test@example.com", "password123");
    });

    expect(res.error).toBeInstanceOf(Error);
    expect(res.error?.message).toBe("Your IP address has been blocked.");
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("signIn proceeds when IP check fails (fail-open)", async () => {
    (checkIPLocation as any).mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const res = await act(async () => {
      return result.current.signIn("test@example.com", "password123");
    });

    expect(supabase.auth.signInWithPassword).toHaveBeenCalled();
    expect(res.error).toBeNull();
  });

  it("signOut clears role cache and calls supabase signOut", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signOut();
    });

    expect(clearRoleCache).toHaveBeenCalled();
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  it("sets user on auth state change", async () => {
    const mockUser = { id: "user-1", email: "test@example.com" };
    const mockSession = { access_token: "token", user: mockUser };

    (supabase.auth.onAuthStateChange as any).mockImplementation((callback: any) => {
      setTimeout(() => callback("SIGNED_IN", mockSession), 0);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper });

    await waitFor(() => {
      expect(result.current.user).not.toBeNull();
    });

    expect(result.current.user?.id).toBe("user-1");
  });

  it("throwing useAuth outside provider gives error", () => {
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow("useAuth must be used within an AuthProvider");
  });
});