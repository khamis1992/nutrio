import { useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useBadgeChecker(userId: string | undefined) {
  const checkedRef = useRef(false);

  const checkAndAwardBadges = useCallback(async () => {
    if (!userId || checkedRef.current) return;
    checkedRef.current = true;

    try {
      const today = new Date().toISOString().split("T")[0];
      const { data: existing } = await supabase.from("user_badges").select("badge_id").eq("user_id", userId);
      const earned = new Set((existing || []).map((b: any) => b.badge_id));

      const [
        { data: profile },
        { data: mealSchedules },
        { data: waterLogs },
        { data: orders },
      ] = await Promise.all([
        supabase.from("profiles").select("user_id, level, target_weight, weight, protein_target_g").eq("user_id", userId).single(),
        supabase.from("meal_schedules").select("meal_id, order_status, meals(name)").eq("user_id", userId).limit(200),
        supabase.from("water_entries").select("amount_ml, log_date").eq("user_id", userId).gte("log_date", new Date(Date.now() - 14 * 86400000).toISOString().split("T")[0]),
        supabase.from("user_orders_view").select("restaurant_id, restaurant_name").eq("user_id", userId).limit(100),
      ]);

      const newBadges: Array<{ badge_id: string; xp_reward: number }> = [];

      // Salad Sampler — 5 different salads ordered
      if (!earned.has("salad_sampler")) {
        const saladMeals = new Set(
          (mealSchedules || [])
            .filter((m: any) => m.order_status === "delivered" && m.meals?.name?.toLowerCase().includes("salad"))
            .map((m: any) => m.meal_id)
        );
        if (saladMeals.size >= 5) {
          newBadges.push({ badge_id: "salad_sampler", xp_reward: 50 });
        }
      }

      // Protein King — 30 days hitting protein target
      if (!earned.has("protein_king")) {
        const target = profile?.protein_target_g || 150;
        const { data: logs } = await supabase.from("progress_logs").select("protein_consumed_g, log_date").eq("user_id", userId).order("log_date", { ascending: false }).limit(30);
        if (logs && logs.length >= 30 && logs.every((l: any) => (l.protein_consumed_g || 0) >= target)) {
          newBadges.push({ badge_id: "protein_king", xp_reward: 200 });
        }
      }

      // Hydration Hero — 14 days of 8+ glasses (2000ml+)
      if (!earned.has("hydration_hero")) {
        const dailyWater = new Map<string, number>();
        for (const w of waterLogs || []) {
          dailyWater.set(w.log_date, (dailyWater.get(w.log_date) || 0) + (w.amount_ml || 0));
        }
        const hitDays = [...dailyWater.values()].filter(ml => ml >= 2000).length;
        if (hitDays >= 14) {
          newBadges.push({ badge_id: "hydration_hero", xp_reward: 100 });
        }
      }

      // Explorer — orders from 10 different restaurants
      if (!earned.has("explorer")) {
        const restaurants = new Set((orders || []).map((o: any) => o.restaurant_id));
        if (restaurants.size >= 10) {
          newBadges.push({ badge_id: "explorer", xp_reward: 100 });
        }
      }

      // Goal Crusher — reached weight goal
      if (!earned.has("goal_crusher") && profile?.target_weight && profile?.weight) {
        if (profile.weight <= profile.target_weight) {
          newBadges.push({ badge_id: "goal_crusher", xp_reward: 500 });
        }
      }

      // Streak 30 — 30-day logging streak (handled by celebrate hook already for 7/14/30)
      const { data: streakData } = await supabase.from("user_streaks").select("current_streak").eq("user_id", userId).eq("streak_type", "logging").single();
      if (!earned.has("streak_30") && streakData?.current_streak >= 30) {
        newBadges.push({ badge_id: "streak_30", xp_reward: 300 });
      }

      // Nutrio Royalty — Level 50
      if (!earned.has("nutrio_royalty") && (profile?.level || 1) >= 50) {
        newBadges.push({ badge_id: "nutrio_royalty", xp_reward: 1000 });
      }

      for (const badge of newBadges) {
        await supabase.from("user_badges").insert({
          user_id: userId,
          badge_id: badge.badge_id,
          unlocked_at: new Date().toISOString(),
        });

        const { data: b } = await supabase.from("badges").select("name, description, xp_reward").eq("id", badge.badge_id).single();

        const { data: prof } = await supabase.from("profiles").select("xp").eq("user_id", userId).single();
        const newXp = (prof?.xp || 0) + (b?.xp_reward || badge.xp_reward);
        const newLevel = Math.floor(newXp / 100) + 1;
        await supabase.from("profiles").update({ xp: newXp, level: newLevel }).eq("user_id", userId);

        toast.success(`${b?.name || badge.badge_id} Unlocked!`, {
          description: `+${b?.xp_reward || badge.xp_reward} XP — ${b?.description || ""}`,
          duration: 4000,
        });
      }
    } catch (err) {
      console.error("Badge checker error:", err);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) checkAndAwardBadges();
  }, [userId, checkAndAwardBadges]);

  return { checkAndAwardBadges };
}
