import { useLanguage } from "@/contexts/LanguageContext";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronDown, ChevronUp, Crown, Zap, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency";
import { calculateAnnualPrice } from "@/components/BillingIntervalToggle";
import type { DbSubscriptionPlan } from "@/hooks/useSubscriptionPlans";

const TIER_DISPLAY: Record<string, { en: string; ar: string; icon: typeof Zap }> = {
  elite:   { en: "Nutrio Elite",   ar: "نخبة نوتريو",   icon: Crown },
  healthy: { en: "Healthy Balance", ar: "توازن صحي",     icon: Zap },
  fresh:   { en: "Fresh Start",     ar: "بداية منعشة",   icon: Star },
  weekly:  { en: "Weekly Boost",    ar: "دفعة أسبوعية",  icon: Zap },
};

interface PlanComparisonTableProps {
  plans: DbSubscriptionPlan[];
  currentTier?: string;
  billingInterval: "monthly" | "annual";
  onBillingIntervalChange: (interval: "monthly" | "annual") => void;
}

function planHasFeature(plan: DbSubscriptionPlan, keywords: string[]): boolean {
  return plan.features?.some(f =>
    keywords.some(k => f.toLowerCase().includes(k.toLowerCase()))
  ) ?? false;
}

function getMealTypes(plan: DbSubscriptionPlan): string {
  const parts: string[] = [];
  if (planHasFeature(plan, ["breakfast"])) parts.push("Breakfast");
  if (planHasFeature(plan, ["lunch"])) parts.push("Lunch");
  if (planHasFeature(plan, ["dinner"])) parts.push("Dinner");
  if (plan.snacks_per_month > 0 || planHasFeature(plan, ["snack"])) parts.push("Snacks");
  if (parts.length === 0) parts.push("Main meals");
  return parts.join(", ");
}

