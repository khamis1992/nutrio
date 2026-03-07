import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
  tier: 'basic' | 'standard' | 'premium' | 'vip';
  active: boolean | null;
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
  isUnlimited: boolean;
  isVip: boolean;
  canOrderMeal: boolean;
  incrementMealUsage: () => Promise<boolean>;
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
      // Fetch active, pending, or cancelled (not yet expired) subscriptions
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id, plan, status, start_date, end_date, meals_per_month, meals_used_this_month, month_start_date, meals_per_week, meals_used_this_week, week_start_date, tier, active")
        .eq("user_id", user.id)
        .or(`status.in.("active","pending"),and(status.eq."cancelled",end_date.gte.${today})`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSubscription({
          id: data.id!,
          plan: data.plan!,
          status: data.status!,
          start_date: data.start_date!,
          end_date: data.end_date!,
          meals_per_month: data.meals_per_month ?? 0,
          meals_used_this_month: data.meals_used_this_month ?? 0,
          month_start_date: data.month_start_date || new Date().toISOString().split('T')[0],
          meals_per_week: data.meals_per_week ?? 5,
          meals_used_this_week: data.meals_used_this_week ?? 0,
          week_start_date: data.week_start_date || new Date().toISOString().split('T')[0],
          tier: (data.tier || data.plan) as 'basic' | 'standard' | 'premium' | 'vip' || 'basic',
          active: data.active,
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

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // User has an active subscription if status is active OR if cancelled but not yet expired
  const hasActiveSubscription: boolean = Boolean(
    subscription?.status === "active" || 
    (subscription?.status === "cancelled" && subscription?.end_date && new Date(subscription.end_date) >= new Date())
  );
  const isPaused: boolean = subscription?.status === "pending";
  const isVip = subscription?.tier === "vip";
  
  // VIP tier gets unlimited meals (meals_per_month = 0)
  const isUnlimited = subscription?.tier === "vip" || subscription?.meals_per_month === 0;
  
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

  const incrementMealUsage = async (): Promise<boolean> => {
    if (!subscription || !canOrderMeal) return false;

    try {
      // Use the new monthly increment function
      const { data, error } = await (supabase as unknown as { rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: boolean | null; error: Error | null }> }).rpc("increment_monthly_meal_usage", {
        p_subscription_id: subscription.id,
      });

      if (error) throw error;

      if (data) {
        // Refetch to get updated values
        await fetchSubscription();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Error incrementing meal usage:", err);
      return false;
    }
  };

  const pauseSubscription = async (): Promise<boolean> => {
    if (!subscription || !hasActiveSubscription) return false;

    try {
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: "pending" })
        .eq("id", subscription.id);

      if (error) throw error;

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
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: "active" })
        .eq("id", subscription.id);

      if (error) throw error;

      await fetchSubscription();
      return true;
    } catch (err) {
      console.error("Error resuming subscription:", err);
      return false;
    }
  };

  return {
    subscription,
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
    isUnlimited,
    isVip,
    canOrderMeal,
    incrementMealUsage,
    pauseSubscription,
    resumeSubscription,
    refetch: fetchSubscription,
  };
};
