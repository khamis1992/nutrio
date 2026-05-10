import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getQatarDay } from "@/lib/dateUtils";

export interface Subscription {
  id: string;
  plan: string;
  status: string;
  start_date: string;
  end_date: string;
  meals_per_month: number;
  meals_used_this_month: number;
  month_start_date: string;
  meals_per_week: number;
  meals_used_this_week: number;
  week_start_date: string;
  snacks_per_month: number;
  snacks_used_this_month: number;
  tier: 'basic' | 'standard' | 'premium' | 'vip';
  active: boolean | null;
}

type IncrementMonthlyMealUsageResult = boolean;
type UseRolloverCreditResult = { used_rollover?: boolean };

interface Database {
  rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>;
}

interface UseSubscriptionReturn {
  subscription: Subscription | null;
  loading: boolean;
  hasActiveSubscription: boolean;
  isPaused: boolean;
  remainingMeals: number;
  totalMeals: number;
  mealsUsed: number;
  // Weekly values for display
  remainingMealsWeekly: number;
  totalMealsWeekly: number;
  mealsUsedWeekly: number;
  // Snack balance
  snacksPerMonth: number;
  snacksUsed: number;
  remainingSnacks: number;
  hasSnacks: boolean;
  isUnlimited: boolean;
  isVip: boolean;
  canOrderMeal: boolean;
  incrementMealUsage: () => Promise<boolean>;
  incrementSnackUsage: () => Promise<boolean>;
  pauseSubscription: () => Promise<boolean>;
  resumeSubscription: () => Promise<boolean>;
  refetch: () => Promise<void>;
}

