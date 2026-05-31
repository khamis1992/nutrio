import { useEffect, useState } from "react";
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
  if (loading) return null;
  const pct = Math.min((g.xp / g.xpToNextLevel) * 100, 100);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#F0FDF6] shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      {/* ─── Medal ─── */}
      <div className="flex flex-col items-center pt-7 pb-5">
        <div className="relative grid h-[100px] w-[100px] place-items-center rounded-full bg-white shadow-[0_0_40px_rgba(251,191,36,0.12),0_0_80px_rgba(251,191,36,0.04)]">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-amber-500" style={{ mask: "radial-gradient(circle at center, transparent 38px, black 39px)", WebkitMask: "radial-gradient(circle at center, transparent 38px, black 39px)" }} />
          <div className="absolute inset-[6px] rounded-full bg-white" />
          <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(251,191,36,0.1)" strokeWidth="2.5" />
            <circle cx="50" cy="50" r="44" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={`${(pct/100)*276.5} 276.5`} className="transition-all duration-700" />
          </svg>
          <span className="relative z-10 text-[36px] font-black tracking-[-0.04em] text-slate-800">{g.level}</span>
        </div>
        <p className="mt-3 text-[12px] font-extrabold uppercase tracking-[0.14em] text-amber-600">{getLevelName(g.level)}</p>
        <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 ring-1 ring-amber-100">
          <span className="text-[14px] font-extrabold text-slate-800">{g.xp}</span><span className="text-[11px] text-slate-400">/ {g.xpToNextLevel} XP</span>
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-700">{Math.round(pct)}%</span>
        </div>
        <div className="mt-2 h-1.5 w-36 rounded-full bg-amber-100">
          <div className="h-full rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.15)] transition-all duration-700" style={{ width: `${Math.max(pct,3)}%` }} />
        </div>
      </div>

      {/* ─── Next level ─── */}
      <div className="mx-4 mb-4 rounded-xl bg-white p-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-50 ring-1 ring-amber-100">
            <span className="text-[15px] font-black text-amber-600">{g.level + 1}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-extrabold text-slate-800">{getLevelName(g.level + 1)}</p>
            <p className="text-[11px] text-slate-400">{g.xpToNextLevel - g.xp} XP until unlock</p>
          </div>
          <Zap className="h-4 w-4 text-amber-400" />
        </div>
      </div>

      {/* ─── Badges ─── */}
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
