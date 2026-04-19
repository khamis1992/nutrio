import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BehaviorPredictionWidget } from "@/components/BehaviorPredictionWidget";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

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
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "token" } } }) },
    realtime: { setAuth: vi.fn() },
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

describe("BehaviorPredictionWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it("returns null when user is null", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null, session: null, loading: false, signUp: vi.fn(), signIn: vi.fn(), signOut: vi.fn(),
    });

    const { container } = render(<BehaviorPredictionWidget />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when dismissed recently", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-1", email: "test@example.com" },
      session: null,
      loading: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    localStorage.setItem("behavior_prediction_dismissed_user-1", new Date().toISOString());

    (supabase as any).from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
    });

    const { container } = render(<BehaviorPredictionWidget />);
    expect(container.hasChildNodes()).toBe(false);
  });

  it("renders prediction card for high churn risk", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-1", email: "test@example.com" },
      session: null,
      loading: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    const mockPrediction = {
      id: "pred-1",
      churn_risk_score: 0.8,
      boredom_risk_score: 0.3,
      engagement_score: 35,
      recommended_action: "personal_outreach",
      created_at: new Date().toISOString(),
    };

    (supabase as any).from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockPrediction, error: null }),
            }),
          }),
        }),
      }),
    });

    render(<BehaviorPredictionWidget />);

    await screen.findByText("AI Insight");
    expect(screen.getByText("35% engagement")).toBeInTheDocument();
  });

  it("dismisses prediction on click", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-1", email: "test@example.com" },
      session: null,
      loading: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    const mockPrediction = {
      id: "pred-1",
      churn_risk_score: 0.8,
      boredom_risk_score: 0.3,
      engagement_score: 35,
      recommended_action: "bonus_credit",
      created_at: new Date().toISOString(),
    };

    (supabase as any).from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockPrediction, error: null }),
            }),
          }),
        }),
      }),
    });

    render(<BehaviorPredictionWidget />);
    await screen.findByText("AI Insight");

    const dismissBtn = screen.getByRole("button", { name: "" });
    fireEvent.click(dismissBtn);

    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it("does not show for low-risk predictions", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-1", email: "test@example.com" },
      session: null,
      loading: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    const lowRiskPrediction = {
      id: "pred-low",
      churn_risk_score: 0.2,
      boredom_risk_score: 0.1,
      engagement_score: 80,
      recommended_action: "cuisine_exploration",
      created_at: new Date().toISOString(),
    };

    (supabase as any).from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: lowRiskPrediction, error: null }),
            }),
          }),
        }),
      }),
    });

    const { container } = render(<BehaviorPredictionWidget />);
    await new Promise(r => setTimeout(r, 100));
    expect(container.querySelector("[class*='Card']")).toBeNull();
  });

  it("shows churn risk indicator for high churn", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-1", email: "test@example.com" },
      session: null,
      loading: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    const highChurnPred = {
      id: "pred-churn",
      churn_risk_score: 0.75,
      boredom_risk_score: 0.2,
      engagement_score: 30,
      recommended_action: "personal_outreach",
      created_at: new Date().toISOString(),
    };

    (supabase as any).from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: highChurnPred, error: null }),
            }),
          }),
        }),
      }),
    });

    render(<BehaviorPredictionWidget />);
    await screen.findByText("AI Insight");
    expect(screen.getByText(/Churn risk/i)).toBeInTheDocument();
  });

  it("shows fallback for unknown action type", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-1", email: "test@example.com" },
      session: null,
      loading: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    const unknownActionPred = {
      id: "pred-unknown",
      churn_risk_score: 0.7,
      boredom_risk_score: 0.2,
      engagement_score: 35,
      recommended_action: "unknown_action_type",
      created_at: new Date().toISOString(),
    };

    (supabase as any).from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: unknownActionPred, error: null }),
            }),
          }),
        }),
      }),
    });

    render(<BehaviorPredictionWidget />);
    await screen.findByText("AI Insight");
    expect(screen.getByText("AI Recommendation")).toBeInTheDocument();
  });

  it("renders all 6 known action types", async () => {
    const actions = [
      { action: "personal_outreach", title: "We Miss You!" },
      { action: "bonus_credit", title: "Special Bonus for You" },
      { action: "cuisine_exploration", title: "Try Something New" },
      { action: "plan_regeneration", title: "Refresh Your Meal Plan" },
      { action: "gamification", title: "Challenge Yourself" },
      { action: "flexible_scheduling", title: "Scheduling Tip" },
    ];

    for (const { action, title } of actions) {
      vi.clearAllMocks();
      vi.mocked(useAuth).mockReturnValue({
        user: { id: "user-1", email: "test@example.com" },
        session: null,
        loading: false,
        signUp: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      });

      const pred = {
        id: `pred-${action}`,
        churn_risk_score: 0.7,
        boredom_risk_score: 0.3,
        engagement_score: 30,
        recommended_action: action,
        created_at: new Date().toISOString(),
      };

      (supabase as any).from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: pred, error: null }),
              }),
            }),
          }),
        }),
      });

      render(<BehaviorPredictionWidget />);
      await screen.findByText(title);
      screen.getByText(title);
    }
  });
});