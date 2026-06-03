import { useEffect, useState, useId } from "react";
import { Lock, Star, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useBadges } from "@/hooks/useBadges";
import { cn } from "@/lib/utils";

const LEVEL_NAMES: Record<number, string> = { 1: "Beginner", 2: "Explorer", 3: "Dedicated", 4: "Warrior", 5: "Champion", 6: "Elite", 7: "Master", 8: "Legend", 9: "Mythic", 10: "Transcendent" };
function getLevelName(l: number) { return l >= 10 ? "Transcendent" : (LEVEL_NAMES[l] || `Level ${l}`); }
type UserGamification = { xp: number; level: number; xpToNextLevel: number };

export function GamificationWidget() {
  const { user } = useAuth();
  const { badges, unlockedCount, totalCount } = useBadges(user?.id);
  const [g, setG] = useState<UserGamification>({ xp: 0, level: 1, xpToNextLevel: 100 });
  const [loading, setLoading] = useState(true);
  useEffect(() => { if (!user?.id) { setLoading(false); return; } (async () => { try { const { data: p } = await supabase.from("profiles").select("level").eq("user_id", user.id).maybeSingle(); setG({ xp: 0, level: p?.level || 1, xpToNextLevel: (p?.level || 1) * 100 }); } finally { setLoading(false); } })(); }, [user?.id]);

  const gradientId = useId();
  const CIRCUMFERENCE = 2 * Math.PI * 38;
  const pct = Math.min((g.xp / g.xpToNextLevel) * 100, 100);
  const progressOffset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;

  if (loading) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
      {/* ═══════ LEVEL HEADER ═══════ */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-4">
          {/* ─── Level Medal ─── */}
          <div className="relative shrink-0">
            <svg className="h-[88px] w-[88px] -rotate-90" viewBox="0 0 88 88">
              <defs>
                <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10B981" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
              </defs>
              <circle cx="44" cy="44" r="38" fill="none" stroke="#F1F5F9" strokeWidth="5" />
              <circle
                cx="44" cy="44" r="38" fill="none"
                stroke={`url(#${gradientId})`}
                strokeWidth="5" strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={progressOffset}
                className="transition-[stroke-dashoffset] duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[28px] font-black leading-none tracking-[-0.03em] text-slate-900">
                {g.level}
              </span>
              <span className="mt-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
                LEVEL
              </span>
            </div>
          </div>

          {/* ─── Level Info ─── */}
          <div className="flex-1 min-w-0">
            <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-emerald-600">
              {getLevelName(g.level)}
            </span>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-[26px] font-extrabold leading-none tracking-[-0.02em] text-slate-900">
                {g.xp}
              </span>
              <span className="text-[13px] font-medium text-slate-400">
                / {g.xpToNextLevel} XP
              </span>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.25)] transition-all duration-700 ease-out"
                style={{ width: `${Math.max(pct, 4)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ NEXT LEVEL ═══════ */}
      <div className="mx-4 mb-4 rounded-xl bg-[#F0FDF6] p-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-emerald-100">
            <span className="text-[16px] font-black text-emerald-600">{g.level + 1}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-extrabold text-slate-800">{getLevelName(g.level + 1)}</p>
              <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-700">
                {Math.round(pct)}%
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {g.xpToNextLevel - g.xp} XP remaining to unlock
            </p>
          </div>
          <Zap className="h-4 w-4 text-emerald-400" />
        </div>
      </div>

      {/* ═══════ BADGES ═══════ */}
      {/* KEEP THIS SECTION IDENTICAL TO ORIGINAL — DO NOT MODIFY */}
      <div className="mx-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Badges</p>
          <span className="text-[11px] font-extrabold text-amber-600">{unlockedCount}<span className="text-slate-300">/{totalCount}</span></span>
        </div>
        <div className="flex items-end justify-center gap-2">
          {[...badges].sort((a,b)=>(b.unlocked?1:0)-(a.unlocked?1:0)).slice(0,5).map((badge,i)=>(
            <div key={badge.id} className={cn("relative grid h-[46px] w-[46px] shrink-0 place-items-center rounded-xl transition-all duration-200 hover:scale-110 hover:z-10 cursor-pointer",badge.unlocked?"bg-white ring-1 ring-amber-200 shadow-sm":"bg-slate-50 ring-1 ring-slate-200")} style={{marginTop:`${[-3,-1,2,-2,1][i]}px`}}>
              {badge.image?<img src={badge.image} alt={badge.name} className={cn("h-6 w-6 object-contain",badge.unlocked?"":"grayscale opacity-25")}/>:<Star className={cn("h-[16px] w-[16px]",badge.unlocked?"text-amber-500 fill-amber-500":"text-slate-300")}/>}
              {!badge.unlocked&&<Lock className="absolute -bottom-0.5 -right-0.5 h-3 w-3 text-slate-300 bg-white rounded-full p-0.5"/>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
