export type ChallengeTeamMember = {
  user_id: string;
  name: string;
  avatar_url: string | null;
  role: "captain" | "member";
  progress: number;
};

export type ChallengeTeamStanding = {
  team_id: string;
  name: string;
  member_count: number;
  progress_percent: number;
  total_progress: number;
  rank: number;
};

export type MyChallengeTeam = {
  id: string;
  name: string;
  join_code: string;
  captain_id: string;
  member_count: number;
  total_progress: number;
  progress_percent: number;
  rank: number;
  role: "captain" | "member";
};

export type ChallengeTeamState = {
  team: MyChallengeTeam | null;
  members: ChallengeTeamMember[];
  leaderboard: ChallengeTeamStanding[];
  team_size: number;
};

export function normalizeTeamCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}
