import { useCallback, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

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

type XpAction =
  | "log_meal"
  | "complete_macros"
  | "order_healthy"
  | "streak_7"
  | "water_goal"
  | "workout_complete"
  | "rate_meal"
  | "refer_friend";

function toXpState(xpValue: number | null, levelValue: number | null): XpState {
  const xp = Math.max(0, xpValue || 0);
  const level = Math.max(1, levelValue || 1);

  return {
    xp,
    level,
    xpToNextLevel: Math.max(0, level * 100 - xp),
  };
}

export function useXp(userId: string | undefined) {
  const [state, setState] = useState<XpState>({ xp: 0, level: 1, xpToNextLevel: 100 });
  const loadingRef = useRef(false);

  const loadXp = useCallback(async () => {
    if (!userId || loadingRef.current) return;
    loadingRef.current = true;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("xp, level")
        .eq("user_id", userId)
        .single();
      if (error) throw error;

      setState(toXpState(data.xp, data.level));
    } catch (error) {
      console.error("Failed to load XP:", error);
    } finally {
      loadingRef.current = false;
    }
  }, [userId]);

  const award = useCallback(async (
    _action: XpAction,
    _details?: string,
  ): Promise<AwardResult> => {
    if (!userId) {
      return { xp: state.xp, level: state.level, leveledUp: false, newLevel: state.level };
    }

    // XP is granted only by server-owned action RPCs. This compatibility method
    // refreshes the authoritative balance instead of simulating a client award.
    const { data, error } = await supabase
      .from("profiles")
      .select("xp, level")
      .eq("user_id", userId)
      .single();
    if (error) throw error;

    const nextState = toXpState(data.xp, data.level);
    setState(nextState);

    return {
      xp: nextState.xp,
      level: nextState.level,
      leveledUp: false,
      newLevel: nextState.level,
    };
  }, [state.level, state.xp, userId]);

  const getState = useCallback(
    () => ({ xp: state.xp, level: state.level, xpToNextLevel: state.xpToNextLevel }),
    [state],
  );

  return { ...state, award, loadXp, getState };
}
