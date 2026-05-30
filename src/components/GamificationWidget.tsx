import { useEffect, useState } from "react";
import { Lock, Star, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useBadges } from "@/hooks/useBadges";
import { cn } from "@/lib/utils";

const LEVEL_NAMES: Record<number, string> = {
  1: "Beginner", 2: "Explorer", 3: "Dedicated", 4: "Warrior",
  5: "Champion", 6: "Elite", 7: "Master", 8: "Legend", 9: "Mythic", 10: "Transcendent",
};
function getLevelName(l: number) { return l >= 10 ? "Transcendent" : (LEVEL_NAMES[l] || `Level ${l}`); }

type UserGamification = { xp: number; level: number; xpToNextLevel: number };

export function GamificationWidget() {
  const { user } = useAuth();
  const { badges, unlockedCount, totalCount } = useBadges(user?.id);
  const [g, setG] = useState<UserGamification>({ xp: 0, level: 1, xpToNextLevel: 100 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    (async () => {
      try {
        const { data: p } = await supabase.from("profiles").select("xp, level").eq("id", user.id).maybeSingle();
        const lv = p?.level || 1; const xp = p?.xp || 0;
        setG({ xp, level: lv, xpToNextLevel: lv * 100 });
      } finally { setLoading(false); }
    })();
  }, [user?.id]);

  if (loading) return null;

  const pct = Math.min((g.xp / g.xpToNextLevel) * 100, 100);
  const remaining = g.xpToNextLevel - g.xp;
  const nextName = getLevelName(g.level + 1);

  return (
    <div className="relative overflow-hidden rounded-[32px] bg-[radial-gradient(100%_100%_at_50%_0%,rgba(202,138,4,0.08)_0%,transparent_55%),linear-gradient(170deg,#1C1917_0%,#292524_45%,#1C1917_100%)] text-white shadow-[0_32px_64px_rgba(0,0,0,0.45)]">
      {/* Radial rays behind medal */}
      <div className="pointer-events-none absolute left-1/2 top-[35%] h-80 w-80 -translate-x-1/2 -translate-y-1/2 opacity-[0.04]" style={{ background: "repeating-conic-gradient(transparent 0deg, transparent 15deg, rgba(255,255,255,0.5) 16deg)" }} />

      {/* Medal zone */}
      <div className="relative flex flex-col items-center pt-8 pb-6">
        <div className="relative">
          <div className="absolute inset-0 scale-150 rounded-full bg-amber-500/15 blur-2xl" />
          <div className="relative grid h-[120px] w-[120px] place-items-center rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 shadow-[0_0_60px_rgba(202,138,4,0.25),0_0_120px_rgba(202,138,4,0.10)]">
            <div className="absolute inset-[5px] rounded-full border-2 border-amber-300/30" />
            <div className="absolute inset-[12px] rounded-full border border-amber-200/20" />
            <span className="relative z-10 text-[40px] font-black leading-none tracking-[-0.06em] text-stone-900">{g.level}</span>
          </div>
        </div>

        <h3 className="mt-4 text-[14px] font-extrabold uppercase tracking-[0.16em] text-amber-400">{getLevelName(g.level)}</h3>

        {/* XP pill */}
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5">
          <span className="text-[14px] font-extrabold text-white">{g.xp}</span>
          <span className="text-[11px] font-semibold text-white/60">/ {g.xpToNextLevel} XP</span>
          <span className="ml-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-extrabold text-amber-400">{Math.round(pct)}%</span>
        </div>

        <div className="mt-2 h-1 w-36 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-amber-500 transition-all duration-700" style={{ width: `${Math.max(pct, 3)}%` }} />
        </div>
      </div>

      {/* Next level */}
      <div className="mx-5 -mt-1 mb-5 rounded-2xl bg-white/[0.06] p-3.5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-500/15">
            <span className="text-[15px] font-black text-amber-400">{g.level + 1}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-extrabold text-white/90">{nextName}</p>
            <p className="text-[11px] font-medium text-white/50 mt-0.5">{remaining} XP until unlock</p>
          </div>
          <Zap className="h-5 w-5 text-amber-400" />
        </div>
      </div>

      {/* Badges shelf */}
      <div className="mx-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/50">Badges</p>
          <span className="text-[11px] font-extrabold text-amber-400">{unlockedCount}<span className="text-white/40">/{totalCount}</span></span>
        </div>

        <div className="flex items-center justify-center gap-2">
          {[...badges].sort((a, b) => (b.unlocked ? 1 : 0) - (a.unlocked ? 1 : 0)).slice(0, 5).map((badge, i) => {
            const offsets = [-4, -1, 2, -2, 3];
            return (
              <div
                key={badge.id}
                className={cn(
                  "relative grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl transition-all duration-200 hover:scale-110 hover:z-10 cursor-pointer",
                  badge.unlocked
                    ? "bg-amber-500/10 ring-1 ring-amber-500/25 shadow-[0_6px_16px_rgba(202,138,4,0.10)]"
                    : "bg-white/8 ring-1 ring-white/10"
                )}
                style={{ marginTop: `${offsets[i]}px` }}
              >
                {badge.image ? (
                  <img src={badge.image} alt={badge.name} className={cn("h-7 w-7 object-contain", badge.unlocked ? "" : "grayscale opacity-30")} />
                ) : (
                  <Star className={cn("h-5 w-5", badge.unlocked ? "text-amber-400 fill-amber-400" : "text-white/20")} />
                )}
                {!badge.unlocked && (
                  <Lock className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 text-white/20 bg-stone-900 rounded-full p-0.5" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
