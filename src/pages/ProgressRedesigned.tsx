import React, { useState, useMemo, useEffect, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarCheck } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { MicronutrientAdequacyCard } from "@/components/progress/MicronutrientAdequacyCard";
import { cn } from "@/lib/utils";
import { isPhaseOneFeatureEnabled } from "@/lib/phase-one-feature-flags";
import { motion } from "framer-motion";

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

  const tabs = [
    { key: "today", label: t("progress_overview") },
    { key: "week", label: t("progress_trends") },
    { key: "goals", label: t("progress_goal_tab") },
  ];

  return (
    <main className={embedded ? "text-slate-900" : "min-h-screen bg-[#F8FAFC] text-slate-900"}>
      <div className={embedded ? "w-full" : "mx-auto min-h-screen w-full max-w-[430px] bg-[#F8FAFC] px-5 pb-20 pt-[calc(env(safe-area-inset-top,0px)+20px)]"}>
        {!embedded && (
          <header className="mb-6 flex items-center justify-between">
            <button
              aria-label="Go back"
              data-testid="progress-back-btn"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/50 text-slate-600 backdrop-blur-md transition-all hover:bg-white active:scale-95"
              onClick={() => navigate(-1)}
              type="button"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-[28px] font-black tracking-tight text-slate-900">{t("progress_title")}</h1>
            <button
              aria-label="Open calendar"
              data-testid="progress-calendar-btn"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/50 text-slate-600 backdrop-blur-md transition-all hover:bg-white active:scale-95"
              type="button"
              onClick={() => setShowCalendar(!showCalendar)}
            >
              <CalendarCheck className="h-5 w-5" />
            </button>
          </header>
        )}

        <div
          className={cn(
            `${embedded ? "mb-4" : "mb-6"} flex gap-6 border-b border-slate-200/60 bg-[#F8FAFC]/90 backdrop-blur-xl`,
            embedded ? "sticky top-[132px] z-20 pt-2" : "sticky top-2 z-20"
          )}
          role="tablist"
          aria-label={t("progress_title")}
        >
          {tabs.map((tab) => {
            const tabKey = tab.key as "today" | "week" | "goals";
            const isActive = activeTab === tabKey;
            return (
              <button
                key={tab.key}
                data-testid={`progress-tab-${tab.key}`}
                onClick={() => handleTabChange(tabKey)}
                className={cn(
                  "relative pb-3 text-[14px] font-bold transition-colors",
                  isActive ? "text-slate-900" : "text-slate-400 hover:text-slate-600"
                )}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`progress-panel-${tabKey}`}
              >
                {tab.label}
                {isActive && (
                  <motion.div layoutId="progress-tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-gradient-to-r from-brand via-macro-water to-macro-protein" />
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

        {micronutrientsEnabled && activeTab === "today" && (
          <MicronutrientAdequacyCard
            endDate={selectedDate}
            initialRange="day"
            isRTL={isRTL}
            userId={user?.id}
          />
        )}
      </div>
    </main>
  );
}
