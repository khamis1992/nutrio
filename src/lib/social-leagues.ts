export type SocialLeagueTier = "bronze" | "silver" | "gold" | "platinum" | "diamond";
export type SocialLeagueMovement = "new" | "same" | "promoted" | "demoted";

export interface SocialLeagueMember {
  user_id: string;
  name: string;
  avatar_url: string | null;
  level: number;
  score: number;
  rank: number;
  is_me: boolean;
}

export interface SocialLeagueData {
  season: { id: string; starts_on: string; ends_on: string };
  league: {
    tier: SocialLeagueTier;
    rank: number;
    score: number;
    movement: SocialLeagueMovement;
    member_count: number;
    promotion_rank: number;
    demotion_rank: number | null;
  };
  members: SocialLeagueMember[];
}

export const SOCIAL_LEAGUE_TIERS: Record<SocialLeagueTier, {
  label: string;
  color: string;
  softColor: string;
}> = {
  bronze: { label: "Bronze", color: "#FB6B7A", softColor: "#FFF0F2" },
  silver: { label: "Silver", color: "#94A3B8", softColor: "#F1F5F9" },
  gold: { label: "Gold", color: "#F59E0B", softColor: "#FFF7E8" },
  platinum: { label: "Platinum", color: "#38BDF8", softColor: "#EEF9FF" },
  diamond: { label: "Diamond", color: "#7C83F6", softColor: "#F2F3FF" },
};

export function getLeagueDaysRemaining(endsOn: string, now = new Date()) {
  const end = new Date(`${endsOn}T23:59:59`);
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000));
}

export function getLeagueZone(
  rank: number,
  promotionRank: number,
  demotionRank: number | null,
) {
  if (rank <= promotionRank) return "promotion" as const;
  if (demotionRank !== null && rank >= demotionRank) return "demotion" as const;
  return "safe" as const;
}
