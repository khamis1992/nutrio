import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Crown, TrendingUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/hooks/useSubscription";

const NEXT_TIER: Record<string, string> = {
  basic: "standard",
  standard: "premium",
  premium: "vip",
  vip: "",
};

const TIER_LABELS: Record<string, string> = {
  basic: "Standard",
  standard: "Premium",
  premium: "VIP",
  vip: "",
};

const TIER_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  standard: { bg: "bg-blue-50", text: "text-blue-700", icon: "text-blue-500" },
  premium: { bg: "bg-amber-50", text: "text-amber-700", icon: "text-amber-500" },
  vip: { bg: "bg-purple-50", text: "text-purple-700", icon: "text-purple-500" },
};

export function SubscriptionNudge() {
  const {
    subscription,
    loading,
    remainingMeals,
    totalMeals,
    mealsUsed,
    isUnlimited,
    isVip,
    hasActiveSubscription,
    tier,
  } = useSubscription();

  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);

  const storageKey = subscription
    ? `nutrio_nudge_dismissed_${subscription.id}_${subscription.month_start_date}`
    : "";

  useEffect(() => {
    if (!subscription || !hasActiveSubscription || isUnlimited) {
      setVisible(false);
      return;
    }
    const wasDismissed = localStorage.getItem(storageKey) === "1";
    setDismissed(wasDismissed);
    // Delay visibility for animation
    const timer = setTimeout(() => !wasDismissed && setVisible(true), 3000);
    return () => clearTimeout(timer);
  }, [subscription, hasActiveSubscription, isUnlimited, storageKey]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    localStorage.setItem(storageKey, "1");
    setDismissed(true);
  }, [storageKey]);

  // No nudge conditions: loading, no subscription, VIP/unlimited, already dismissed
  if (loading || !subscription || !hasActiveSubscription || isUnlimited || !visible) return null;

  const nextTier = NEXT_TIER[tier];
  if (!nextTier) return null; // no upgrade path (already VIP)

  const now = new Date();
  const cycleStart = new Date(subscription.month_start_date);
  const cycleEnd = new Date(subscription.end_date);
  const daysInCycle = Math.max(1, Math.ceil((cycleEnd.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24)));
  const daysElapsed = Math.max(1, Math.ceil((now.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24)));
  const daysRemaining = Math.max(1, daysInCycle - daysElapsed);
  const burnRate = mealsUsed / daysElapsed;
  const exhaustionDay = burnRate > 0 ? Math.ceil(remainingMeals / burnRate) : Infinity;
  const cyclePct = Math.round((daysElapsed / daysInCycle) * 100);
  const usagePct = Math.round((mealsUsed / totalMeals) * 100);

  // ── Nudge thresholds ────────────────────────────────────────────────────

  type NudgeLevel = "critical" | "high" | "moderate" | null;

  let level: NudgeLevel = null;

  if (remainingMeals <= 0) {
    level = "critical";
  } else if (remainingMeals <= 3 && daysRemaining >= 5) {
    level = "critical";
  } else if (exhaustionDay < daysRemaining && exhaustionDay <= 5) {
    level = "critical";
  } else if (usagePct > 75 && cyclePct < 60) {
    level = "high";
  } else if (usagePct > 70 && cyclePct < 50) {
    level = "moderate";
  }

  if (!level) return null;

  // ── Copy ────────────────────────────────────────────────────────────────

  const copy = {
    critical: {
      title: remainingMeals <= 0 ? "Out of meals!" : "Almost out of meals!",
      message: remainingMeals <= 0
        ? "You've used all your meals. Upgrade now to keep eating."
        : `Only ${remainingMeals} meal${remainingMeals > 1 ? "s" : ""} left with ${daysRemaining} day${daysRemaining > 1 ? "s" : ""} to go — upgrade to keep going.`,
    },
    high: {
      title: "Burning through meals fast",
      message: `You've used ${usagePct}% of your meals but only ${cyclePct}% through the month. Upgrade for more meals.`,
    },
    moderate: {
      title: "Running ahead of schedule",
      message: `At this pace, you'll use all ${totalMeals} meals before the month ends. Consider upgrading.`,
    },
  };

  const tierLabel = TIER_LABELS[tier];
  const tierColor = TIER_COLORS[nextTier] || TIER_COLORS.premium;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div
      className={cn(
        "relative rounded-2xl shadow-sm border p-4 transition-all duration-300 animate-in slide-in-from-top-4",
        level === "critical"
          ? "border-red-200 bg-red-50/80"
          : level === "high"
            ? "border-amber-200 bg-amber-50/80"
            : "border-blue-100 bg-blue-50/60",
      )}
    >
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200/50 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
            level === "critical"
              ? "bg-red-100"
              : level === "high"
                ? "bg-amber-100"
                : "bg-blue-100",
          )}
        >
          {level === "critical" ? (
            <TrendingUp className="w-5 h-5 text-red-500" />
          ) : (
            <Crown className={cn("w-5 h-5", tierColor.icon)} />
          )}
        </div>

        <div className="flex-1 min-w-0 pr-6">
          <h4
            className={cn(
              "text-sm font-bold mb-0.5",
              level === "critical" ? "text-red-700" : level === "high" ? "text-amber-700" : "text-blue-700",
            )}
          >
            {copy[level].title}
          </h4>
          <p className="text-xs text-gray-500 leading-relaxed mb-3">
            {copy[level].message}
          </p>

          {/* Usage bar */}
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400">
                {mealsUsed}/{totalMeals} meals used
              </span>
              <span className="text-gray-400">
                {daysRemaining}d left
              </span>
            </div>
            <div className="h-1.5 bg-gray-200/60 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  level === "critical" ? "bg-red-500" : level === "high" ? "bg-amber-500" : "bg-blue-500",
                )}
                style={{ width: `${Math.min(100, usagePct)}%` }}
              />
            </div>
          </div>

          {/* CTA */}
          <Link
            to="/subscription"
            className={cn(
              "inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all active:scale-[0.97]",
              level === "critical"
                ? "bg-red-500 text-white hover:bg-red-600"
                : level === "high"
                  ? "bg-amber-500 text-white hover:bg-amber-600"
                  : "bg-blue-500 text-white hover:bg-blue-600",
            )}
          >
            Upgrade to {tierLabel}
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default SubscriptionNudge;
