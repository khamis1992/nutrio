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
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

      const { data: existing } = await supabase.from("user_badges").select("badge_id").eq("user_id", userId);
      const earned = new Set((existing || []).map((b: any) => b.badge_id));

      const [
        { data: profile },
        { data: mealSchedules },
        { data: waterLogs },
        { data: orders },
        { data: calorieLogs },
        { data: subscriptions },
        { data: userProfile },
      ] = await Promise.all([
        supabase.from("profiles").select("user_id, level").eq("user_id", userId).single(),
        supabase.from("meal_schedules").select("meal_id, order_status, meals(name)").eq("user_id", userId).limit(200),
        supabase.from("water_entries").select("amount_ml, log_date").eq("user_id", userId).gte("log_date", new Date(Date.now() - 14 * 86400000).toISOString().split("T")[0]),
        supabase.from("user_orders_view").select("restaurant_id, restaurant_name").eq("user_id", userId).limit(100),
        supabase.from("progress_logs").select("calories_consumed, log_date").eq("user_id", userId).gte("log_date", thirtyDaysAgo).order("log_date", { ascending: false }),
        supabase.from("subscriptions").select("start_date, status").eq("user_id", userId).neq("status", "cancelled").order("start_date", { ascending: true }),
        supabase.from("profiles").select("level").eq("user_id", userId).single(),
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
        const target = 150; // protein_target_g not yet in profiles table
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

      // Variety King — same as explorer (10 restaurants), separate badge
      if (!earned.has("variety_king")) {
        const restaurants = new Set((orders || []).map((o: any) => o.restaurant_id));
        if (restaurants.size >= 10) {
          newBadges.push({ badge_id: "variety_king", xp_reward: 200 });
        }
      }

      // Nutrition Ninja — hit calorie goal 5 days in a row
      if (!earned.has("nutrition_ninja")) {
        const calorieTarget = profile?.daily_calorie_target || 2000;
        if (calorieLogs && calorieLogs.length >= 5) {
          const dailyCals = new Map<string, number>();
          for (const l of calorieLogs || []) {
            const current = dailyCals.get(l.log_date) || 0;
            dailyCals.set(l.log_date, current + (l.calories_consumed || 0));
          }
          let consecutiveDays = 0;
          for (const [_, total] of dailyCals) {
            if (total >= calorieTarget) {
              consecutiveDays++;
              if (consecutiveDays >= 5) break;
            } else {
              consecutiveDays = 0;
            }
          }
          if (consecutiveDays >= 5) {
            newBadges.push({ badge_id: "nutrition_ninja", xp_reward: 150 });
          }
        }
      }

      // Goal Crusher — reached weight goal
      if (!earned.has("goal_crusher") && profile?.target_weight && profile?.weight) {
        if (profile.weight <= profile.target_weight) {
          newBadges.push({ badge_id: "goal_crusher", xp_reward: 500 });
        }
      }

      // Streak 30 — 30-day logging streak
      const { data: streakData } = await supabase.from("user_streaks").select("current_streak").eq("user_id", userId).eq("streak_type", "logging").single();
      if (!earned.has("streak_30") && streakData?.current_streak >= 30) {
        newBadges.push({ badge_id: "streak_30", xp_reward: 300 });
      }

      // Social Butterfly — 3 referrals who subscribed
      if (!earned.has("social_butterfly")) {
        const referralCount = profile?.referral_rewards_earned || userProfile?.referral_rewards_earned || 0;
        if (referralCount >= 3) {
          newBadges.push({ badge_id: "social_butterfly", xp_reward: 250 });
        }
      }

      // Subscription Hero — 6 months subscribed
      if (!earned.has("subscription_hero")) {
        const activeSubs = subscriptions || [];
        if (activeSubs.length > 0) {
          const earliestStart = new Date(activeSubs[0].start_date);
          const monthsDiff = (new Date().getFullYear() - earliestStart.getFullYear()) * 12 + (new Date().getMonth() - earliestStart.getMonth());
          if (monthsDiff >= 6) {
            newBadges.push({ badge_id: "subscription_hero", xp_reward: 400 });
          }
        }
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

        const { data: prof } = await supabase.from("profiles").select("level").eq("user_id", userId).single();
        const currentXp = 0; // xp column not yet available
        const newXp = currentXp + (b?.xp_reward || badge.xp_reward);
        const newLevel = Math.floor(newXp / 100) + 1;
        try { await supabase.from("profiles").update({ level: newLevel }).eq("user_id", userId); } catch {}

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
