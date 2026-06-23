import { Activity, ArrowLeft, Dumbbell, HeartPulse, Moon, RefreshCw, UtensilsCrossed } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useHealthDailyMetrics } from "@/hooks/useHealthDailyMetrics";
import { useHealthKitIntegration } from "@/hooks/useHealthKitIntegration";
import { EXTERNAL_HEALTH_PROVIDERS, getProviderStatusKey } from "@/lib/health-integrations";
import {
  buildReadinessFoodTip,
  calculateBodyLoad,
  calculateHealthBaseline,
  calculateRecoveryReadiness,
  getRecoveryPlanKey,
} from "@/lib/health-readiness";
import { cn } from "@/lib/utils";

export default function RecoveryInsights() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, isRTL } = useLanguage();
  const { metrics, rangeMetrics } = useHealthDailyMetrics(user?.id, undefined, 14);
  const { platform, isConnected, isSyncing, syncData } = useHealthKitIntegration();

  const readiness = calculateRecoveryReadiness(metrics);
  const load = calculateBodyLoad(metrics);
  const baseline = calculateHealthBaseline(rangeMetrics);
  const planKey = getRecoveryPlanKey(baseline, readiness, load);
  const foodTipKey = buildReadinessFoodTip(readiness, load);
  const readinessTrend = rangeMetrics.map((item) => calculateRecoveryReadiness(item).score ?? 0).slice(-14);
  const loadTrend = rangeMetrics.map((item) => calculateBodyLoad(item).score).slice(-14);

  const statCards = [
    {
      label: t("avg_readiness"),
      value: baseline.avgReadiness === null ? "--" : `${baseline.avgReadiness}`,
      sub: t("last_14_days"),
      icon: HeartPulse,
      tone: "bg-[#F3F4FF] text-[#7C83F6]",
    },
    {
      label: t("body_load"),
      value: `${baseline.avgBodyLoad}`,
      sub: t("body_load_21_scale"),
      icon: Activity,
      tone: "bg-[#EFFFFA] text-[#22C7A1]",
    },
    {
      label: t("sleep"),
      value: baseline.avgSleepMinutes === null ? "--" : `${Math.floor(baseline.avgSleepMinutes / 60)}h ${baseline.avgSleepMinutes % 60}m`,
      sub: t("avg_sleep"),
      icon: Moon,
      tone: "bg-[#EFF9FF] text-[#38BDF8]",
    },
    {
      label: t("recovery_debt"),
      value: `${baseline.recoveryDebt}`,
      sub: t("lower_is_better"),
      icon: RefreshCw,
      tone: "bg-[#FFF7ED] text-[#F97316]",
    },
  ];

  return (
    <main className="min-h-screen bg-[#F6F8FB] pb-28 text-[#020617]" dir={isRTL ? "rtl" : "ltr"}>
      <div className="sticky top-0 z-30 border-b border-[#E5EAF1] bg-[#F6F8FB]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[430px] items-center gap-3 px-4 pt-[env(safe-area-inset-top)]">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#020617] ring-1 ring-[#E5EAF1]"
            aria-label={t("go_back")}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7C83F6]">{t("recovery")}</p>
            <h1 className="truncate text-[24px] font-black tracking-[-0.04em] text-[#020617]">{t("recovery_insights")}</h1>
          </div>
          <button
            type="button"
            onClick={() => syncData()}
            disabled={!isConnected || isSyncing}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#020617] text-white disabled:opacity-45"
            aria-label={t("sync_now")}
          >
            <RefreshCw className={cn("h-5 w-5", isSyncing && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-[430px] space-y-4 px-4 pt-4">
        <section className="overflow-hidden rounded-[30px] bg-white shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-[#E5EAF1]">
          <div className="flex items-start justify-between gap-4 border-b border-[#E5EAF1] p-5">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#22C7A1]">{t("today")}</p>
              <h2 className="mt-1 text-[28px] font-black leading-tight tracking-[-0.05em] text-[#020617]">{t(readiness.labelKey)}</h2>
              <p className="mt-2 text-[13px] font-semibold leading-5 text-[#64748B]">{t(readiness.detailKey)}</p>
            </div>
            <div className="grid h-[82px] w-[82px] shrink-0 place-items-center rounded-full bg-[#020617] text-white ring-8 ring-[#F6F8FB]">
              <div className="text-center">
                <p className="text-[28px] font-black leading-none">{readiness.score ?? "--"}</p>
                <p className="mt-1 text-[9px] font-black uppercase tracking-wide text-white/70">{t("score")}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px bg-[#E5EAF1]">
            <div className="bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-wide text-[#94A3B8]">{t("body_load")}</p>
              <p className="mt-2 text-[30px] font-black text-[#020617]">{load.score}<span className="ml-1 text-[12px] text-[#94A3B8]">/21</span></p>
              <p className="text-[12px] font-bold text-[#64748B]">{t(load.detailKey)}</p>
            </div>
            <div className="bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-wide text-[#94A3B8]">{t("recovery_plan")}</p>
              <p className="mt-2 text-[15px] font-black leading-5 text-[#020617]">{t(planKey)}</p>
              <p className="mt-1 text-[12px] font-bold text-[#64748B]">{t(foodTipKey)}</p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          {statCards.map(({ label, value, sub, icon: Icon, tone }) => (
            <div key={label} className="rounded-[24px] bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", tone)}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-4 text-[24px] font-black leading-none text-[#020617]">{value}</p>
              <p className="mt-2 text-[12px] font-black text-[#020617]">{label}</p>
              <p className="mt-1 text-[11px] font-bold text-[#94A3B8]">{sub}</p>
            </div>
          ))}
        </section>

        <section className="rounded-[28px] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7C83F6]">{t("readiness_14_day_trend")}</p>
              <h2 className="mt-1 text-[20px] font-black text-[#020617]">{t("baseline")}</h2>
            </div>
            <Dumbbell className="h-5 w-5 text-[#7C83F6]" />
          </div>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
            {Array.from({ length: 14 }).map((_, index) => {
              const score = readinessTrend[index] ?? 0;
              return (
                <div key={`recovery-bar-${index}`} className="flex h-16 items-end rounded-xl bg-[#F6F8FB] px-1 ring-1 ring-[#E5EAF1]">
                  <div
                    className={cn("w-full rounded-full", score >= 80 ? "bg-[#22C7A1]" : score >= 60 ? "bg-[#7C83F6]" : score > 0 ? "bg-[#F97316]" : "bg-[#E5EAF1]")}
                    style={{ height: Math.max(14, Math.round((score / 100) * 58)) }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
            <span className="text-[12px] font-black text-[#020617]">{t("high_load_days")}</span>
            <span className="rounded-full bg-[#FFF7ED] px-3 py-1 text-[12px] font-black text-[#F97316]">{baseline.highLoadDays}</span>
          </div>
        </section>

        <section className="rounded-[28px] bg-[#020617] p-5 text-white shadow-[0_18px_38px_rgba(2,6,23,0.18)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#020617]">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#22C7A1]">{t("nutrition_recovery")}</p>
              <p className="mt-1 text-[14px] font-bold leading-5 text-white/80">{t(foodTipKey)}</p>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
          <div className="mb-4">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7C83F6]">{t("performance_sources")}</p>
            <h2 className="mt-1 text-[20px] font-black text-[#020617]">{t("connect_more_sources")}</h2>
          </div>
          <div className="space-y-2">
            {EXTERNAL_HEALTH_PROVIDERS.map((provider) => {
              const Icon = provider.icon;
              const isCurrent = provider.id === platform;
              return (
                <div key={provider.id} className="flex items-center gap-3 rounded-2xl bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white ring-1 ring-[#E5EAF1]"
                    style={{ color: provider.accent }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[13px] font-black text-[#020617]">{provider.name}</p>
                      {isCurrent && <span className="rounded-full bg-[#22C7A1]/10 px-2 py-0.5 text-[9px] font-black uppercase text-[#047857]">{t("active")}</span>}
                    </div>
                    <p className="line-clamp-1 text-[11px] font-bold text-[#64748B]">{t(provider.descriptionKey)}</p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black"
                    style={{ backgroundColor: `${provider.accent}14`, color: provider.accent }}
                  >
                    {t(getProviderStatusKey(provider.status))}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
