import { motion } from "framer-motion";
import {
  Clock3,
  Crown,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from "lucide-react";

import { useSocialLeague } from "@/hooks/useSocialLeague";
import {
  getLeagueDaysRemaining,
  getLeagueZone,
  SOCIAL_LEAGUE_TIERS,
  type SocialLeagueMember,
} from "@/lib/social-leagues";

interface SocialLeaguePanelProps {
  userId: string | undefined;
  active: boolean;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function zonePresentation(zone: ReturnType<typeof getLeagueZone>) {
  if (zone === "promotion") {
    return { label: "Promotion zone", Icon: TrendingUp, color: "#22C7A1", soft: "#EFFFFA" };
  }
  if (zone === "demotion") {
    return { label: "Demotion zone", Icon: TrendingDown, color: "#FB6B7A", soft: "#FFF0F2" };
  }
  return { label: "Safe zone", Icon: ShieldCheck, color: "#38BDF8", soft: "#EEF9FF" };
}

function LeagueMemberRow({
  member,
  promotionRank,
  demotionRank,
  index,
}: {
  member: SocialLeagueMember;
  promotionRank: number;
  demotionRank: number | null;
  index: number;
}) {
  const zone = getLeagueZone(member.rank, promotionRank, demotionRank);
  const presentation = zonePresentation(zone);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.035, 0.35) }}
      className={`flex min-h-[72px] items-center gap-3 rounded-[20px] bg-white p-3 shadow-[0_6px_20px_rgba(2,6,23,0.04)] ring-1 ${
        member.is_me ? "ring-[#7C83F6]/40" : "ring-[#E5EAF1]"
      }`}
    >
      <div className="flex w-7 shrink-0 justify-center">
        {member.rank <= 3 ? (
          <Trophy className="h-4 w-4" style={{ color: presentation.color }} strokeWidth={2.4} />
        ) : (
          <span className="text-[12px] font-black text-[#94A3B8]">{member.rank}</span>
        )}
      </div>

      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F6F8FB] text-[13px] font-black text-[#020617] ring-1 ring-[#E5EAF1]">
        {member.avatar_url ? (
          <img src={member.avatar_url} alt="" className="h-full w-full object-cover" />
        ) : (
          initials(member.name)
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[14px] font-black text-[#020617]">{member.name}</p>
          {member.is_me && (
            <span className="shrink-0 rounded-full bg-[#F2F3FF] px-2 py-0.5 text-[9px] font-black uppercase text-[#7C83F6]">
              You
            </span>
          )}
        </div>
        <p className="mt-1 text-[11px] font-bold text-[#94A3B8]">Level {member.level}</p>
      </div>

      <div className="shrink-0 text-right">
        <p className="inline-flex items-center gap-1 text-[16px] font-black text-[#020617]">
          <Zap className="h-3.5 w-3.5 text-[#7C83F6]" fill="currentColor" />
          {member.score.toLocaleString()}
        </p>
        <p className="mt-0.5 text-[9px] font-black uppercase" style={{ color: presentation.color }}>
          {presentation.label.replace(" zone", "")}
        </p>
      </div>
    </motion.div>
  );
}

export default function SocialLeaguePanel({ userId, active }: SocialLeaguePanelProps) {
  const { data, isLoading, isError, refetch, isFetching } = useSocialLeague(userId, active);

  if (isLoading) {
    return (
      <div className="space-y-3" aria-label="Loading weekly league">
        <div className="h-44 animate-pulse rounded-[24px] bg-white ring-1 ring-[#E5EAF1]" />
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-[72px] animate-pulse rounded-[20px] bg-white ring-1 ring-[#E5EAF1]" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-[24px] bg-white px-5 py-10 text-center ring-1 ring-[#E5EAF1]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF0F2] text-[#FB6B7A]">
          <Users className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-[17px] font-black text-[#020617]">League unavailable</h2>
        <p className="mx-auto mt-2 max-w-[260px] text-[12px] font-semibold leading-5 text-[#64748B]">
          We could not load this week's group. Your XP is safe and will appear after retrying.
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mx-auto mt-5 flex h-11 items-center gap-2 rounded-full bg-[#020617] px-5 text-[12px] font-black text-white active:scale-95"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Try again
        </button>
      </div>
    );
  }

  const tier = SOCIAL_LEAGUE_TIERS[data.league.tier];
  const daysRemaining = getLeagueDaysRemaining(data.season.ends_on);
  const myZone = getLeagueZone(
    data.league.rank,
    data.league.promotion_rank,
    data.league.demotion_rank,
  );
  const zone = zonePresentation(myZone);
  const ZoneIcon = zone.Icon;
  const movementCopy = data.league.movement === "promoted"
    ? "Promoted from last week"
    : data.league.movement === "demoted"
      ? "A fresh chance to climb"
      : data.league.movement === "same"
        ? "Holding your league"
        : "Your first league week";

  return (
    <div className="space-y-4">
      <section
        className="overflow-hidden rounded-[24px] bg-white p-4 shadow-[0_8px_24px_rgba(2,6,23,0.05)] ring-1 ring-[#E5EAF1]"
        aria-label={`${tier.label} weekly league`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px]"
              style={{ backgroundColor: tier.softColor, color: tier.color }}
            >
              <Crown className="h-6 w-6" strokeWidth={2.3} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: tier.color }}>
                Weekly league
              </p>
              <h2 className="truncate text-[20px] font-black text-[#020617]">{tier.label} League</h2>
              <p className="mt-0.5 text-[11px] font-semibold text-[#64748B]">{movementCopy}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1 rounded-full bg-[#F6F8FB] px-3 py-2 text-[#64748B]">
            <Clock3 className="h-3.5 w-3.5" />
            <span className="text-[10px] font-black">{daysRemaining}d</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 divide-x divide-[#E5EAF1] rounded-[18px] bg-[#F6F8FB] px-2 py-3">
          <div className="px-3">
            <p className="text-[9px] font-black uppercase text-[#94A3B8]">Your rank</p>
            <p className="mt-1 text-[25px] font-black text-[#020617]">#{data.league.rank}</p>
          </div>
          <div className="px-4">
            <p className="text-[9px] font-black uppercase text-[#94A3B8]">Weekly XP</p>
            <p className="mt-1 text-[25px] font-black text-[#020617]">{data.league.score.toLocaleString()}</p>
          </div>
        </div>

        <div className="mt-3 flex min-h-11 items-center gap-3 rounded-[16px] px-3" style={{ backgroundColor: zone.soft }}>
          <ZoneIcon className="h-4 w-4 shrink-0" style={{ color: zone.color }} />
          <p className="text-[11px] font-black" style={{ color: zone.color }}>{zone.label}</p>
          <p className="ml-auto text-[10px] font-bold text-[#64748B]">
            {data.league.promotion_rank > 0
              ? `Top ${data.league.promotion_rank} move up`
              : `${Math.max(10 - data.league.member_count, 0)} more to unlock promotion`}
          </p>
        </div>
      </section>

      <div className="flex items-end justify-between px-1">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#7C83F6]">Standings</p>
          <h3 className="mt-0.5 text-[17px] font-black text-[#020617]">This week's group</h3>
        </div>
        <p className="text-[11px] font-bold text-[#94A3B8]">{data.league.member_count}/30</p>
      </div>

      <div className="space-y-2">
        {data.members.map((member, index) => (
          <LeagueMemberRow
            key={member.user_id}
            member={member}
            promotionRank={data.league.promotion_rank}
            demotionRank={data.league.demotion_rank}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}
