import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { CalendarDays, ChevronRight, Loader2, Users } from "lucide-react";
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
  const { challenges, loading, joiningId, joinChallenge } = useCommunityChallenges();
  const [activeIndex, setActiveIndex] = useState(0);
  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardEntry[]>>({});

  const challenge = challenges[activeIndex];

  useEffect(() => {
    if (!challenge?.id || leaderboards[challenge.id]) return;
    const fetchLeaderboard = async () => {
      const { data } = await supabase
        .from("challenge_leaderboard")
        .select("user_name, avatar_url, current_progress, rank")
        .eq("challenge_id", challenge.id)
        .order("rank", { ascending: true })
        .limit(3);
      if (data) {
        setLeaderboards((prev) => ({ ...prev, [challenge.id]: data as LeaderboardEntry[] }));
      }
    };
    void fetchLeaderboard();
  }, [challenge?.id]);

  const nextChallenge = () => {
    setActiveIndex((prev) => (prev === challenges.length - 1 ? 0 : prev + 1));
  };

  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0 });

  const calcCountdown = useCallback(() => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const diff = next.getTime() - now.getTime();
    setCountdown({
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    });
  }, []);

  useEffect(() => {
    calcCountdown();
    const id = setInterval(calcCountdown, 60000);
    return () => clearInterval(id);
  }, [calcCountdown]);

  if (loading) {
    return (
      <div className="flex h-[306px] items-center justify-center rounded-[28px] bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (challenges.length === 0) {
    return (
      <motion.div variants={fadeInUp}>
        <div className="relative overflow-hidden rounded-[28px] border border-emerald-200 bg-[radial-gradient(140%_100%_at_45%_0%,rgba(43,213,177,0.28),transparent_50%),radial-gradient(100%_100%_at_100%_100%,rgba(16,185,129,0.12),transparent_45%),linear-gradient(160deg,#F0FDF6_0%,#ECFDF5_40%,#F0FDF4_100%)] p-6 shadow-[0_14px_28px_rgba(0,113,98,0.12)]">
          <div className="absolute pointer-events-none right-6 top-6 opacity-20">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
              <circle cx="40" cy="40" r="38" stroke="#059669" strokeWidth="1.5" strokeDasharray="6 4" />
              <circle cx="40" cy="40" r="28" stroke="#10B981" strokeWidth="1" strokeDasharray="4 3" className="motion-safe:animate-spin" style={{ animationDuration: "20s" }} />
              <circle cx="40" cy="40" r="18" stroke="#34D399" strokeWidth="1" strokeDasharray="3 2" className="motion-safe:animate-spin" style={{ animationDuration: "14s", animationDirection: "reverse" }} />
            </svg>
          </div>

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2 shadow-[0_4px_14px_rgba(245,158,11,0.35)]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="motion-safe:animate-pulse">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                <span className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-white">Coming Soon</span>
              </div>
            </div>

            <h3 className="text-[25px] font-extrabold leading-[1.15] tracking-[-0.03em] text-slate-900 mb-2">
              New Challenges<br />Are Brewing
            </h3>
            <p className="text-[14px] leading-relaxed text-slate-500 max-w-[280px]">
              Our team is cooking up fresh community challenges. Track your streak, compete on the leaderboard, and earn rewards with fellow Nutrio members.
            </p>

            <div className="mt-6 flex items-center gap-3">
              <div className="flex -space-x-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-200 to-emerald-300 border-2 border-white flex items-center justify-center" style={{ zIndex: 3 - i }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                    </svg>
                  </div>
                ))}
              </div>
              <span className="text-[12px] font-semibold text-slate-500">+ others waiting</span>
            </div>

            <div className="mt-5 pt-4 border-t border-emerald-200/60">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  {[
                    { val: countdown.days, label: "Days" },
                    { val: countdown.hours, label: "Hours" },
                    { val: countdown.minutes, label: "Min" },
                  ].map((unit) => (
                    <div key={unit.label} className="text-center">
                      <div className="text-[22px] font-black leading-none text-emerald-700 tabular-nums">{String(unit.val).padStart(2, "0")}</div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-500 mt-0.5">{unit.label}</div>
                    </div>
                  ))}
                </div>
                <div className="h-10 w-px bg-emerald-200" />
                <p className="text-[11px] font-semibold text-emerald-600 leading-snug">
                  Until next<br />challenge drop
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  const leaderboard = leaderboards[challenge.id] ?? [];
  const now = new Date();
  const end = new Date(challenge.end_date);
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const progressPct = challenge.target_value > 0
    ? Math.min(100, Math.round((challenge.user_progress / challenge.target_value) * 100))
    : 0;

  const isCompleted = challenge.user_progress >= challenge.target_value && challenge.target_value > 0;

  return (
    <motion.div variants={fadeInUp}>
      <div className="relative min-h-[306px] overflow-hidden rounded-[28px] border border-emerald-200 bg-[radial-gradient(circle_at_78%_35%,rgba(43,213,177,0.36),transparent_31%),linear-gradient(135deg,#009D72_0%,#00856B_47%,#007B82_100%)] p-4 text-white shadow-[0_14px_28px_rgba(0,113,98,0.22)]">
        <div className="absolute right-2 top-10 h-44 w-44 rounded-full bg-white/10" />
        <div className="absolute right-7 top-[72px] select-none text-[118px] leading-none drop-shadow-[0_12px_18px_rgba(0,0,0,0.22)]">
          {challenge.challenge_type === "streak" ? "🔥" : "🏆"}
        </div>

        <div className="relative flex items-center gap-2">
          <span className="inline-flex h-8 items-center rounded-full bg-white/20 px-3 text-[12px] font-bold text-white backdrop-blur-md">
            {isCompleted ? "✅ Completed" : "🔥 Active Challenge"}
          </span>
          {challenges.length > 1 && (
            <span className="text-[11px] text-white/50">{activeIndex + 1}/{challenges.length}</span>
          )}
        </div>

        <div className="relative mt-5 max-w-[55%] space-y-2">
          <h3 className="text-[25px] font-extrabold leading-[1.13] tracking-[-0.02em]">{challenge.title}</h3>
          <p className="text-[14px] leading-5 text-white/95">{challenge.description}</p>
        </div>

        <div className="relative mt-5 flex items-center gap-2 text-sm">
          <div className="inline-flex min-w-[86px] items-center gap-2 rounded-[16px] bg-white/15 px-3 py-2.5 backdrop-blur-md">
            <Users className="h-5 w-5" />
            <div className="leading-tight">
              <div className="text-[19px] font-extrabold">{challenge.participant_count}</div>
              <div className="text-[11px] opacity-95">Joined</div>
            </div>
          </div>
          <div className="inline-flex min-w-[78px] items-center gap-2 rounded-[16px] bg-white/15 px-3 py-2.5 backdrop-blur-md">
            <CalendarDays className="h-5 w-5" />
            <div className="leading-tight">
              <div className="text-[19px] font-extrabold">{daysLeft}</div>
              <div className="text-[11px] opacity-95">Days Left</div>
            </div>
          </div>
          {challenge.is_joined && (
            <div className="inline-flex min-w-[78px] items-center gap-2 rounded-[16px] bg-white/15 px-3 py-2.5 backdrop-blur-md">
              <div className="leading-tight">
                <div className="text-[19px] font-extrabold">{progressPct}%</div>
                <div className="text-[11px] opacity-95">Progress</div>
              </div>
            </div>
          )}
        </div>

        <div className="relative mt-5 rounded-[19px] bg-white p-3 text-foreground shadow-[0_10px_22px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-emerald-700">Top 3 Leaderboard</p>
            {challenge.user_rank > 0 && (
              <span className="text-[10px] font-bold text-emerald-600">Your rank: #{challenge.user_rank}</span>
            )}
          </div>

          {leaderboard.length > 0 ? (
            <div className="flex items-center gap-3">
              <div className="flex items-end gap-1">
                {leaderboard.map((entry, i) => (
                  <div key={i} className="relative">
                    {entry.avatar_url ? (
                      <img src={entry.avatar_url} alt={entry.user_name ?? ""} className="h-9 w-9 rounded-full border border-white object-cover shadow" />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center border border-white">
                        <span className="text-[11px] font-bold text-emerald-600">{(entry.user_name ?? "?")[0]}</span>
                      </div>
                    )}
                    <div className={`absolute -bottom-2 left-1/2 flex h-5 min-w-5 -translate-x-1/2 items-center justify-center rounded-full px-1 text-[10px] font-extrabold text-white ${entry.rank === 1 ? "bg-amber-400" : entry.rank === 2 ? "bg-slate-300 text-slate-700" : "bg-orange-400"}`}>
                      {entry.rank}
                    </div>
                  </div>
                ))}
              </div>
              <div className="h-10 w-px bg-border" />
              <div className="flex-1">
                {leaderboard.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-slate-600 truncate max-w-[80px]">{entry.user_name ?? "Player"}</span>
                    <span className="font-bold text-emerald-600">{entry.current_progress}/{challenge.target_value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground text-center py-2">No entries yet — be the first!</p>
          )}

          {challenge.is_joined && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="font-semibold text-slate-500">Your progress</span>
                <span className="font-bold text-emerald-600">{challenge.user_progress}/{challenge.target_value}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="relative mt-5 flex items-center gap-0">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => joinChallenge(challenge.id)}
            disabled={joiningId === challenge.id || isCompleted}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-white text-sm font-extrabold text-emerald-700 shadow-[0_10px_18px_rgba(0,0,0,0.08)] disabled:opacity-60"
          >
            {joiningId === challenge.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isCompleted ? (
              "Completed!"
            ) : challenge.is_joined ? (
              `Joined — ${progressPct}%`
            ) : (
              "Join Challenge"
            )}
          </motion.button>
          {challenges.length > 1 && (
            <button
              className="-ml-11 flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg"
              onClick={nextChallenge}
              aria-label="Next challenge"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
