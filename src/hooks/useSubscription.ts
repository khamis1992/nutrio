import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getQatarDay } from "@/lib/dateUtils";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";

export interface Subscription {
  id: string;
  plan: string;
  status: string;
  start_date: string;
  end_date: string;
  meals_per_month: number;
  meals_used_this_month: number;
  month_start_date: string | null;
  meals_per_week: number;
  meals_used_this_week: number;
  week_start_date: string | null;
  snacks_per_month: number;
  snacks_used_this_month: number;
  price: number;
  price_per_meal: number | null;
  billing_interval: string | null;
  auto_renew: boolean | null;
  tier: 'basic' | 'standard' | 'premium' | 'vip';
  active: boolean | null;
}

interface UseSubscriptionReturn {
  subscription: Subscription | null;
  loading: boolean;
  error: Error | null;
  hasActiveSubscription: boolean;
  isExpired: boolean;
  isPaused: boolean;
  remainingMeals: number;
  totalMeals: number;
  mealsUsed: number;
  remainingMealsWeekly: number;
  totalMealsWeekly: number;
  mealsUsedWeekly: number;
  snacksPerMonth: number;
  snacksUsed: number;
  remainingSnacks: number;
  hasSnacks: boolean;
  isUnlimited: boolean;
  isVip: boolean;
  tier: 'basic' | 'standard' | 'premium' | 'vip';
  canOrderMeal: boolean;
  incrementMealUsage: () => Promise<boolean>;
  incrementSnackUsage: () => Promise<boolean>;
  pauseSubscription: () => Promise<boolean>;
  resumeSubscription: () => Promise<boolean>;
  refetch: () => Promise<void>;
}

const SUBSCRIPTION_KEY = "subscription";

async function fetchSub(userId: string): Promise<Subscription | null> {
  const today = getQatarDay();
  // Freeze transitions are synchronized server-side. Keeping this query read-only
  // also allows the client to work while newer subscription migrations roll out.
  const cols = "id, plan, status, start_date, end_date, meals_per_month, meals_used_this_month, month_start_date, meals_per_week, meals_used_this_week, week_start_date, tier, active, snacks_per_month, snacks_used_this_month, price, billing_interval, auto_renew";

  const { data: activeOrPending, error: activeError } = await supabase
    .from("subscriptions")
    .select(cols)
    .eq("user_id", userId)
    .in("status", ["active", "pending", "expired"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeError) throw activeError;

  let data = activeOrPending;

  if (!data) {
    const { data: cancelledData, error: cancelledError } = await supabase
      .from("subscriptions")
      .select(cols)
      .eq("user_id", userId)
      .eq("status", "cancelled")
      .gte("end_date", today)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cancelledError) throw cancelledError;
    data = cancelledData;
  }

  if (!data) return null;

  return {
    id: data.id,
    plan: data.plan ?? data.tier ?? "basic",
    status: data.status ?? "expired",
    start_date: data.start_date ?? today,
    end_date: data.end_date ?? today,
    meals_per_month: data.meals_per_month ?? 0,
    meals_used_this_month: data.meals_used_this_month ?? 0,
    month_start_date: data.month_start_date || null,
    meals_per_week: data.meals_per_week ?? 0,
    meals_used_this_week: data.meals_used_this_week ?? 0,
    week_start_date: data.week_start_date || null,
    snacks_per_month: data.snacks_per_month ?? 0,
    snacks_used_this_month: data.snacks_used_this_month ?? 0,
    price: data.price ?? 0,
    price_per_meal: null,
    billing_interval: data.billing_interval,
    auto_renew: data.auto_renew,
    tier: (data.tier || data.plan || 'basic') as 'basic' | 'standard' | 'premium' | 'vip',
    active: data.active,
  };
}

