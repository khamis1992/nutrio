import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Utensils, ChevronRight } from "lucide-react";
import { useCreditDashboard } from "@/hooks/useCreditDashboard";
import { fadeInUp, spring } from "@/lib/animations";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

interface ProgressRingProps {
  percentage: number;
  remaining: number | string;
  size?: number;
  strokeWidth?: number;
  label: string;
}

function ProgressRing({ percentage, remaining, size = 96, strokeWidth = 8, label }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;

  const colorClass =
    percentage > 50
      ? "text-emerald-500"
      : percentage >= 20
        ? "text-warning"
        : "text-destructive";

  const bgClass =
    percentage > 50
      ? "text-emerald-100"
      : percentage >= 20
        ? "text-warning/15"
        : "text-destructive/15";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={bgClass}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={colorClass}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut", ...spring }}
          style={{
            strokeDasharray: circumference,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-lg font-bold leading-none", colorClass)}>{remaining}</span>
        <span className="text-[10px] text-muted-foreground mt-0.5">{label}</span>
      </div>
    </div>
  );
}

export function CreditDashboard() {
  const { t } = useLanguage();
  const {
    remainingMeals,
    totalMeals,
    mealsUsed,
    rolloverCredits,
    totalAvailable,
    percentage,
    isLowCredit,
    isUnlimited,
    hasActiveSubscription,
    loading,
  } = useCreditDashboard();

  if (loading) {
    return (
      <motion.div variants={fadeInUp}>
        <Card className="rounded-2xl border border-border bg-card shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-full bg-muted animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (!hasActiveSubscription) {
    return (
      <motion.div variants={fadeInUp}>
        <Link to="/subscription/plans">
          <Card className="rounded-2xl border border-primary/20 bg-primary/5 shadow-sm cursor-pointer hover:bg-primary/10 transition-colors">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Utensils className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {t("credit_start_subscription") || "Start Your Subscription"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("credit_subscribe_desc") || "Subscribe now and get healthy meals daily"}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-primary shrink-0" />
            </CardContent>
          </Card>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div variants={fadeInUp} className="space-y-3">
      <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <ProgressRing
              percentage={percentage}
              remaining={isUnlimited ? "∞" : remainingMeals}
              label={t("credit_remaining") || "remaining"}
            />
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {t("credit_month_balance") || "Month Balance"}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {isUnlimited ? "∞" : `${remainingMeals} / ${totalMeals}`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {t("credit_rollover") || "Rollover Credit"}
                </span>
                <span className="text-sm font-semibold text-emerald-600">
                  {isUnlimited ? "—" : `+${rolloverCredits}`}
                </span>
              </div>
              <div className="border-t border-border pt-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {t("credit_total_available") || "Total Available"}
                </span>
                <span className="text-sm font-bold text-foreground">
                  {isUnlimited ? (t("unlimited") || "Unlimited") : totalAvailable}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLowCredit && !isUnlimited && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
        >
          <Link to="/subscription/plans">
            <Card className="rounded-2xl border border-warning/20 bg-warning/10 shadow-sm cursor-pointer hover:bg-warning/15 transition-colors">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-warning/20 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-warning">
                    {t("credit_low_alert") || "⚠️ Your balance is low! Consider ordering more"}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-warning shrink-0" />
              </CardContent>
            </Card>
          </Link>
        </motion.div>
      )}
    </motion.div>
  );
}
