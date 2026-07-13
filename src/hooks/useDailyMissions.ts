import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface Mission {
  id: string;
  title: string;
  description: string;
  icon: string;
  difficulty: "easy" | "medium" | "hard";
  target: number;
  current: number;
  completed: boolean;
}

interface DailyMissionsState {
  missions: Mission[];
  bonusXp: number;
  bonusClaimed: boolean;
  allComplete: boolean;
}

type MissionPool = Array<Omit<Mission, "current" | "completed">>;

function serializeMissions(missions: Mission[]): Json {
  return missions.map(({ current, completed, ...rest }) => ({
    ...rest,
    current,
    completed,
  })) as Json;
}

const MISSION_POOL: MissionPool = [
  { id: "log_meals", title: "Log Your Meals", description: "Log 3 meals today", icon: "📝", difficulty: "easy", target: 3 },
  { id: "drink_water", title: "Stay Hydrated", description: "Drink 8 glasses of water", icon: "💧", difficulty: "easy", target: 8 },
  { id: "walk_steps", title: "Get Moving", description: "Walk 6,000 steps", icon: "🚶", difficulty: "easy", target: 6000 },
  { id: "calorie_budget", title: "Stay in Budget", description: "Stay within your calorie target", icon: "🎯", difficulty: "medium", target: 1 },
  { id: "protein_goal", title: "Protein Power", description: "Hit your daily protein target", icon: "💪", difficulty: "medium", target: 1 },
  { id: "workout_session", title: "Get Active", description: "Complete a workout session", icon: "🏃", difficulty: "medium", target: 1 },
  { id: "new_restaurant", title: "Explore", description: "Order from a new restaurant", icon: "🔍", difficulty: "hard", target: 1 },
  { id: "perfect_day", title: "Perfect Macros", description: "Hit all 3 macro targets", icon: "⭐", difficulty: "hard", target: 1 },
  { id: "no_skip", title: "No Skips", description: "Don't skip any planned meals", icon: "✅", difficulty: "hard", target: 1 },
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getDailyMissions(userId: string, date: string): Mission[] {
  const seed = hashString(`${userId}-${date}`);
  const pool = [...MISSION_POOL];
  const selected: Mission[] = [];

  const easy = pool.filter(m => m.difficulty === "easy");
  const medium = pool.filter(m => m.difficulty === "medium");
  const hard = pool.filter(m => m.difficulty === "hard");

  const pick = (arr: typeof easy, idx: number) => arr[idx % arr.length];

  selected.push(
    { ...pick(easy, seed % easy.length), current: 0, completed: false },
    { ...pick(medium, Math.floor(seed / 7) % medium.length), current: 0, completed: false },
    { ...pick(hard, Math.floor(seed / 49) % hard.length), current: 0, completed: false },
  );

  return selected;
}

export function useDailyMissions(
  userId: string | undefined,
  progress: {
    mealsLogged: number;
    proteinHit: boolean;
    allMacrosHit: boolean;
    caloriesUnder: boolean;
    mealsScheduled: number;
    waterGlasses: number;
    stepsCount: number;
    workoutCompleted: boolean;
    usedNewRestaurant: boolean;
  }
) {
  const [state, setState] = useState<DailyMissionsState>({
    missions: [],
    bonusXp: 0,
    bonusClaimed: false,
    allComplete: false,
  });
  const todaysMissionIds = useRef<string[]>([]);
  const loadedRef = useRef(false);
  const claimedRef = useRef(false);

  const today = new Date().toISOString().split("T")[0];

  const loadMissions = useCallback(async () => {
    if (!userId || loadedRef.current) return;

    const { data: existing } = await supabase
      .from("user_daily_missions")
      .select("missions, claimed_bonus")
      .eq("user_id", userId)
      .eq("mission_date", today)
      .maybeSingle();

    let missions: Mission[];
    let claimed = false;

    if (existing?.missions && Array.isArray(existing.missions) && existing.missions.length > 0) {
      missions = (existing.missions as unknown as (Omit<Mission, "current" | "completed"> & { current?: number; completed?: boolean })[]).map(m => ({
        ...m,
        current: m.current || 0,
        completed: m.completed || false,
      }));
      claimed = existing.claimed_bonus || false;
    } else {
      missions = getDailyMissions(userId, today);

      await supabase.from("user_daily_missions").upsert({
        user_id: userId,
        mission_date: today,
        missions: serializeMissions(missions),
        claimed_bonus: false,
      }, { onConflict: "user_id,mission_date" });
    }

    todaysMissionIds.current = missions.map(m => m.id);
    loadedRef.current = true;
    claimedRef.current = claimed;

    setState({ missions, bonusXp: 150, bonusClaimed: claimed, allComplete: missions.every(m => m.completed) });
  }, [userId, today]);

  useEffect(() => {
    loadMissions();
  }, [loadMissions]);

  useEffect(() => {
    if (!userId || state.missions.length === 0) return;

    const updated = state.missions.map(m => {
      const updatedMission = { ...m };

      switch (m.id) {
        case "log_meals":
          updatedMission.current = progress.mealsLogged;
          updatedMission.completed = progress.mealsLogged >= m.target;
          break;
        case "drink_water":
          updatedMission.current = progress.waterGlasses;
          updatedMission.completed = progress.waterGlasses >= m.target;
          break;
        case "walk_steps":
          updatedMission.current = progress.stepsCount;
          updatedMission.completed = progress.stepsCount >= m.target;
          break;
        case "calorie_budget":
          updatedMission.current = progress.caloriesUnder ? 1 : 0;
          updatedMission.completed = progress.caloriesUnder;
          break;
        case "protein_goal":
          updatedMission.current = progress.proteinHit ? 1 : 0;
          updatedMission.completed = progress.proteinHit;
          break;
        case "workout_session":
          updatedMission.current = progress.workoutCompleted ? 1 : 0;
          updatedMission.completed = progress.workoutCompleted;
          break;
        case "new_restaurant":
          updatedMission.current = progress.usedNewRestaurant ? 1 : 0;
          updatedMission.completed = progress.usedNewRestaurant;
          break;
        case "perfect_day":
          updatedMission.current = progress.allMacrosHit ? 1 : 0;
          updatedMission.completed = progress.allMacrosHit;
          break;
        case "no_skip":
          updatedMission.current = progress.mealsScheduled > 0 ? (m.current + (progress.mealsScheduled >= 3 ? 3 : progress.mealsScheduled)) : m.current;
          updatedMission.completed = m.completed || (progress.mealsScheduled >= 3);
          break;
      }

      return updatedMission;
    });

    const changed = updated.some((m, i) => m.completed !== state.missions[i]?.completed);
    const allDone = updated.every(m => m.completed);

    if (changed) {
      setState(prev => ({ ...prev, missions: updated, allComplete: allDone }));

      void Promise.resolve(supabase.from("user_daily_missions").upsert({
        user_id: userId,
        mission_date: today,
        missions: serializeMissions(updated),
        claimed_bonus: claimedRef.current,
      }, { onConflict: "user_id,mission_date" })).catch((error) => {
        console.error("Failed to persist daily mission progress:", error);
      });
    }
  }, [userId, today, progress.mealsLogged, progress.proteinHit, progress.allMacrosHit, progress.caloriesUnder, progress.waterGlasses, progress.stepsCount, progress.workoutCompleted, progress.usedNewRestaurant, progress.mealsScheduled]);

  const claimBonus = useCallback(async () => {
    if (!userId || !state.allComplete || state.bonusClaimed || claimedRef.current) return false;

    claimedRef.current = true;
    setState(prev => ({ ...prev, bonusClaimed: true }));

    await supabase.from("user_daily_missions").upsert({
      user_id: userId,
      mission_date: today,
      missions: serializeMissions(state.missions),
      claimed_bonus: true,
    }, { onConflict: "user_id,mission_date" });

    return true;
  }, [userId, today, state.missions, state.allComplete, state.bonusClaimed]);

  return { ...state, claimBonus };
}
