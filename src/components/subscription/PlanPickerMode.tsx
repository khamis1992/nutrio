import { useNavigate } from "react-router-dom";
import { ArrowLeft, Zap, BadgePercent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BillingIntervalToggle, type BillingInterval } from "@/components/BillingIntervalToggle";
import { PlanCard, type PlanCardData } from "@/components/subscription/PlanCard";
import { useLanguage } from "@/contexts/LanguageContext";

interface PlanPickerModeProps {
  plans: PlanCardData[];
  billingInterval: BillingInterval;
  onBillingIntervalChange: (interval: BillingInterval) => void;
  vipAnnualSavings: number;
}

export function PlanPickerMode({
  plans,
  billingInterval,
  onBillingIntervalChange,
  vipAnnualSavings,
}: PlanPickerModeProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="px-4 pt-[env(safe-area-inset-top)] h-14 flex items-center gap-3 rtl:flex-row-reverse">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-muted/80 flex items-center justify-center hover:bg-muted active:scale-95 transition-all"
          >
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>
          <h1 className="text-base font-bold tracking-tight">{t("choose_plan")}</h1>
        </div>
      </header>

      <div className="px-4 pt-5 space-y-5">
        <div className="bg-gradient-to-br from-primary to-emerald-600 rounded-[28px] px-5 py-6 text-white shadow-lg shadow-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-white/80" />
            <span className="text-[11px] font-bold text-white/80 uppercase tracking-widest">
              {t("start_your_journey")}
            </span>
          </div>
          <h2 className="text-[22px] font-extrabold leading-tight mb-1">{t("fuel_your_health")}</h2>
          <p className="text-sm text-white/70 leading-relaxed">{t("plan_hero_desc")}</p>
        </div>

        <BillingIntervalToggle
          value={billingInterval}
          onChange={onBillingIntervalChange}
          savingsPercent={17}
        />

        {billingInterval === "annual" && (
          <div className="flex items-center gap-3 bg-primary/5 border border-primary/15 rounded-2xl px-4 py-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <BadgePercent className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{t("save_17_percent_banner")}</p>
              <p className="text-xs text-muted-foreground">
                {t("pay_annual_desc")} {vipAnnualSavings.toLocaleString()} QAR/yr
              </p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              billingInterval={billingInterval}
              variant="picker"
              onSelect={() => navigate("/subscription/plans")}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
