import { useEffect, useState } from "react";
import { ChevronRight, Lock, Star } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useBadges } from "@/hooks/useBadges";
import { cn } from "@/lib/utils";

type UserGamification = {
  xp: number;
  level: number;
  xpToNextLevel: number;
};

export function GamificationWidget() {
  const { user } = useAuth();
  const { badges, unlockedCount, totalCount } = useBadges(user?.id);
  const [gamification, setGamification] = useState<UserGamification>({
    xp: 0,
    level: 1,
    xpToNextLevel: 100,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const fetchXpData = async () => {
      try {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("xp, level")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        const level = profile?.level || 1;
        const xp = profile?.xp || 0;

        setGamification({
          xp,
          level,
          xpToNextLevel: level * 100,
        });
      } catch (err) {
        console.error("Error fetching gamification data:", err);
      } finally {
        setLoading(false);
      }
    };

    void fetchXpData();
  }, [user?.id]);

  if (loading) return null;

  const xpProgress = Math.min((gamification.xp / gamification.xpToNextLevel) * 100, 100);
  const visibleProgress = xpProgress > 0 ? xpProgress : 8;

  return (
    <div className="overflow-hidden rounded-[26px] border border-violet-200 bg-gradient-to-br from-[#FCF8FF] to-[#F6F0FF] shadow-[0_10px_24px_rgba(91,33,182,0.06)]">
      <div className="relative grid grid-cols-[1fr_82px_1.38fr] items-center gap-3 px-4 py-5">
        <button className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white text-foreground shadow-sm" aria-label="Rewards">
          <ChevronRight className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3">
          <div
            className="flex h-14 w-14 items-center justify-center bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-[0_10px_20px_rgba(124,58,237,0.24)]"
            style={{ clipPath: "polygon(25% 7%,75% 7%,100% 50%,75% 93%,25% 93%,0% 50%)" }}
          >
            <Star className="h-7 w-7 fill-white" />
          </div>
          <div>
            <h3 className="text-[18px] font-extrabold leading-tight text-foreground">Level {gamification.level}</h3>
            <p className="text-[13px] text-muted-foreground">Beginner</p>
          </div>
        </div>

        <div className="text-center">
          <div
            className="mx-auto grid h-[72px] w-[72px] place-items-center rounded-full"
            style={{ background: `conic-gradient(#8B5CF6 ${visibleProgress}%, #EEE7FA ${visibleProgress}%)` }}
          >
            <div className="grid h-[56px] w-[56px] place-items-center rounded-full bg-[#FBF8FF]">
              <div className="leading-none">
                <div className="text-[22px] font-extrabold text-foreground">{gamification.xp}</div>
                <div className="text-[10px] font-semibold text-muted-foreground">XP</div>
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0 pr-8">
          <div className="text-[15px] font-extrabold text-foreground">
            {gamification.xp} / {gamification.xpToNextLevel} XP
          </div>
          <div className="mt-2 h-2 rounded-full bg-white/80">
            <div className="h-full rounded-full bg-violet-500" style={{ width: `${xpProgress}%` }} />
          </div>
          <p className="mt-4 text-[13px] font-semibold text-foreground">
            Badges ({unlockedCount}/{totalCount})
          </p>
          <div className="mt-2 flex items-center gap-2">
            {[...badges].sort((a, b) => (b.unlocked ? 1 : 0) - (a.unlocked ? 1 : 0)).slice(0, 4).map((badge) => (
              <div key={badge.id} className="relative h-9 w-9">
                <img
                  src={badge.image}
                  alt={badge.name}
                  className={cn(
                    "h-full w-full object-contain",
                    badge.unlocked ? "" : "grayscale opacity-50",
                  )}
                />
                {!badge.unlocked && (
                  <Lock className="absolute inset-0 m-auto h-4 w-4 text-slate-400" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <button className="flex h-12 w-full items-center justify-center gap-2 border-t border-violet-100 text-[14px] font-extrabold text-violet-600">
        View Rewards <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
