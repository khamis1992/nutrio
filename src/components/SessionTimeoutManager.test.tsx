import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { SessionTimeoutManager, useSessionTimeoutControl } from "@/components/SessionTimeoutManager";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/capacitor", () => ({
  isNative: false,
}));

import { useAuth } from "@/contexts/AuthContext";

describe("SessionTimeoutManager", () => {
  it("renders children when no user", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null, session: null, loading: false, signUp: vi.fn(), signIn: vi.fn(), signOut: vi.fn(),
    });

    render(
      <SessionTimeoutManager>
        <div data-testid="child">Content</div>
      </SessionTimeoutManager>
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders children when user is present", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-1", email: "test@test.com" } as any,
      session: null,
      loading: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    render(
      <SessionTimeoutManager>
        <div data-testid="child">Content</div>
      </SessionTimeoutManager>
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("does not show warning dialog initially", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-1", email: "test@test.com" } as any,
      session: null,
      loading: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    render(
      <SessionTimeoutManager>
        <div data-testid="child">Content</div>
      </SessionTimeoutManager>
    );

    expect(screen.queryByText("Session Timeout Warning")).not.toBeInTheDocument();
  });
});

describe("useSessionTimeoutControl", () => {
  it("provides pauseTimeout and resumeTimeout", () => {
    const { result } = renderHook(() => useSessionTimeoutControl());
    expect(result.current.pauseTimeout).toBeInstanceOf(Function);
    expect(result.current.resumeTimeout).toBeInstanceOf(Function);
  });
});