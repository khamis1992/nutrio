import { type LucideIcon, Utensils, Apple, Check, ChevronRight } from "lucide-react";
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
    elite: isCurrentPlan ? "border-emerald-500" : "border-slate-100",
    healthy: isCurrentPlan ? "border-emerald-500" : "border-slate-100",
    vip: isCurrentPlan ? "border-emerald-500" : "border-slate-100",
    default: isCurrentPlan ? "border-emerald-500" : "border-slate-100",
  }[cardVariant];

  const iconBgClass = {
    elite: "bg-amber-100",
    healthy: "bg-emerald-100",
    vip: "bg-amber-100",
    default: plan.tier === "fresh" ? "bg-emerald-50" : "bg-emerald-100",
  }[cardVariant];

  const iconColorClass = {
    elite: "text-amber-600",
    healthy: "text-emerald-600",
    vip: "text-amber-600",
    default: "text-primary",
  }[cardVariant];

  const canSelect = Boolean(onSelect && !isCurrentPlan);
  const handleSelect = () => {
    if (canSelect) onSelect?.();
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[22px] border bg-white shadow-[0_10px_26px_rgba(15,23,42,0.055)] transition-all duration-200",
        borderClass,
        isCurrentPlan && "shadow-emerald-500/10",
        canSelect && "cursor-pointer active:scale-[0.985] hover:shadow-[0_14px_32px_rgba(15,23,42,0.08)]",
        className
      )}
      onClick={handleSelect}
    >
      <div className="p-4 pb-3">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full", iconBgClass)}>
            <Icon className={cn("h-6 w-6", iconColorClass)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="font-bold text-foreground truncate">{plan.name}</h3>
              {badge.text && cardVariant === "healthy" && (
                <span className={cn("shrink-0 inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full", badge.className)}>
                  <Check className="h-2.5 w-2.5" />
                  {badge.text}
                </span>
              )}
            </div>
            {plan.description && (
              <p className="mt-0.5 line-clamp-1 text-xs font-medium text-slate-500">{plan.description}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-extrabold leading-tight text-slate-950">{formatCurrency(plan.price)}</p>
            <p className="text-xs font-medium text-slate-500">/{plan.period}</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-slate-700" />
        </div>
      </div>

      <div className={cn(
        "mx-4 mb-4 flex min-h-10 items-center justify-between gap-3 rounded-2xl px-4 py-2.5",
        isCurrentPlan ? "bg-emerald-50" : "bg-slate-50"
      )}>
        <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-600">
          <Utensils className="h-4 w-4 shrink-0 text-emerald-500" />
          <span className="truncate">{plan.mealsPerMonth === 0 ? "Unlimited meals" : `${plan.mealsPerMonth} meals/month`}</span>
        </div>
        {plan.snacksPerMonth > 0 && (
          <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-600">
            <Apple className="h-4 w-4 shrink-0 text-orange-500" />
            <span className="truncate">+{plan.snacksPerMonth} snacks/month</span>
          </div>
        )}
        {isCurrentPlan && (
          <span className="ml-auto shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-600">
            Current Plan
          </span>
        )}
      </div>
    </div>
  );
}
