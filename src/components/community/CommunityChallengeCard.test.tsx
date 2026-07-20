import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CommunityChallengeCard } from "@/components/community/CommunityChallengeCard";

const state = vi.hoisted(() => ({ enabled: false, language: "en" as "en" | "ar" }));
const joinChallenge = vi.hoisted(() => vi.fn());
const useChallengeTeam = vi.hoisted(() => vi.fn(() => ({
  data: null,
  isLoading: false,
  createTeam: { isPending: false, mutateAsync: vi.fn() },
  joinTeam: { isPending: false, mutateAsync: vi.fn() },
  leaveTeam: { isPending: false, mutateAsync: vi.fn() },
})));

vi.mock("@/lib/phase-one-feature-flags", () => ({
  isPhaseOneFeatureEnabled: () => state.enabled,
}));

vi.mock("@/hooks/useChallengeTeam", () => ({ useChallengeTeam }));

vi.mock("@/hooks/useCommunityChallenges", () => ({
  useCommunityChallenges: () => ({
    loading: false,
    joiningId: null,
    joinChallenge,
    challenges: [{
      id: "team-challenge",
      title: "Team challenge",
      description: "Move together",
      challenge_type: "activity",
      difficulty_level: "easy",
      category: "community",
      target_value: 5,
      reward_points: 20,
      xp_reward: 20,
      wallet_reward_amount: 10,
      participation_mode: "team",
      team_size: 5,
      participant_count: 3,
      start_date: "2026-07-01",
      end_date: "2099-07-31",
      is_joined: false,
      user_progress: 0,
      user_rank: 0,
      is_test: true,
      test_leaderboard: [],
    }],
  }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: state.language,
    isRTL: state.language === "ar",
    t: (key: string) => ({
      community_join_challenge: state.language === "ar" ? "انضم إلى التحدي" : "Join challenge",
      community_days: state.language === "ar" ? "أيام" : "days",
      community_badge_active: state.language === "ar" ? "نشط" : "Active",
      community_joined: state.language === "ar" ? "منضم" : "joined",
      community_top_3: state.language === "ar" ? "أفضل 3" : "Top 3",
      community_be_first: state.language === "ar" ? "كن الأول" : "Be first",
    }[key] ?? key),
  }),
}));

describe("CommunityChallengeCard Agent 7 rollout", () => {
  beforeEach(() => {
    state.enabled = false;
    state.language = "en";
    joinChallenge.mockClear();
    useChallengeTeam.mockClear();
  });

  it("suppresses team queries and mutations while preserving the legacy join action", () => {
    render(<CommunityChallengeCard />);

    expect(useChallengeTeam).not.toHaveBeenCalled();
    expect(screen.queryByText("Compete as a team")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Join challenge" }));
    expect(joinChallenge).toHaveBeenCalledWith("team-challenge");
  });

  it("renders the localized RTL team surface only when enabled", () => {
    state.enabled = true;
    state.language = "ar";

    const { container } = render(<CommunityChallengeCard />);

    expect(useChallengeTeam).toHaveBeenCalledWith("team-challenge", false);
    expect(screen.getByText("تنافسوا كفريق")).toBeInTheDocument();
    expect(container.querySelector('[dir="rtl"]')).toBeInTheDocument();
  });
});
