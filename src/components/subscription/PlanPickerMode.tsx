import { useNavigate } from "react-router-dom";
import { ArrowLeft, Zap, BadgePercent } from "lucide-react";
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
    <div className="min-h-screen bg-[#f6fbf7] pb-28 pt-safe">
      <header className="sticky top-0 z-40 border-b border-emerald-900/5 bg-[#f6fbf7]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-4 rtl:flex-row-reverse">
          <button
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-emerald-950 shadow-sm transition-transform active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="truncate text-base font-extrabold tracking-tight text-emerald-950">{t("choose_plan")}</h1>
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-4 px-4 pt-4">
        <div className="rounded-[28px] bg-[#103f32] px-5 py-6 text-white shadow-[0_18px_45px_rgba(16,63,50,0.20)]">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/10">
              <Zap className="h-4 w-4 text-[#6de3c4]" />
            </span>
            <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-emerald-100">
              {t("start_your_journey")}
            </span>
          </div>
          <h2 className="text-[22px] font-black leading-tight">{t("fuel_your_health")}</h2>
          <p className="mt-2 text-sm font-medium leading-relaxed text-white/70">{t("plan_hero_desc")}</p>
        </div>

        <div className="rounded-[24px] border border-emerald-200/80 bg-white px-4 py-4 shadow-sm">
          <BillingIntervalToggle
            value={billingInterval}
            onChange={onBillingIntervalChange}
            savingsPercent={17}
          />
        </div>

        {billingInterval === "annual" && (
          <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-[#fff8ed] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100">
              <BadgePercent className="h-4 w-4 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-emerald-950">{t("save_17_percent_banner")}</p>
              <p className="truncate text-xs font-medium text-emerald-950/55">
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