export const useSubscription = (): UseSubscriptionReturn => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      const today = getQatarDay();
      const selectCols = "id, plan, status, start_date, end_date, meals_per_month, meals_used_this_month, month_start_date, meals_per_week, meals_used_this_week, week_start_date, tier, active, snacks_per_month, snacks_used_this_month";
      const { data: activeOrPending, error: activeError } = await supabase
        .from("subscriptions")
        .select(selectCols)
        .eq("user_id", user.id)
        .in("status", ["active", "pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeError) throw activeError;

      let data = activeOrPending;

      if (!data) {
        const { data: cancelledData, error: cancelledError } = await supabase
          .from("subscriptions")
          .select(selectCols)
          .eq("user_id", user.id)
          .eq("status", "cancelled")
          .gte("end_date", today)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelledError) throw cancelledError;
        data = cancelledData;
      }

      if (data) {
        type SubscriptionRow = {
          id: string; plan: string; meals_per_month: number; meals_per_week: number;
          billing_interval: string; price_qar: number; status: string;
          current_period_start: string | null; current_period_end: string | null;
          cancel_at_period_end: boolean; daily_meal_quota: number; snacks_per_month: number;
          snacks_used_this_month: number; stripe_subscription_id: string | null;
          created_at: string; updated_at: string; plan_id: string | null;
        };
        const row = data as unknown as SubscriptionRow;
        const snacksPerMonth = row.snacks_per_month ?? 0;
        const snacksUsedThisMonth = row.snacks_used_this_month ?? 0;

        setSubscription({
          id: row.id,
          plan: row.plan,
          status: row.status,
          start_date: row.start_date,
          end_date: row.end_date,
          meals_per_month: row.meals_per_month ?? 0,
          meals_used_this_month: row.meals_used_this_month ?? 0,
          month_start_date: row.month_start_date || getQatarDay(),
          meals_per_week: row.meals_per_week ?? 5,
          meals_used_this_week: row.meals_used_this_week ?? 0,
          week_start_date: row.week_start_date || getQatarDay(),
          snacks_per_month: snacksPerMonth,
          snacks_used_this_month: snacksUsedThisMonth,
          tier: (row.tier || row.plan || 'basic') as 'basic' | 'standard' | 'premium' | 'vip',
          active: row.active,
        });
      } else {
        setSubscription(null);
      }
    } catch (err) {
      console.error("Error fetching subscription:", err);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial fetch
  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Real-time: re-fetch whenever the user's subscription row changes in DB
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`subscription_rt_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subscriptions",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchSubscription();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchSubscription]);

  // Refetch when app returns to foreground (works on both web and Capacitor APK)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchSubscription();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [fetchSubscription]);

  // User has an active subscription if status is active OR if cancelled but not yet expired
  const hasActiveSubscription: boolean = Boolean(
    subscription?.status === "active" || 
    (subscription?.status === "cancelled" && subscription?.end_date && new Date(subscription.end_date) >= new Date())
  );
  const isPaused: boolean = subscription?.status === "pending";
  const isVip = subscription?.tier === "vip";
  
  // VIP tier gets unlimited meals
  // Note: "pending" status means both "awaiting activation" AND "paused" — disambiguate with subscription.active
  const isUnlimited = subscription?.tier === "vip";
  
  // Use monthly values for calculations
  const totalMeals = isUnlimited ? 0 : (subscription?.meals_per_month || 0);
  const mealsUsed = subscription?.meals_used_this_month || 0;
  const remainingMeals = isUnlimited
    ? Infinity
    : Math.max(0, totalMeals - mealsUsed);

  // Weekly values for display (more intuitive for users)
  const totalMealsWeekly = subscription?.meals_per_week || 0;
  const mealsUsedWeekly = subscription?.meals_used_this_week || 0;
  const remainingMealsWeekly = isUnlimited
    ? Infinity
    : Math.max(0, totalMealsWeekly - mealsUsedWeekly);

  const canOrderMeal = hasActiveSubscription && (isUnlimited || remainingMeals > 0);

  // Snack balance
  const snacksPerMonth = subscription?.snacks_per_month ?? 0;
  const snacksUsed = subscription?.snacks_used_this_month ?? 0;
  const remainingSnacks = isUnlimited ? Infinity : Math.max(0, snacksPerMonth - snacksUsed);
  const hasSnacks = snacksPerMonth > 0 || isUnlimited;

  const incrementSnackUsage = async (): Promise<boolean> => {
    if (!subscription || !hasActiveSubscription || !hasSnacks) return false;
    if (!isUnlimited && remainingSnacks <= 0) return false;

    try {
      const { error } = await (supabase as Database).rpc("increment_snack_usage", {
        p_subscription_id: subscription.id,
      }) as { data: boolean; error: Error | null };

      if (error) {
        console.warn("Snack RPC not available, falling back to direct update:", error);
        const { error: fallbackError } = await supabase
          .from("subscriptions")
          .update({ snacks_used_this_month: snacksUsed + 1 } as Record<string, number>)
          .eq("id", subscription.id);

        if (fallbackError) throw fallbackError;
      }

      await fetchSubscription();
      return true;
    } catch (err) {
      console.error("Error incrementing snack usage:", err);
      return false;
    }
  };

  const incrementMealUsage = async (): Promise<boolean> => {
    if (!subscription || !hasActiveSubscription) return false;

    try {
      // If monthly quota is still available — use it (don't touch rollover)
      if (canOrderMeal) {
        const { data, error } = await (supabase as Database).rpc("increment_monthly_meal_usage", {
          p_subscription_id: subscription.id,
        }) as { data: IncrementMonthlyMealUsageResult; error: Error | null };
        if (error) throw error;
        if (data) {
          await fetchSubscription();
          return true;
        }
        return false;
      }

      // Monthly quota exhausted — try rollover credits as bonus meals
      const { data: rolloverData, error: rolloverError } = await (supabase as Database).rpc(
        "use_rollover_credit_if_available",
        { p_subscription_id: subscription.id, p_user_id: user!.id }
      ) as { data: UseRolloverCreditResult; error: Error | null };

      if (rolloverError) {
        console.error("Rollover check failed:", rolloverError);
        return false;
      }

      const used = (rolloverData as { used_rollover?: boolean })?.used_rollover ?? false;
      if (used) {
        await fetchSubscription();
        return true;
      }

      // No monthly meals and no rollover credits
      return false;
    } catch (err) {
      console.error("Error incrementing meal usage:", err);
      return false;
    }
  };

  const pauseSubscription = async (): Promise<boolean> => {
    if (!subscription || !hasActiveSubscription) return false;

    try {
      const { error } = await (supabase as Database).rpc("pause_subscription", {
        p_subscription_id: subscription.id,
      }) as { data: boolean; error: Error | null };

      if (error) {
        console.warn("pause_subscription RPC not available, falling back to direct update:", error);
        const { error: fallbackError } = await supabase
          .from("subscriptions")
          .update({ status: "pending" })
          .eq("id", subscription.id);

        if (fallbackError) throw fallbackError;
      }

      await fetchSubscription();
      return true;
    } catch (err) {
      console.error("Error pausing subscription:", err);
      return false;
    }
  };

  const resumeSubscription = async (): Promise<boolean> => {
    if (!subscription || !isPaused) return false;

    try {
      const { error } = await (supabase as Database).rpc("resume_subscription", {
        p_subscription_id: subscription.id,
      }) as { data: boolean; error: Error | null };

      if (error) {
        console.warn("resume_subscription RPC not available, falling back to direct update:", error);
        const { error: fallbackError } = await supabase
          .from("subscriptions")
          .update({ status: "active" })
          .eq("id", subscription.id);

        if (fallbackError) throw fallbackError;
      }

      await fetchSubscription();
      return true;
    } catch (err) {
      console.error("Error resuming subscription:", err);
      return false;
    }
  };

  const stableSubscription = useMemo(() => subscription, [subscription]);

  return {
    subscription: stableSubscription,
    loading,
    hasActiveSubscription,
    isPaused,
    remainingMeals,
    totalMeals,
    mealsUsed,
    // Weekly values for display
    remainingMealsWeekly,
    totalMealsWeekly,
    mealsUsedWeekly,
    // Snack balance
    snacksPerMonth,
    snacksUsed,
    remainingSnacks,
    hasSnacks,
    isUnlimited,
    isVip,
    canOrderMeal,
    incrementMealUsage,
    incrementSnackUsage,
    pauseSubscription,
    resumeSubscription,
    refetch: fetchSubscription,
  };
};