export const useSubscription = (): UseSubscriptionReturn => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const queryKey = useMemo(() => [SUBSCRIPTION_KEY, userId] as const, [userId]);

  const { data: subscription, isLoading: loading, error } = useQuery({
    queryKey,
    queryFn: () => fetchSub(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  useRealtimeTable("subscriptions", {
    event: "*",
    filter: userId ? `user_id=eq.${userId}` : undefined,
    enabled: !!userId,
    onChange: () => queryClient.invalidateQueries({ queryKey }),
  });

  const refetch = useCallback(
    () => queryClient.invalidateQueries({ queryKey }),
    [queryClient, queryKey]
  );

  const hasActiveSubscription: boolean = Boolean(
    subscription?.status === "active" ||
    (subscription?.status === "cancelled" && subscription?.end_date && new Date(subscription.end_date) >= new Date())
  );

  const isExpired: boolean = subscription?.status === "expired";
  const isPaused: boolean = subscription?.status === "pending";
  const isVip = subscription?.tier === "vip";
  const isUnlimited = subscription?.tier === "vip";

  const totalMeals = isUnlimited ? 0 : (subscription?.meals_per_month || 0);
  const mealsUsed = subscription?.meals_used_this_month || 0;
  const remainingMeals = isUnlimited ? Infinity : Math.max(0, totalMeals - mealsUsed);

  const totalMealsWeekly = subscription?.meals_per_week || 0;
  const mealsUsedWeekly = subscription?.meals_used_this_week || 0;
  const remainingMealsWeekly = isUnlimited ? Infinity : Math.max(0, totalMealsWeekly - mealsUsedWeekly);

  const canOrderMeal = hasActiveSubscription && (isUnlimited || remainingMeals > 0);

  const snacksPerMonth = subscription?.snacks_per_month ?? 0;
  const snacksUsed = subscription?.snacks_used_this_month ?? 0;
  const remainingSnacks = isUnlimited ? Infinity : Math.max(0, snacksPerMonth - snacksUsed);
  const hasSnacks = snacksPerMonth > 0 || isUnlimited;

  const incrementMealUsage = useCallback(async (): Promise<boolean> => {
    if (!subscription || !hasActiveSubscription) return false;

    try {
      if (canOrderMeal) {
        const { data, error } = await supabase.rpc("increment_monthly_meal_usage", {
          p_subscription_id: subscription.id,
        });
        if (error) throw error;
        if (data) { refetch(); return true; }
        return false;
      }

      const { data: rolloverData, error: rolloverError } = await supabase.rpc(
        "use_rollover_credit_if_available",
        { p_subscription_id: subscription.id, p_user_id: userId! }
      );

      if (rolloverError) { console.error("Rollover check failed:", rolloverError); return false; }

      const used = (rolloverData as { used_rollover?: boolean })?.used_rollover ?? false;
      if (used) { refetch(); return true; }
      return false;
    } catch (err) {
      console.error("Error incrementing meal usage:", err);
      return false;
    }
  }, [subscription, hasActiveSubscription, canOrderMeal, userId, refetch]);

  const incrementSnackUsage = useCallback(async (): Promise<boolean> => {
    if (!subscription || !hasActiveSubscription || !hasSnacks) return false;
    if (!isUnlimited && remainingSnacks <= 0) return false;

    try {
      const { error } = await supabase.rpc("increment_snack_usage", { p_subscription_id: subscription.id });
      if (error) throw error;

      refetch();
      return true;
    } catch (err) {
      console.error("Error incrementing snack usage:", err);
      return false;
    }
  }, [subscription, hasActiveSubscription, hasSnacks, isUnlimited, remainingSnacks, refetch]);

  const pauseSubscription = useCallback(async (): Promise<boolean> => {
    if (!subscription || !hasActiveSubscription) return false;

    try {
      const { data, error } = await supabase.rpc("pause_subscription", { p_subscription_id: subscription.id });
      if (error) throw error;
      if (!data) return false;
      refetch();
      return true;
    } catch (err) {
      console.error("Error pausing subscription:", err);
      return false;
    }
  }, [subscription, hasActiveSubscription, refetch]);

  const resumeSubscription = useCallback(async (): Promise<boolean> => {
    if (!subscription || !isPaused) return false;

    try {
      const { data, error } = await supabase.rpc("resume_subscription", { p_subscription_id: subscription.id });
      if (error) throw error;
      if (!data) return false;
      refetch();
      return true;
    } catch (err) {
      console.error("Error resuming subscription:", err);
      return false;
    }
  }, [subscription, isPaused, refetch]);

  const stableSub = useMemo(() => subscription ?? null, [subscription]);

  return {
    subscription: stableSub,
    loading,
    error: error instanceof Error ? error : null,
    hasActiveSubscription,
    isExpired,
    isPaused,
    remainingMeals,
    totalMeals,
    mealsUsed,
    remainingMealsWeekly,
    totalMealsWeekly,
    mealsUsedWeekly,
    snacksPerMonth,
    snacksUsed,
    remainingSnacks,
    hasSnacks,
    isUnlimited,
    isVip,
    tier: (subscription?.tier || 'basic') as 'basic' | 'standard' | 'premium' | 'vip',
    canOrderMeal,
    incrementMealUsage,
    incrementSnackUsage,
    pauseSubscription,
    resumeSubscription,
    refetch,
  };
};
