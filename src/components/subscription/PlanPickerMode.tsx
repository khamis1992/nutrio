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
    <div className="min-h-screen bg-[#F6F8FB] pb-28 pt-safe text-[#020617]">
      <header className="sticky top-0 z-40 border-b border-[#E5EAF1] bg-[#F6F8FB]/92 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-4 rtl:flex-row-reverse">
          <button
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#020617] shadow-sm ring-1 ring-[#E5EAF1] transition-transform active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="truncate text-base font-extrabold tracking-tight text-[#020617]">{t("choose_plan")}</h1>
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-4 px-4 pt-4">
        <div className="rounded-[28px] bg-white px-5 py-6 text-[#020617] shadow-[0_18px_45px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#E6FBF5] ring-1 ring-[#BFF4E6]">
              <Zap className="h-4 w-4 text-[#22C7A1]" />
            </span>
            <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#22C7A1]">
              {t("start_your_journey")}
            </span>
          </div>
          <h2 className="text-[22px] font-black leading-tight">{t("fuel_your_health")}</h2>
          <p className="mt-2 text-sm font-medium leading-relaxed text-[#94A3B8]">{t("plan_hero_desc")}</p>
        </div>

        <div className="rounded-[24px] bg-white px-4 py-4 shadow-sm ring-1 ring-[#E5EAF1]">
          <BillingIntervalToggle
            value={billingInterval}
            onChange={onBillingIntervalChange}
            savingsPercent={17}
          />
        </div>

        {billingInterval === "annual" && (
          <div className="flex items-center gap-3 rounded-2xl bg-[#FFF1F3] px-4 py-3 ring-1 ring-[#FFD3DA]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#FB6B7A]">
              <BadgePercent className="h-4 w-4 text-[#FB6B7A]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-[#020617]">{t("save_17_percent_banner")}</p>
              <p className="truncate text-xs font-medium text-[#94A3B8]">
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
