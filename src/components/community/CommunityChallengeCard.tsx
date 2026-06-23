import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { CalendarDays, ChevronRight, Loader2, Users } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCommunityChallenges } from "@/hooks/useCommunityChallenges";
import { supabase } from "@/integrations/supabase/client";
import { fadeInUp } from "@/lib/animations";

interface LeaderboardEntry { user_name: string; avatar_url: string | null; current_progress: number; rank: number; }

export function CommunityChallengeCard() {
  const { t } = useLanguage();
  const { challenges, loading, joiningId, joinChallenge } = useCommunityChallenges();
  const [activeIndex, setActiveIndex] = useState(0);
  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardEntry[]>>({});
  const challenge = challenges[activeIndex];
  const activeLeaderboard = challenge?.id ? leaderboards[challenge.id] : undefined;

  useEffect(() => {
    if (!challenge?.id || challenge.is_local || activeLeaderboard) return;

    void (async () => {
      const { data } = await supabase
        .from("challenge_leaderboard")
        .select("user_name, avatar_url, current_progress, rank")
        .eq("challenge_id", challenge.id)
        .order("rank", { ascending: true })
        .limit(3);

      if (data) {
        setLeaderboards((current) => ({
          ...current,
          [challenge.id]: data as LeaderboardEntry[],
        }));
      }
    })();
  }, [activeLeaderboard, challenge?.id, challenge?.is_local]);
  const nextChallenge = () => setActiveIndex((prev) => (prev === challenges.length - 1 ? 0 : prev + 1));
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0 });
  const calcCountdown = useCallback(() => { const n = new Date(); const nx = new Date(n.getFullYear(), n.getMonth() + 1, 1); const d = nx.getTime() - n.getTime(); setCountdown({ days: Math.floor(d/86400000), hours: Math.floor((d%86400000)/3600000), minutes: Math.floor((d%3600000)/60000) }); }, []);
  useEffect(() => { calcCountdown(); const id = setInterval(calcCountdown, 60000); return () => clearInterval(id); }, [calcCountdown]);
  if (loading) return <div className="flex h-[280px] items-center justify-center rounded-2xl bg-slate-50"><Loader2 className="h-7 w-7 animate-spin text-slate-700" /></div>;

  if (challenges.length === 0) {
    return (
      <motion.div variants={fadeInUp}>
        <div className="relative overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-6">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2 shadow-[0_2px_8px_rgba(245,158,11,0.25)]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
              <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-white">{t("community_coming_soon")}</span>
            </div>
          </div>
          <h3 className="text-[24px] font-extrabold leading-[1.15] text-slate-900 mb-2">{t("community_new_challenges_brewing")}</h3>
          <p className="text-[14px] leading-relaxed text-slate-500 max-w-[280px] mb-5">{t("community_challenges_description")}</p>
          <div className="flex items-center gap-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-3">
              {[{ val: countdown.days, label: t("community_days") }, { val: countdown.hours, label: t("community_hours") }, { val: countdown.minutes, label: t("community_minutes") }].map((u) => (
                <div key={u.label} className="text-center"><div className="text-[20px] font-black text-slate-800 tabular-nums">{String(u.val).padStart(2,"0")}</div><div className="text-[9px] font-bold uppercase text-slate-400 mt-0.5">{u.label}</div></div>
              ))}
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <p className="text-[11px] font-semibold text-slate-500">{t("community_until_next_drop")}</p>
          </div>
        </div>
      </motion.div>
    );
  }

  const leaderboard = leaderboards[challenge.id] ?? [];
  const daysLeft = Math.max(0, Math.ceil((new Date(challenge.end_date).getTime() - Date.now()) / 86400000));
  const progressPct = challenge.target_value > 0 ? Math.min(100, Math.round((challenge.user_progress / challenge.target_value) * 100)) : 0;
  const isCompleted = challenge.user_progress >= challenge.target_value && challenge.target_value > 0;
  const jl = joiningId === challenge.id ? <Loader2 className="h-4 w-4 animate-spin" /> : isCompleted ? t("community_completed") : challenge.is_joined ? t("community_joined_status", { pct: progressPct }) : t("community_join_challenge");

  return (
    <motion.div variants={fadeInUp}>
      <div className="relative overflow-hidden rounded-2xl bg-[#0F172A] p-4 text-white shadow-[0_4px_20px_rgba(15,23,42,0.15)]">
        <div className="absolute right-4 top-6 select-none text-[96px] leading-none opacity-50">{challenge.challenge_type === "streak" ? "🔥" : "🏆"}</div>

        <div className="relative flex items-center gap-2 mb-4">
          <span className="inline-flex h-7 items-center rounded-full bg-white/10 px-3 text-[11px] font-bold backdrop-blur-sm">{isCompleted ? t("community_badge_completed") : t("community_badge_active")}</span>
          {challenges.length > 1 && <span className="text-[11px] text-white/40">{activeIndex+1}/{challenges.length}</span>}
        </div>

        <div className="relative max-w-[55%] space-y-1.5">
          <h3 className="text-[22px] font-extrabold leading-[1.1]">{challenge.title}</h3>
          <p className="text-[13px] leading-[1.4] text-white/70">{challenge.description}</p>
        </div>

        <div className="relative mt-4 flex items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-xl bg-white/8 px-3 py-2"><Users className="h-4 w-4 text-white/50" /><div className="leading-tight"><div className="text-[16px] font-extrabold">{challenge.participant_count}</div><div className="text-[10px] text-white/50">{t("community_joined")}</div></div></div>
          <div className="inline-flex items-center gap-2 rounded-xl bg-white/8 px-3 py-2"><CalendarDays className="h-4 w-4 text-white/50" /><div className="leading-tight"><div className="text-[16px] font-extrabold">{daysLeft}</div><div className="text-[10px] text-white/50">{t("community_days")}</div></div></div>
          {challenge.is_joined && <div className="inline-flex items-center gap-2 rounded-xl bg-white/8 px-3 py-2"><div className="leading-tight"><div className="text-[16px] font-extrabold">{progressPct}%</div><div className="text-[10px] text-white/50">{t("community_progress")}</div></div></div>}
        </div>

        <div className="relative mt-4 rounded-xl bg-white p-3 text-slate-900 shadow-sm">
          <div className="flex items-center justify-between mb-2"><p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{challenge.is_local ? "Your week" : "Top 3"}</p>{challenge.user_rank > 0 && !challenge.is_local && <span className="text-[10px] font-bold text-slate-700">#{challenge.user_rank}</span>}</div>
          {challenge.is_local ? (
            <p className="text-[12px] font-semibold leading-5 text-slate-500">Personal challenge generated from your Nutrio performance data. Community leaderboard unlocks when admin challenges are active.</p>
          ) : leaderboard.length>0?(<div className="flex items-center gap-3"><div className="flex items-end gap-1">{leaderboard.map((e,i)=>(<div key={i} className="relative">{e.avatar_url?<img src={e.avatar_url} alt="" className="h-8 w-8 rounded-full border-2 border-white object-cover shadow-sm"/>:<div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center border-2 border-white"><span className="text-[10px] font-bold text-slate-500">{(e.user_name??"?")[0]}</span></div>}<div className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[9px] font-extrabold text-white ${e.rank===1?"bg-amber-400":e.rank===2?"bg-slate-400":"bg-orange-400"}`}>{e.rank}</div></div>))}</div><div className="h-8 w-px bg-slate-200" /><div className="flex-1">{leaderboard.map((e,i)=>(<div key={i} className="flex items-center justify-between text-[10px]"><span className="font-semibold text-slate-600 truncate max-w-[80px]">{e.user_name??t("community_player")}</span><span className="font-bold text-slate-700">{e.current_progress}/{challenge.target_value}</span></div>))}</div></div>):<p className="text-[12px] text-slate-400 text-center py-2">{t("community_be_first")}</p>}
          {challenge.is_joined&&(<div className="mt-2"><div className="flex items-center justify-between text-[10px] mb-1"><span className="text-slate-400">{t("community_your_progress")}</span><span className="font-bold text-slate-700">{challenge.user_progress}/{challenge.target_value}</span></div><div className="h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#020617] transition-all duration-500" style={{width:`${progressPct}%`}} /></div></div>)}
        </div>

        <div className="relative mt-4 flex items-center"><motion.button whileTap={{scale:0.98}} onClick={()=>joinChallenge(challenge.id)} disabled={joiningId===challenge.id||isCompleted} className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-white text-sm font-extrabold text-[#020617] shadow-[0_4px_12px_rgba(2,6,23,0.18)] disabled:opacity-50 hover:bg-slate-100 transition-colors">{jl}</motion.button>{challenges.length>1&&<button className="-ml-10 flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-[#0F172A] bg-white text-[#020617] shadow-lg hover:bg-slate-100 transition-colors" onClick={nextChallenge} aria-label="Next"><ChevronRight className="h-4 w-4" /></button>}</div>
      </div>
    </motion.div>
  );
}
