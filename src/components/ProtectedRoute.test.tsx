import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ProtectedRoute, clearRoleCache, hasRequiredRole, useUserRoles, useHasRole } from "@/components/ProtectedRoute";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

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

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

function mockRoleSources(roles: string[] = []) {
  (supabase as any).from = vi.fn().mockImplementation((table: string) => {
    const result = {
      data: table === "user_roles" ? roles.map((role) => ({ role })) : null,
      error: null,
    };
    const builder: any = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
      then: (resolve: (value: typeof result) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject),
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.maybeSingle.mockResolvedValue(result);
    return builder;
  });
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRoleCache();
  });

  describe("hasRequiredRole", () => {
    it("returns true when user has the exact required role", () => {
      expect(hasRequiredRole(["customer"], "customer")).toBe(true);
    });

    it("returns true when user has a higher-role position", () => {
      expect(hasRequiredRole(["admin"], "customer")).toBe(true);
    });

    it("returns false when user lacks the required role", () => {
      expect(hasRequiredRole(["customer"], "admin")).toBe(false);
    });

    it("returns true when any role in array matches", () => {
      expect(hasRequiredRole(["customer"], ["admin", "customer"])).toBe(true);
    });

    it("returns true for partner accessing restaurant route", () => {
      expect(hasRequiredRole(["partner"], "restaurant")).toBe(true);
    });

    it("does not treat unrelated portal roles as equivalent", () => {
      expect(hasRequiredRole(["fleet_manager"], "driver")).toBe(false);
      expect(hasRequiredRole(["coach"], "partner")).toBe(false);
    });

    it("returns false when roles array is empty", () => {
      expect(hasRequiredRole([], "customer")).toBe(false);
    });
  });

  describe("clearRoleCache", () => {
    it("clears the role cache without error", () => {
      clearRoleCache();
      expect(true).toBe(true);
    });
  });

  describe("component rendering", () => {
    it("redirects to /auth when user is null", async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null, session: null, loading: false, signUp: vi.fn(), signIn: vi.fn(), signOut: vi.fn(),
      });

      renderWithRouter(
        <ProtectedRoute requiredRole="customer">
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });

    it("renders children when user has required role", async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: "user-1", email: "test@test.com" } as any,
        session: null,
        loading: false,
        signUp: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      });

      mockRoleSources(["customer"]);

      renderWithRouter(
        <ProtectedRoute requiredRole="customer">
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      await waitFor(() => {
        expect(screen.getByText("Protected Content")).toBeInTheDocument();
      });
    });

    it("renders children when no required role and authenticated", async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: "user-1", email: "test@test.com" } as any,
        session: null,
        loading: false,
        signUp: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      });

      mockRoleSources();

      renderWithRouter(
        <ProtectedRoute>
          <div>Public Content</div>
        </ProtectedRoute>
      );

      await waitFor(() => {
        expect(screen.getByText("Public Content")).toBeInTheDocument();
      });
    });
  });

  describe("useUserRoles", () => {
    it("returns empty roles when user is null", async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null, session: null, loading: false, signUp: vi.fn(), signIn: vi.fn(), signOut: vi.fn(),
      });

      const { result } = renderHook(() => useUserRoles());

      await waitFor(() => {
        expect(result.current.roles).toEqual([]);
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe("useHasRole", () => {
    it("returns hasRole false and loading true initially", () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: "user-1", email: "test@test.com" } as any,
        session: null,
        loading: false,
        signUp: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      });

      mockRoleSources();

      const { result } = renderHook(() => useHasRole("admin"));

      expect(result.current.loading).toBe(true);
      expect(result.current.hasRole).toBe(false);
    });
  });
});
