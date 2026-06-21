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
    <div className="min-h-screen bg-[#F6F7F4] pb-28 pt-safe text-slate-900">
      <header className="sticky top-0 z-40 border-b border-white/70 bg-[#F6F7F4]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-4 rtl:flex-row-reverse">
          <button
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200/80 transition-transform active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="truncate text-base font-extrabold tracking-tight text-slate-950">{t("choose_plan")}</h1>
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-4 px-4 pt-4">
        <div className="rounded-[28px] bg-white px-5 py-6 text-slate-950 shadow-[0_18px_45px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 ring-1 ring-emerald-100">
              <Zap className="h-4 w-4 text-emerald-600" />
            </span>
            <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-emerald-600">
              {t("start_your_journey")}
            </span>
          </div>
          <h2 className="text-[22px] font-black leading-tight">{t("fuel_your_health")}</h2>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">{t("plan_hero_desc")}</p>
        </div>

        <div className="rounded-[24px] bg-white px-4 py-4 shadow-sm ring-1 ring-slate-200/80">
          <BillingIntervalToggle
            value={billingInterval}
            onChange={onBillingIntervalChange}
            savingsPercent={17}
          />
        </div>

        {billingInterval === "annual" && (
          <div className="flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-100">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <BadgePercent className="h-4 w-4 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-950">{t("save_17_percent_banner")}</p>
              <p className="truncate text-xs font-medium text-slate-500">
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
