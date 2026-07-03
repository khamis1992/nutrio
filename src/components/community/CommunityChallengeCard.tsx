import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Flame,
  Gift,
  Loader2,
  Trophy,
  Users,
} from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { useCommunityChallenges } from "@/hooks/useCommunityChallenges";
import { supabase } from "@/integrations/supabase/client";
import { fadeInUp } from "@/lib/animations";

interface LeaderboardEntry {
  user_name: string;
  avatar_url: string | null;
  current_progress: number;
  rank: number;
}

export function CommunityChallengeCard() {
  const { t } = useLanguage();
  const { challenges, loading, joiningId, joinChallenge } =
    useCommunityChallenges();
  const [leaderboards, setLeaderboards] = useState<
    Record<string, LeaderboardEntry[]>
  >({});
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0 });
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const missingLeaderboards = challenges.filter(
      (challenge) => !challenge.is_test && !leaderboards[challenge.id],
    );

    if (missingLeaderboards.length === 0) return;

    void (async () => {
      const entries = await Promise.all(
        missingLeaderboards.map(async (challenge) => {
          const { data } = await supabase
            .from("challenge_leaderboard")
            .select("user_name, avatar_url, current_progress, rank")
            .eq("challenge_id", challenge.id)
            .order("rank", { ascending: true })
            .limit(3);

          return [challenge.id, (data ?? []) as LeaderboardEntry[]] as const;
        }),
      );

      setLeaderboards((current) => ({
        ...current,
        ...Object.fromEntries(entries),
      }));
    })();
  }, [challenges, leaderboards]);

  const calcCountdown = useCallback(() => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const diff = nextMonth.getTime() - now.getTime();

    setCountdown({
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
    });
  }, []);

  useEffect(() => {
    calcCountdown();
    const intervalId = setInterval(calcCountdown, 60000);
    return () => clearInterval(intervalId);
  }, [calcCountdown]);

  useEffect(() => {
    if (activeIndex > Math.max(0, challenges.length - 1)) {
      setActiveIndex(0);
    }
  }, [activeIndex, challenges.length]);

  if (loading) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-2xl bg-slate-50">
        <Loader2 className="h-7 w-7 animate-spin text-slate-700" />
      </div>
    );
  }

  if (challenges.length === 0) {
    return (
      <motion.div variants={fadeInUp}>
        <div className="relative overflow-hidden rounded-[28px] border border-[#E5EAF1] bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,0.06)]">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-[#EAF8FF] px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#38BDF8]">
            <Trophy className="h-3.5 w-3.5" />
            {t("community_coming_soon")}
          </div>

          <h3 className="mb-2 text-[24px] font-black leading-[1.15] text-[#020617]">
            {t("community_new_challenges_brewing")}
          </h3>
          <p className="mb-5 max-w-[280px] text-[14px] font-semibold leading-relaxed text-[#64748B]">
            {t("community_challenges_description")}
          </p>

          <div className="flex items-center gap-4 border-t border-[#E5EAF1] pt-4">
            <div className="flex items-center gap-3">
              {[
                { val: countdown.days, label: t("community_days") },
                { val: countdown.hours, label: t("community_hours") },
                { val: countdown.minutes, label: t("community_minutes") },
              ].map((unit) => (
                <div key={unit.label} className="text-center">
                  <div className="text-[20px] font-black text-[#020617] tabular-nums">
                    {String(unit.val).padStart(2, "0")}
                  </div>
                  <div className="mt-0.5 text-[9px] font-bold uppercase text-[#94A3B8]">
                    {unit.label}
                  </div>
                </div>
              ))}
            </div>
            <div className="h-8 w-px bg-[#E5EAF1]" />
            <p className="text-[11px] font-semibold text-[#64748B]">
              {t("community_until_next_drop")}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  const challenge = challenges[activeIndex] ?? challenges[0];
  const leaderboard =
    challenge.test_leaderboard ?? leaderboards[challenge.id] ?? [];
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(challenge.end_date).getTime() - Date.now()) / 86400000),
  );
  const progressPct =
    challenge.target_value > 0
      ? Math.min(
          100,
          Math.round((challenge.user_progress / challenge.target_value) * 100),
        )
      : 0;
  const isCompleted =
    challenge.user_progress >= challenge.target_value &&
    challenge.target_value > 0;
  const ChallengeIcon = challenge.challenge_type === "streak" ? Flame : Trophy;
  const canSwitchChallenges = challenges.length > 1;
  const showPreviousChallenge = () => {
    setActiveIndex((current) =>
      current === 0 ? challenges.length - 1 : current - 1,
    );
  };
  const showNextChallenge = () => {
    setActiveIndex((current) =>
      current === challenges.length - 1 ? 0 : current + 1,
    );
  };
  const joinLabel =
    joiningId === challenge.id ? (
      <Loader2 className="h-4 w-4 animate-spin" />
    ) : isCompleted ? (
      t("community_completed")
    ) : challenge.is_joined ? (
      t("community_joined_status", { pct: progressPct })
    ) : (
      t("community_join_challenge")
    );

  return (
    <motion.div variants={fadeInUp}>
      <div className="space-y-3">
        {canSwitchChallenges && (
          <div className="flex items-center justify-between rounded-[26px] bg-white p-1.5 shadow-[0_12px_28px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
            <button
              type="button"
              onClick={showPreviousChallenge}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F6F8FB] text-[#020617] ring-1 ring-[#E5EAF1] transition active:scale-95"
              aria-label="Previous challenge"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1 px-3 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                Active challenge
              </p>
              <p className="mt-0.5 text-[13px] font-black text-[#020617]">
                {activeIndex + 1} of {challenges.length}
              </p>
            </div>
            <button
              type="button"
              onClick={showNextChallenge}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F6F8FB] text-[#020617] ring-1 ring-[#E5EAF1] transition active:scale-95"
              aria-label="Next challenge"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        <motion.div
          key={challenge.id}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="relative overflow-hidden rounded-[32px] bg-white p-4 text-[#020617] shadow-[0_18px_42px_rgba(15,23,42,0.07)] ring-1 ring-[#E5EAF1]"
        >
          <div className="rounded-[26px] bg-[#F6F8FB] p-4 ring-1 ring-[#E5EAF1]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className={`inline-flex h-7 items-center rounded-full px-3 text-[11px] font-extrabold ${
                      isCompleted
                        ? "bg-[#DDFBF2] text-[#16A37F]"
                        : "bg-white text-[#FB6B7A] ring-1 ring-[#FFE1E6]"
                    }`}
                  >
                    {isCompleted
                      ? t("community_badge_completed")
                      : t("community_badge_active")}
                  </span>
                  {canSwitchChallenges && (
                    <span className="text-[11px] font-black text-[#94A3B8]">
                      {activeIndex + 1}/{challenges.length}
                    </span>
                  )}
                </div>

                <h3 className="text-[25px] font-black leading-[1.04] text-[#020617]">
                  {challenge.title}
                </h3>
                <p className="mt-2 text-[13px] font-semibold leading-5 text-[#64748B]">
                  {challenge.description}
                </p>
              </div>

              <div className="relative flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-[26px] bg-white shadow-sm ring-1 ring-[#E5EAF1]">
                <svg
                  viewBox="0 0 44 44"
                  className="h-[58px] w-[58px] -rotate-90"
                >
                  <circle
                    cx="22"
                    cy="22"
                    r="18"
                    fill="none"
                    stroke="#E5EAF1"
                    strokeWidth="5"
                  />
                  <circle
                    cx="22"
                    cy="22"
                    r="18"
                    fill="none"
                    stroke="#22C7A1"
                    strokeLinecap="round"
                    strokeWidth="5"
                    strokeDasharray={`${Math.max(progressPct, 2) * 1.13} 113`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[16px] font-black leading-none text-[#020617]">
                    {progressPct}%
                  </span>
                  <span className="mt-0.5 text-[8px] font-black uppercase text-[#94A3B8]">
                    Done
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-[22px] bg-white px-3 py-3 ring-1 ring-[#E5EAF1]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[17px] bg-[#F6F8FB]">
                  <ChallengeIcon
                    className={`h-5 w-5 ${challenge.challenge_type === "streak" ? "text-[#FB6B7A]" : "text-[#7C83F6]"}`}
                    strokeWidth={2.5}
                  />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                    Target
                  </p>
                  <p className="text-[13px] font-black text-[#020617]">
                    {challenge.user_progress}/{challenge.target_value}
                  </p>
                </div>
              </div>
              <div className="h-8 w-px bg-[#E5EAF1]" />
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                  Time left
                </p>
                <p className="text-[13px] font-black text-[#020617]">
                  {daysLeft} {t("community_days")}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="flex items-center gap-3 rounded-[20px] bg-white px-3 py-3 ring-1 ring-[#E5EAF1]">
              <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-[#F4F3FF]">
                <Users className="h-4 w-4 text-[#7C83F6]" />
              </div>
              <div>
                <div className="text-[18px] font-black leading-none">
                  {challenge.participant_count}
                </div>
                <div className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#94A3B8]">
                  {t("community_joined")}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-[20px] bg-white px-3 py-3 ring-1 ring-[#E5EAF1]">
              <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-[#ECFEFF]">
                <CalendarDays className="h-4 w-4 text-[#38BDF8]" />
              </div>
              <div>
                <div className="text-[18px] font-black leading-none">
                  {daysLeft}
                </div>
                <div className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#94A3B8]">
                  {t("community_days")}
                </div>
              </div>
            </div>
          </div>

          {((challenge.xp_reward ?? 0) > 0 ||
            (challenge.wallet_reward_amount ?? 0) > 0) && (
            <div className="mt-3 flex items-center gap-3 rounded-[22px] bg-[#ECFDF8] px-4 py-3 ring-1 ring-[#BDF4E4]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-white text-[#22C7A1]">
                <Gift className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#94A3B8]">
                  Reward
                </p>
                <p className="truncate text-[12px] font-black text-[#020617]">
                  {(challenge.xp_reward ?? 0) > 0 &&
                    `${challenge.xp_reward} XP`}
                  {(challenge.xp_reward ?? 0) > 0 &&
                    (challenge.wallet_reward_amount ?? 0) > 0 &&
                    " + "}
                  {(challenge.wallet_reward_amount ?? 0) > 0 &&
                    `QAR ${challenge.wallet_reward_amount} wallet credit`}
                </p>
              </div>
            </div>
          )}

          <div className="relative mt-3 rounded-[24px] bg-white p-4 ring-1 ring-[#E5EAF1]">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#64748B]">
                {t("community_top_3")}
              </p>
              {challenge.user_rank > 0 && (
                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-[#020617] ring-1 ring-[#E5EAF1]">
                  #{challenge.user_rank}
                </span>
              )}
            </div>

            {leaderboard.length > 0 ? (
              <div className="flex items-center gap-3">
                <div className="flex items-end gap-1">
                  {leaderboard.map((entry) => (
                    <div key={entry.rank} className="relative">
                      {entry.avatar_url ? (
                        <img
                          src={entry.avatar_url}
                          alt=""
                          className="h-9 w-9 rounded-full border-2 border-white object-cover shadow-sm"
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-white shadow-sm">
                          <span className="text-[10px] font-black text-[#94A3B8]">
                            {(entry.user_name ?? "?")[0]}
                          </span>
                        </div>
                      )}
                      <div
                        className={`absolute -bottom-1.5 left-1/2 flex h-4 min-w-4 -translate-x-1/2 items-center justify-center rounded-full px-1 text-[9px] font-black text-white ${
                          entry.rank === 1
                            ? "bg-[#22C7A1]"
                            : entry.rank === 2
                              ? "bg-[#7C83F6]"
                              : "bg-[#FB6B7A]"
                        }`}
                      >
                        {entry.rank}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="h-10 w-px bg-[#E5EAF1]" />
                <div className="min-w-0 flex-1 space-y-1">
                  {leaderboard.map((entry) => (
                    <div
                      key={entry.rank}
                      className="flex items-center justify-between gap-2 text-[11px]"
                    >
                      <span className="truncate font-bold text-[#64748B]">
                        {entry.user_name ?? t("community_player")}
                      </span>
                      <span className="font-black text-[#020617]">
                        {entry.current_progress}/{challenge.target_value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="py-2 text-center text-[12px] font-semibold text-[#94A3B8]">
                {t("community_be_first")}
              </p>
            )}

            {challenge.is_joined && (
              <div className="mt-3">
                <div className="mb-1.5 flex items-center justify-between text-[10px]">
                  <span className="font-bold text-[#94A3B8]">
                    {t("community_your_progress")}
                  </span>
                  <span className="font-black text-[#020617]">
                    {challenge.user_progress}/{challenge.target_value}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-[#22C7A1] transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="relative mt-4">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => joinChallenge(challenge.id)}
              disabled={joiningId === challenge.id || isCompleted}
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[#020617] px-4 text-sm font-extrabold text-white shadow-[0_12px_24px_rgba(2,6,23,0.18)] transition-colors hover:bg-[#111827] disabled:opacity-50"
            >
              {joinLabel}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
