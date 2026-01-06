import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Subscription {
  id: string;
  plan: string;
  status: string;
  start_date: string;
  end_date: string;
  meals_per_week: number;
  meals_used_this_week: number;
  week_start_date: string;
}

interface UseSubscriptionReturn {
  subscription: Subscription | null;
  loading: boolean;
  hasActiveSubscription: boolean;
  isPaused: boolean;
  remainingMeals: number;
  isUnlimited: boolean;
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
      // Fetch active or paused subscription
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id, plan, status, start_date, end_date, meals_per_week, meals_used_this_week, week_start_date")
        .eq("user_id", user.id)
        .in("status", ["active", "pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSubscription({
          id: data.id,
          plan: data.plan,
          status: data.status,
          start_date: data.start_date,
          end_date: data.end_date,
          meals_per_week: data.meals_per_week || 5,
          meals_used_this_week: data.meals_used_this_week || 0,
          week_start_date: data.week_start_date || new Date().toISOString().split('T')[0],
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

  const hasActiveSubscription = subscription?.status === "active";
  const isPaused = subscription?.status === "pending";
  
  // 0 means unlimited
  const isUnlimited = subscription?.meals_per_week === 0;
  
  const remainingMeals = isUnlimited 
    ? Infinity 
    : (subscription?.meals_per_week || 0) - (subscription?.meals_used_this_week || 0);
  
  const canOrderMeal = hasActiveSubscription && (isUnlimited || remainingMeals > 0);

  const incrementMealUsage = async (): Promise<boolean> => {
    if (!subscription || !canOrderMeal) return false;

    try {
      const { data, error } = await supabase.rpc("increment_meal_usage", {
        subscription_id: subscription.id,
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
    isUnlimited,
    canOrderMeal,
    incrementMealUsage,
    pauseSubscription,
    resumeSubscription,
    refetch: fetchSubscription,
  };
};
