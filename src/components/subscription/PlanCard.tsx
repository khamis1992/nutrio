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
  className,
}: PlanCardProps) {
  const Icon = plan.icon;
  const cardVariant = getCardVariant(plan, billingInterval);

  const badge = {
    elite: {
      text: "MOST POPULAR",
      className: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
    },
    healthy: {
      text: "BEST VALUE",
      className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
    },
    vip: {
      text: "VIP ELITE",
      className: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
    },
    default: {
      text: "",
      className: "",
    },
  }[cardVariant];

  const borderClass = {
    elite: isCurrentPlan ? "ring-emerald-200" : "ring-slate-200/80",
    healthy: isCurrentPlan ? "ring-emerald-200" : "ring-slate-200/80",
    vip: isCurrentPlan ? "ring-emerald-200" : "ring-slate-200/80",
    default: isCurrentPlan ? "ring-emerald-200" : "ring-slate-200/80",
  }[cardVariant];

  const iconBgClass = {
    elite: "bg-amber-100",
    healthy: "bg-emerald-50",
    vip: "bg-amber-100",
    default: "bg-emerald-50",
  }[cardVariant];

  const iconColorClass = {
    elite: "text-amber-600",
    healthy: "text-emerald-600",
    vip: "text-amber-600",
    default: "text-emerald-600",
  }[cardVariant];

  const canSelect = Boolean(onSelect && !isCurrentPlan);
  const handleSelect = () => {
    if (canSelect) onSelect?.();
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 transition-all duration-200",
        borderClass,
        isCurrentPlan && "bg-emerald-50/40 shadow-emerald-500/10",
        canSelect && "cursor-pointer active:scale-[0.985] hover:shadow-md",
        className
      )}
      onClick={handleSelect}
    >
      <div className="p-4 pb-3">
        <div className="grid grid-cols-[48px_minmax(0,1fr)_auto_20px] items-center gap-3">
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", iconBgClass)}>
            <Icon className={cn("h-6 w-6", iconColorClass)} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <h3 className="min-w-0 max-w-full truncate text-[15px] font-black leading-tight text-slate-950 sm:text-base">{plan.name}</h3>
              {badge.text && (
                <span className={cn("inline-flex max-w-full shrink items-center gap-0.5 rounded-full px-2 py-0.5 text-[8px] font-black leading-none", badge.className)}>
                  <Check className="h-2.5 w-2.5" />
                  <span className="truncate">{badge.text}</span>
                </span>
              )}
            </div>
            {plan.description && (
              <p className="mt-0.5 line-clamp-1 text-xs font-medium text-slate-500">{plan.description}</p>
            )}
          </div>
          <div className="w-[96px] shrink-0 text-right">
            <p className="text-[17px] font-black leading-tight text-slate-950">{formatCurrency(plan.price)}</p>
            <p className="text-[11px] font-semibold leading-tight text-slate-400">/{plan.period}</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
        </div>
      </div>

      <div className={cn(
        "mx-4 mb-4 flex min-h-11 flex-wrap items-center gap-2 rounded-2xl px-3 py-2.5",
        isCurrentPlan ? "bg-emerald-50 ring-1 ring-emerald-100" : "bg-slate-50 ring-1 ring-slate-200/80"
      )}>
        <div className="flex min-w-0 flex-1 basis-[130px] items-center gap-2 text-xs font-bold text-slate-600">
          <Utensils className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="truncate">{plan.mealsPerMonth === 0 ? "Unlimited meals" : `${plan.mealsPerMonth} meals/month`}</span>
        </div>
        {plan.snacksPerMonth > 0 && (
          <div className="flex min-w-0 flex-1 basis-[130px] items-center gap-2 text-xs font-bold text-slate-600">
            <Apple className="h-4 w-4 shrink-0 text-orange-500" />
            <span className="truncate">+{plan.snacksPerMonth} snacks/month</span>
          </div>
        )}
        {isCurrentPlan && (
          <span className="ml-auto shrink-0 rounded-full bg-white px-3 py-1 text-[11px] font-extrabold text-emerald-700 ring-1 ring-emerald-100">
            Current Plan
          </span>
        )}
      </div>
    </div>
  );
}