export function PlanComparisonTable({
  plans,
  currentTier,
  billingInterval,
  onBillingIntervalChange,
}: PlanComparisonTableProps) {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpanded = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getDisplay = (plan: DbSubscriptionPlan) =>
    TIER_DISPLAY[plan.tier] || { en: plan.tier, ar: plan.name_ar || plan.tier, icon: Zap };

  const getPrice = (plan: DbSubscriptionPlan) =>
    billingInterval === "annual"
      ? calculateAnnualPrice(plan.price_qar)
      : plan.price_qar;

  interface FeatureRow {
    key: string;
    label: string;
    collapsible?: boolean;
    detail?: string;
    render: (plan: DbSubscriptionPlan) => React.ReactNode;
  }

  const featureRows: FeatureRow[] = [
    {
      key: "price",
      label: "Price",
      collapsible: true,
      detail: billingInterval === "annual"
        ? "Annual billing saves you 17%"
        : "Monthly billing",
      render: (plan) => {
        const price = getPrice(plan);
        const period = billingInterval === "annual" ? "year" : "month";
        return (
          <div>
            <p className="text-lg font-extrabold text-foreground">{formatCurrency(price)}</p>
            <p className="text-[11px] text-muted-foreground">/{period}</p>
          </div>
        );
      },
    },
    {
      key: "meals",
      label: "Meals per week / month",
      render: (plan) => (
        <div>
          <p className="text-sm font-semibold text-foreground">
            {plan.meals_per_week || Math.round(plan.meals_per_month / 4)} <span className="text-muted-foreground font-normal">/ week</span>
          </p>
          <p className="text-sm font-semibold text-foreground">
            {plan.meals_per_month} <span className="text-muted-foreground font-normal">/ month</span>
          </p>
        </div>
      ),
    },
    {
      key: "mealTypes",
      label: "Meal types included",
      render: (plan) => {
        const types = getMealTypes(plan);
        return <span className="text-sm text-foreground font-medium">{types}</span>;
      },
    },
    {
      key: "vipMeals",
      label: "VIP meals access",
      render: (plan) => {
        const hasVip = plan.tier === "elite" || planHasFeature(plan, ["vip", "premium meal"]);
        return hasVip ? (
          <Check className="h-4 w-4 text-emerald-500" />
        ) : (
          <span className="text-sm text-muted-foreground">&mdash;</span>
        );
      },
    },
    {
      key: "rollover",
      label: "Rollover credits",
      collapsible: true,
      detail: "Unused meals roll over to the next month",
      render: (plan) => {
        const hasRollover = planHasFeature(plan, ["rollover", "carry", "unused"])
          || plan.tier === "elite" || plan.tier === "healthy";
        return hasRollover ? (
          <Check className="h-4 w-4 text-emerald-500" />
        ) : (
          <span className="text-sm text-muted-foreground">&mdash;</span>
        );
      },
    },
    {
      key: "prioritySupport",
      label: "Priority support",
      render: (plan) => {
        const hasPriority = planHasFeature(plan, ["priority", "dedicated", "concierge"]);
        return hasPriority ? (
          <Check className="h-4 w-4 text-emerald-500" />
        ) : (
          <span className="text-sm text-muted-foreground">&mdash;</span>
        );
      },
    },
    {
      key: "customization",
      label: "Customization options",
      collapsible: true,
      detail: "Personalized meal preferences and dietary adjustments",
      render: (plan) => {
        const hasCustom = planHasFeature(plan, ["custom", "personalize", "tailored", "dietary"]);
        return hasCustom ? (
          <span className="text-sm text-foreground font-medium">Full</span>
        ) : (
          <span className="text-sm text-foreground font-medium">Basic</span>
        );
      },
    },
    {
      key: "freeDelivery",
      label: "Free delivery",
      render: (plan) => {
        const hasFreeDelivery = planHasFeature(plan, ["delivery", "free delivery", "shipping"]);
        return hasFreeDelivery ? (
          <Check className="h-4 w-4 text-emerald-500" />
        ) : (
          <span className="text-sm text-muted-foreground">&mdash;</span>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2 bg-muted/50 p-1 rounded-2xl">
        <button
          onClick={() => onBillingIntervalChange("monthly")}
          className={cn(
            "flex-1 py-2 px-4 rounded-xl text-sm font-semibold transition-all",
            billingInterval === "monthly"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Monthly
        </button>
        <button
          onClick={() => onBillingIntervalChange("annual")}
          className={cn(
            "flex-1 py-2 px-4 rounded-xl text-sm font-semibold transition-all",
            billingInterval === "annual"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span className="flex items-center justify-center gap-1.5">
            Annual
            <Badge variant="success" className="text-[10px] px-1 py-0 h-4">Save 17%</Badge>
          </span>
        </button>
      </div>

      <div className="overflow-x-auto -mx-4 px-4 pb-2">
        <table className="w-full min-w-[500px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-background text-left py-3 pr-4 min-w-[120px]">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Features
                </span>
              </th>
              {plans.map((plan) => {
                const display = getDisplay(plan);
                const Icon = display.icon;
                const isCurrent = currentTier === plan.tier;
                return (
                  <th key={plan.id} className="text-center py-3 px-3 min-w-[140px]">
                    <div className={cn(
                      "rounded-2xl p-3",
                      isCurrent && "bg-primary/5 border border-primary/20"
                    )}>
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Icon className="h-3.5 w-3.5 text-primary" />
                        <p className="text-xs font-bold text-foreground">{language === "ar" ? display.ar : display.en}</p>
                      </div>
                      {isCurrent && (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 mb-1">
                          Current
                        </Badge>
                      )}
                      <p className="text-[10px] text-muted-foreground">{display.ar}</p>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {featureRows.map((row, rowIdx) => (
              <tr
                key={row.key}
                className={cn(
                  "border-t border-border/40",
                  rowIdx % 2 === 0 && "bg-muted/20"
                )}
              >
                <td className="sticky left-0 z-10 bg-inherit py-3 pr-4">
                  {row.collapsible ? (
                    <button
                      onClick={() => toggleExpanded(row.key)}
                      className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors text-left"
                    >
                      {row.label}
                      {expanded[row.key] ? (
                        <ChevronUp className="h-3 w-3 shrink-0" />
                      ) : (
                        <ChevronDown className="h-3 w-3 shrink-0" />
                      )}
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-muted-foreground">
                      {row.label}
                    </span>
                  )}
                  {row.collapsible && expanded[row.key] && row.detail && (
                    <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                      {row.detail}
                    </p>
                  )}
                </td>
                {plans.map((plan) => (
                  <td key={plan.id} className="text-center py-3 px-3 align-middle">
                    {row.render(plan)}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t border-border/40">
              <td className="sticky left-0 z-10 bg-background py-3 pr-4">
                <span className="text-xs font-semibold text-muted-foreground">&nbsp;</span>
              </td>
              {plans.map((plan) => {
                const isCurrent = currentTier === plan.tier;
                return (
                  <td key={plan.id} className="text-center py-3 px-3">
                    {isCurrent ? (
                      <Badge variant="outline" className="text-xs font-semibold">
                        Current Plan
                      </Badge>
                    ) : (
                      <Button
                        variant={plan.tier === "elite" ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "rounded-xl text-xs font-bold w-full",
                          plan.tier === "elite" && "bg-primary hover:bg-primary/90"
                        )}
                        onClick={() => navigate(`/checkout?type=subscription&planId=${plan.id}`)}
                      >
                        {currentTier ? "Upgrade" : "Select"}
                      </Button>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
