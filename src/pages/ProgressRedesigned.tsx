import React, { useState, useMemo, useEffect, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarCheck, Target, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { MicronutrientAdequacyCard } from "@/components/progress/MicronutrientAdequacyCard";
import { cn } from "@/lib/utils";
import { isPhaseOneFeatureEnabled } from "@/lib/phase-one-feature-flags";
import { PROGRESS_COLORS } from "./progress/progress-colors";

const ProgressTodayTab = React.lazy(() => import("./progress/ProgressTodayTab"));
const ProgressWeekTab = React.lazy(() => import("./progress/ProgressWeekTab"));
const ProgressGoalsTab = React.lazy(() => import("./progress/ProgressGoalsTab"));

interface ProgressRedesignedProps {
  embedded?: boolean;
}

function TabSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-20 rounded-[24px] bg-slate-100" />
      <div className="h-72 rounded-[28px] bg-slate-100" />
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 rounded-[18px] bg-slate-100" />
        ))}
      </div>
      <div className="h-36 rounded-[24px] bg-slate-100" />
    </div>
  );
}

export default function ProgressRedesigned({ embedded = false }: ProgressRedesignedProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarDate, setCalendarDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const selectedDate = useMemo(() => new Date(`${calendarDate}T12:00:00`), [calendarDate]);
  
  const { user } = useAuth();
  const { t, isRTL } = useLanguage();
  const micronutrientsEnabled = isPhaseOneFeatureEnabled("micronutrients");

  useEffect(() => {
    if (!embedded) document.title = `${t("progress_title")} — Nutrio`;
  }, [embedded, t]);

  const queryTab = searchParams.get("tab");
  const activeQueryTab: "today" | "week" | "goals" =
    queryTab === "week" || queryTab === "goals" ? queryTab : "today";
  const activeTab = activeQueryTab;

  const handleTabChange = (tabKey: "today" | "week" | "goals") => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tabKey === "today") {
        next.delete("tab");
      } else {
        next.set("tab", tabKey);
      }
      return next;
    }, { replace: true });
  };

  return (
    <main className={embedded ? "text-[#101827]" : "min-h-screen bg-[#FAFBFC] text-[#101827]"}>
      <div className={embedded ? "w-full" : "mx-auto min-h-screen w-full max-w-[430px] bg-white px-5 pb-20 pt-[calc(env(safe-area-inset-top,0px)+20px)] shadow-[0_24px_80px_rgba(15,23,42,0.06)]"}>
        {!embedded && (
          <header className="mb-6 flex items-center justify-between px-0.5">
            <button
              aria-label="Go back"
              data-testid="progress-back-btn"
              className="grid h-10 w-10 place-items-center rounded-full text-[#0F172A] active:bg-slate-100"
              onClick={() => navigate(-1)}
              type="button"
            >
              <ArrowLeft className="h-7 w-7" strokeWidth={2.6} />
            </button>
            <h1 className="text-[23px] font-black tracking-[-0.06em] text-[#111827]">{t("progress_title")}</h1>
            <button
              aria-label="Open calendar"
              data-testid="progress-calendar-btn"
              className="grid h-10 w-10 place-items-center rounded-full text-[#0F172A] active:bg-slate-100"
              type="button"
              onClick={() => setShowCalendar(!showCalendar)}
            >
              <CalendarCheck className="h-[26px] w-[26px]" strokeWidth={2.4} />
            </button>
          </header>
        )}

        <div
          className={cn(
            `${embedded ? "mb-4" : "mb-6"} grid h-14 grid-cols-3 rounded-[20px] border border-white/90 bg-[#EEF2F7]/95 p-1.5 shadow-[0_10px_28px_rgba(15,23,42,0.08)] backdrop-blur-xl`,
            embedded ? "sticky top-[132px] z-20" : "sticky top-2 z-20"
          )}
          role="tablist"
          aria-label={t("progress_title")}
        >
          {[
            { key: "today", label: t("progress_overview"), Icon: CalendarCheck, accent: PROGRESS_COLORS.calories },
            { key: "week", label: t("progress_trends"), Icon: TrendingUp, accent: PROGRESS_COLORS.protein },
            { key: "goals", label: t("progress_goal_tab"), Icon: Target, accent: PROGRESS_COLORS.carbs },
          ].map((tab) => {
            const tabKey = tab.key as "today" | "week" | "goals";
            const isActive = activeTab === tabKey;
            return (
              <button
                key={tab.key}
                data-testid={`progress-tab-${tab.key}`}
                onClick={() => handleTabChange(tabKey)}
                className={cn(
                  "relative flex min-w-0 items-center justify-center gap-1.5 rounded-[15px] px-2 text-[12px] font-extrabold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C83F6]/40",
                  isActive
                    ? "bg-white text-[#020617] shadow-[0_5px_14px_rgba(15,23,42,0.10)] ring-1 ring-[#E5EAF1]"
                    : "text-[#64748B] active:bg-white/70"
                )}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`progress-panel-${tabKey}`}
              >
                <tab.Icon
                  className="h-4 w-4 shrink-0 transition-colors"
                  strokeWidth={isActive ? 2.6 : 2.2}
                  style={{ color: isActive ? tab.accent : PROGRESS_COLORS.mutedText }}
                  aria-hidden="true"
                />
                <span className="truncate">{tab.label}</span>
                {isActive && (
                  <span
                    className="absolute bottom-1 h-0.5 w-5 rounded-full"
                    style={{ backgroundColor: tab.accent }}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>

        <Suspense fallback={<TabSkeleton />}>
          {activeTab === "today" && (
            <ProgressTodayTab
              selectedDate={selectedDate}
              calendarDate={calendarDate}
              setCalendarDate={setCalendarDate}
              showCalendar={showCalendar}
              setShowCalendar={setShowCalendar}
            />
          )}
          {activeTab === "week" && <ProgressWeekTab />}
          {activeTab === "goals" && <ProgressGoalsTab />}
        </Suspense>

        {micronutrientsEnabled && (activeTab === "today" || activeTab === "week") && (
          <MicronutrientAdequacyCard
            endDate={activeTab === "today" ? selectedDate : new Date()}
            initialRange={activeTab === "week" ? "week" : "day"}
            isRTL={isRTL}
            userId={user?.id}
          />
        )}
      </div>
    </main>
  );
}
