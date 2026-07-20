import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Rewards from "@/pages/Rewards";

const state = vi.hoisted(() => ({ enabled: false }));
const adherenceRender = vi.hoisted(() => vi.fn());

vi.mock("@/lib/phase-one-feature-flags", () => ({
  isPhaseOneFeatureEnabled: () => state.enabled,
}));
vi.mock("@/components/rewards/AdherenceStrengthCard", () => ({
  AdherenceStrengthCard: () => {
    adherenceRender();
    return <div>adherence-surface</div>;
  },
}));
vi.mock("@/components/rewards/AchievementsProgressCard", () => ({ AchievementsProgressCard: () => <div /> }));
vi.mock("@/components/rewards/EarnActionsImageCard", () => ({ EarnActionsImageCard: () => <div /> }));
vi.mock("@/components/rewards/RewardsTabBar", () => ({ RewardsTabBar: () => <div /> }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: "ar", isRTL: true, t: (key: string) => key }),
}));
vi.mock("@/hooks/useBadges", () => ({
  useBadges: () => ({ badges: [], loading: false, unlockedCount: 0, totalCount: 0 }),
}));
vi.mock("@/hooks/useProfile", () => ({ useProfile: () => ({ profile: { xp: 0, level: 1 } }) }));
vi.mock("@/hooks/useWallet", () => ({ useWallet: () => ({ wallet: { balance: 0 } }) }));
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => vi.fn() };
});

describe("Rewards Agent 7 rollout", () => {
  beforeEach(() => {
    state.enabled = false;
    adherenceRender.mockClear();
  });

  it("renders Arabic RTL reward copy without mounting adherence while default-off", () => {
    const { container } = render(<Rewards />);

    expect(screen.getByRole("heading", { name: "مركز المكافآت" })).toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute("dir", "rtl");
    expect(adherenceRender).not.toHaveBeenCalled();
    expect(screen.queryByText("adherence-surface")).not.toBeInTheDocument();
  });

  it("mounts adherence only after the cooperative flag is enabled", () => {
    state.enabled = true;
    render(<Rewards />);

    expect(screen.getByText("adherence-surface")).toBeInTheDocument();
    expect(adherenceRender).toHaveBeenCalled();
  });
});
