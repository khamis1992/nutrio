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
      className: "bg-amber-400 text-emerald-950",
    },
    healthy: {
      text: "BEST VALUE",
      className: "bg-[#24b893] text-white",
    },
    vip: {
      text: "VIP ELITE",
      className: "bg-amber-400 text-emerald-950",
    },
    default: {
      text: "",
      className: "",
    },
  }[cardVariant];

  const borderClass = {
    elite: isCurrentPlan ? "border-[#24b893]" : "border-emerald-200/80",
    healthy: isCurrentPlan ? "border-[#24b893]" : "border-emerald-200/80",
    vip: isCurrentPlan ? "border-[#24b893]" : "border-emerald-200/80",
    default: isCurrentPlan ? "border-[#24b893]" : "border-emerald-200/80",
  }[cardVariant];

  const iconBgClass = {
    elite: "bg-amber-100",
    healthy: "bg-[#eefaf6]",
    vip: "bg-amber-100",
    default: "bg-[#eefaf6]",
  }[cardVariant];

  const iconColorClass = {
    elite: "text-amber-600",
    healthy: "text-[#12856c]",
    vip: "text-amber-600",
    default: "text-[#12856c]",
  }[cardVariant];

  const canSelect = Boolean(onSelect && !isCurrentPlan);
  const handleSelect = () => {
    if (canSelect) onSelect?.();
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[24px] border bg-white shadow-sm transition-all duration-200",
        borderClass,
        isCurrentPlan && "bg-[#fbfffd] shadow-[#24b893]/10",
        canSelect && "cursor-pointer active:scale-[0.985] hover:shadow-md",
        className
      )}
      onClick={handleSelect}
    >
      <div className="p-4 pb-3">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", iconBgClass)}>
            <Icon className={cn("h-6 w-6", iconColorClass)} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate font-black text-emerald-950">{plan.name}</h3>
              {badge.text && (
                <span className={cn("inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[9px] font-black", badge.className)}>
                  <Check className="h-2.5 w-2.5" />
                  {badge.text}
                </span>
              )}
            </div>
            {plan.description && (
              <p className="mt-0.5 line-clamp-1 text-xs font-medium text-emerald-950/50">{plan.description}</p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-lg font-black leading-tight text-emerald-950">{formatCurrency(plan.price)}</p>
            <p className="text-xs font-semibold text-emerald-950/50">/{plan.period}</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-emerald-950/40" />
        </div>
      </div>

      <div className={cn(
        "mx-4 mb-4 flex min-h-11 items-center justify-between gap-3 rounded-2xl px-4 py-2.5",
        isCurrentPlan ? "bg-[#e6f8f2]" : "bg-[#f6fbf7]"
      )}>
        <div className="flex min-w-0 items-center gap-2 text-xs font-bold text-emerald-950/65">
          <Utensils className="h-4 w-4 shrink-0 text-[#24b893]" />
          <span className="truncate">{plan.mealsPerMonth === 0 ? "Unlimited meals" : `${plan.mealsPerMonth} meals/month`}</span>
        </div>
        {plan.snacksPerMonth > 0 && (
          <div className="flex min-w-0 items-center gap-2 text-xs font-bold text-emerald-950/65">
            <Apple className="h-4 w-4 shrink-0 text-orange-500" />
            <span className="truncate">+{plan.snacksPerMonth} snacks/month</span>
          </div>
        )}
        {isCurrentPlan && (
          <span className="ml-auto shrink-0 rounded-full bg-white px-3 py-1 text-xs font-extrabold text-[#12856c]">
            Current Plan
          </span>
        )}
      </div>
    </div>
  );
}
