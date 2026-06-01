import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AwardResult {
  xp: number;
  level: number;
  leveledUp: boolean;
  newLevel: number;
}

interface XpState {
  xp: number;
  level: number;
  xpToNextLevel: number;
}

const XP_ACTIONS = {
  log_meal: 10,
  complete_macros: 50,
  order_healthy: 25,
  streak_7: 100,
  water_goal: 30,
  workout_complete: 40,
  rate_meal: 15,
  refer_friend: 200,
} as const;

export function useXp(userId: string | undefined) {
  const [state, setState] = useState<XpState>({ xp: 0, level: 1, xpToNextLevel: 100 });
  const awardedRef = useRef(new Map<string, number>());
  const loadingRef = useRef(false);

  const loadXp = useCallback(async () => {
    if (!userId || loadingRef.current) return;
    loadingRef.current = true;
    try {
      const { data } = await supabase.from("profiles").select("level").eq("user_id", userId).single();
      if (data) {
        const xp = 0; // xp column not yet available
        const level = data.level || 1;
        setState({ xp, level, xpToNextLevel: level * 100 });
      }
    } catch {
      // silent
    } finally {
      loadingRef.current = false;
    }
  }, [userId]);

  const award = useCallback(async (action: keyof typeof XP_ACTIONS, details?: string): Promise<AwardResult> => {
    if (!userId) return { xp: getState().xp, level: getState().level, leveledUp: false, newLevel: getState().level };

    const today = new Date().toISOString().split("T")[0];
    const key = `${action}-${today}`;
    const todayCount = awardedRef.current.get(key) || 0;

    const dailyCaps: Partial<Record<keyof typeof XP_ACTIONS, number>> = {
      log_meal: 3,
      rate_meal: 3,
      workout_complete: 2,
    };

    const cap = dailyCaps[action];
    if (cap !== undefined && todayCount >= cap) {
      return { xp: state.xp, level: state.level, leveledUp: false, newLevel: state.level };
    }

    const earned = XP_ACTIONS[action];
    const newTodayCount = todayCount + 1;
    awardedRef.current.set(key, newTodayCount);

    const currentState = state;
    const newXp = currentState.xp + earned;
    const currentLevel = currentState.level;
    const xpForNext = currentLevel * 100;
    const leveledUp = newXp >= xpForNext;
    const newLevel = leveledUp ? currentLevel + 1 : currentLevel;
    const remaining = leveledUp ? newXp - xpForNext : newXp % xpForNext;

    setState({ xp: newXp, level: newLevel, xpToNextLevel: newLevel * 100 });

    await supabase.from("profiles").update({ level: newLevel }).eq("user_id", userId);

    if (leveledUp) {
      toast.custom(
        (t) => (
           <div className="rounded-2xl border-0 bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 p-4 shadow-2xl">
             <div className="flex items-center gap-3">
              <span className="text-3xl">🎉</span>
              <div>
                <p className="text-sm font-extrabold text-white">Level Up!</p>
                <p className="text-xs text-white/80">You reached Level {newLevel}!</p>
              </div>
            </div>
          </div>
        ),
        { duration: 3000, position: "top-center" }
      );
    }

    if (details) {
      toast.success(details, {
        description: `+${earned} XP earned`,
        duration: 2000,
      });
    }

    return { xp: newXp, level: newLevel, leveledUp, newLevel };
  }, [userId, state.xp, state.level]);

  const getState = useCallback(() => ({ xp: state.xp, level: state.level, xpToNextLevel: state.xpToNextLevel }), [state]);

  return { ...state, award, loadXp };
}
