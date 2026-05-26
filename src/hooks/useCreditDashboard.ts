import { useMemo } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { useDashboardRolloverCredits } from "@/hooks/useDashboardRolloverCredits";
import { useAuth } from "@/contexts/AuthContext";

export interface CreditDashboardData {
  remainingMeals: number;
  totalMeals: number;
  mealsUsed: number;
  rolloverCredits: number;
  totalAvailable: number;
  percentage: number;
  isLowCredit: boolean;
  isUnlimited: boolean;
  hasActiveSubscription: boolean;
  loading: boolean;
}

export function useCreditDashboard(): CreditDashboardData {
  const { user } = useAuth();
  const {
    subscription,
    hasActiveSubscription,
    isUnlimited,
    remainingMeals,
    totalMeals,
    mealsUsed,
    loading: subLoading,
  } = useSubscription();

  const { rolloverCredits, loading: rolloverLoading } = useDashboardRolloverCredits(
    user?.id
  );

  const loading = subLoading || rolloverLoading;

  return useMemo(() => {
    if (!hasActiveSubscription || !subscription) {
      return {
        remainingMeals: 0,
        totalMeals: 0,
        mealsUsed: 0,
        rolloverCredits: 0,
        totalAvailable: 0,
        percentage: 0,
        isLowCredit: false,
        isUnlimited: false,
        hasActiveSubscription: false,
        loading,
      };
    }

    if (isUnlimited) {
      return {
        remainingMeals: Infinity,
        totalMeals: 0,
        mealsUsed: 0,
        rolloverCredits: 0,
        totalAvailable: Infinity,
        percentage: 100,
        isLowCredit: false,
        isUnlimited: true,
        hasActiveSubscription: true,
        loading,
      };
    }

    const effectiveRemaining = Math.max(0, remainingMeals);
    const effectiveTotal = Math.max(0, totalMeals);
    const effectiveRollover = Math.max(0, rolloverCredits);
    const totalAvailable = effectiveRemaining + effectiveRollover;

    const percentage =
      effectiveTotal > 0
        ? Math.round((effectiveRemaining / effectiveTotal) * 100)
        : 0;

    const isLowCredit = percentage < 20 && effectiveRemaining > 0;

    return {
      remainingMeals: effectiveRemaining,
      totalMeals: effectiveTotal,
      mealsUsed: mealsUsed ?? 0,
      rolloverCredits: effectiveRollover,
      totalAvailable,
      percentage,
      isLowCredit,
      isUnlimited: false,
      hasActiveSubscription: true,
      loading,
    };
  }, [
    hasActiveSubscription,
    subscription,
    isUnlimited,
    remainingMeals,
    totalMeals,
    mealsUsed,
    rolloverCredits,
    loading,
  ]);
}
