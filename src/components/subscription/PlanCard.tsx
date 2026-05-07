import { Check, type LucideIcon, Utensils, Apple, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency";

export interface PlanCardData {
  id: string;
  name: string;
  description: string;
  price: number;
  period: string;
  mealsPerMonth: number;
  snacksPerMonth: number;
  dailyMeals: number;
  dailySnacks: number;
  tier: string;
  features: string[];
  popular: boolean;
  isVip: boolean;
  color: string;
  icon: LucideIcon;
}

interface PlanCardProps {
  plan: PlanCardData;
  isCurrentPlan?: boolean;
  billingInterval?: "monthly" | "annual";
  onSelect?: () => void;
  variant?: "picker" | "upgrade";
  className?: string;
}

type CardVariant = "elite" | "healthy" | "vip" | "default";

function getCardVariant(plan: PlanCardData, billingInterval?: string): CardVariant {
  if (plan.isVip) return "vip";
  if (plan.popular) return "elite";
  if (plan.tier === "healthy") return "healthy";
  if (billingInterval === "annual") return "default";
  return "default";
}

export function PlanCard({
  plan,
  isCurrentPlan,
  billingInterval,
  onSelect,
  variant = "picker",
  className,
}: PlanCardProps) {
  const Icon = plan.icon;
  const cardVariant = getCardVariant(plan, billingInterval);

  const buttonText = isCurrentPlan
    ? "Current Plan"
    : plan.price > 0
    ? variant === "picker" ? "Get Started" : "Upgrade"
    : "Get Started";

  const isUpgrade = variant === "upgrade" && !isCurrentPlan;
  const hasBadge = cardVariant !== "default" && !(billingInterval === "annual" && cardVariant === "default");

  const badge = {
    elite: {
      text: "MOST POPULAR",
      className: "bg-primary text-primary-foreground",
    },
    healthy: {
      text: "BEST VALUE",
      className: "bg-gradient-to-r from-emerald-500 to-teal-500 text-white",
    },
    vip: {
      text: "VIP ELITE",
      className: "bg-gradient-to-r from-amber-500 to-orange-500 text-white",
    },
    default: {
      text: "",
      className: "",
    },
  }[cardVariant];

  const borderClass = {
    elite: isCurrentPlan ? "border-primary ring-1 ring-primary/20" : "border-primary shadow-md shadow-primary/10",
    healthy: isCurrentPlan ? "border-emerald-500 ring-1 ring-emerald-500/20" : "border-emerald-300 shadow-md shadow-emerald-500/10",
    vip: isCurrentPlan ? "border-amber-500 ring-1 ring-amber-500/20" : "border-amber-300 shadow-md shadow-amber-500/10",
    default: isCurrentPlan ? "border-primary ring-1 ring-primary/20" : "border-border/60",
  }[cardVariant];

  const iconBgClass = {
    elite: "bg-amber-100",
    healthy: "bg-emerald-100",
    vip: "bg-amber-100",
    default: "bg-primary/10",
  }[cardVariant];

  const iconColorClass = {
    elite: "text-amber-600",
    healthy: "text-emerald-600",
    vip: "text-amber-600",
    default: "text-primary",
  }[cardVariant];

  const statBadgeClass = {
    elite: "bg-amber-50",
    healthy: "bg-emerald-50",
    vip: "bg-amber-50",
    default: "bg-muted/60",
  }[cardVariant];

  const checkBgClass = {
    elite: "bg-primary/10",
    healthy: "bg-emerald-100",
    vip: "bg-amber-100",
    default: "bg-primary/10",
  }[cardVariant];

  const checkIconClass = {
    elite: "text-primary",
    healthy: "text-emerald-600",
    vip: "text-amber-600",
    default: "text-primary",
  }[cardVariant];

  const buttonClass = isCurrentPlan
    ? ""
    : {
        elite: "shadow-md shadow-primary/20",
        healthy: "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md shadow-emerald-500/20",
        vip: "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md shadow-amber-500/20",
        default: "",
      }[cardVariant];

  return (
    <div
      className={cn(
        "relative bg-card rounded-[24px] border-2 shadow-sm overflow-hidden transition-all duration-200",
        borderClass,
        cardVariant === "healthy" && !isCurrentPlan && "bg-gradient-to-b from-white to-emerald-50/30",
        onSelect && "cursor-pointer active:scale-[0.98] hover:shadow-lg",
        className
      )}
      onClick={onSelect}
    >
      {cardVariant === "healthy" && !isCurrentPlan && (
        <div className="absolute -top-[1px] -right-[1px] w-20 h-20 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-28 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[9px] font-bold text-center py-1 rotate-45 translate-x-[14px] translate-y-[10px] tracking-widest">
            BEST VALUE
          </div>
        </div>
      )}

      <div className={cn("p-5", cardVariant === "elite" && "pt-10")}>
        <div className="flex items-center gap-3 mb-4">
          <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm", iconBgClass, cardVariant === "healthy" && "ring-2 ring-emerald-200")}>
            <Icon className={cn("h-6 w-6", iconColorClass)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-foreground truncate">{plan.name}</h3>
              {cardVariant === "healthy" && (
                <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <Sparkles className="h-2.5 w-2.5" />
                  BEST VALUE
                </span>
              )}
            </div>
            {plan.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">{plan.description}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-bold text-foreground">{formatCurrency(plan.price)}</p>
            <p className="text-xs text-muted-foreground">/{plan.period}</p>
          </div>
        </div>

        {cardVariant === "healthy" && !isCurrentPlan && (
          <div className="bg-emerald-500/5 border border-emerald-200 rounded-xl px-3 py-2 mb-3 flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <p className="text-[11px] text-emerald-700 font-semibold">
              Best balance of price and features — most popular among our members
            </p>
          </div>
        )}

        <div className={cn("rounded-2xl px-3 py-2.5 mb-3", statBadgeClass)}>
          <div className="flex items-center gap-2">
            <Utensils className={cn("h-4 w-4 shrink-0", cardVariant === "healthy" ? "text-emerald-600" : "text-primary")} />
            <p className="text-sm font-semibold text-foreground">
              {plan.mealsPerMonth === 0 ? "Unlimited meals" : `${plan.mealsPerMonth} meals/month`}
            </p>
          </div>
          {plan.snacksPerMonth > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <Apple className={cn("h-4 w-4 shrink-0", cardVariant === "healthy" ? "text-emerald-500" : "text-amber-500")} />
              <p className="text-sm font-medium text-muted-foreground">
                +{plan.snacksPerMonth} snacks/month
              </p>
            </div>
          )}
        </div>

        <ul className="space-y-2 mb-4">
          {plan.features.slice(0, 3).map((feature, idx) => (
            <li key={idx} className="flex items-center gap-2.5">
              <div className={cn("w-4 h-4 rounded-full flex items-center justify-center shrink-0", checkBgClass)}>
                <Check className={cn("h-2.5 w-2.5", checkIconClass)} />
              </div>
              <span className="text-xs text-foreground line-clamp-1">{feature}</span>
            </li>
          ))}
          {plan.features.length > 3 && (
            <li className="text-[11px] text-muted-foreground pl-7 font-medium">
              +{plan.features.length - 3} more benefits
            </li>
          )}
        </ul>

        {onSelect && (
          <Button
            variant={isUpgrade ? "default" : isCurrentPlan ? "outline" : "default"}
            className={cn(
              "w-full rounded-2xl h-11 text-sm font-bold",
              !isCurrentPlan && buttonClass
            )}
            disabled={isCurrentPlan}
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
          >
            {buttonText}
          </Button>
        )}
      </div>
    </div>
  );
}
