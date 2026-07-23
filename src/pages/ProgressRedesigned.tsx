import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, CalendarDays, LayoutDashboard, Target, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { MicronutrientAdequacyCard } from "@/components/progress/MicronutrientAdequacyCard";
import { cn } from "@/lib/utils";
import { isPhaseOneFeatureEnabled } from "@/lib/phase-one-feature-flags";
import { motion, useReducedMotion } from "framer-motion";
import ProgressTodayTab from "./progress/ProgressTodayTab";
import ProgressWeekTab from "./progress/ProgressWeekTab";
import ProgressGoalsTab from "./progress/ProgressGoalsTab";

interface ProgressRedesignedProps {
  embedded?: boolean;
}

type TabKey = "today" | "week" | "goals";

const TABS: { key: TabKey; labelKey: string; Icon: LucideIcon }[] = [
  { key: "today", labelKey: "progress_overview", Icon: LayoutDashboard },
  { key: "week", labelKey: "progress_trends", Icon: TrendingUp },
  { key: "goals", labelKey: "progress_goal_tab", Icon: Target },
];

/**
 * Mobile-native Progress shell (430px canvas).
 * Spacing: 20px page pad · 44px touch · 12px+ type · safe-area bottom.
 */
export default function ProgressRedesigned({ embedded = false }: ProgressRedesignedProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarDate, setCalendarDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const selectedDate = useMemo(() => new Date(`${calendarDate}T12:00:00`), [calendarDate]);

  const { user } = useAuth();
  const { t, isRTL } = useLanguage();
  const prefersReducedMotion = useReducedMotion();
  const micronutrientsEnabled = isPhaseOneFeatureEnabled("micronutrients");

  useEffect(() => {
    if (!embedded) document.title = `${t("progress_title")} — Nutrio`;
  }, [embedded, t]);

  const queryTab = searchParams.get("tab");
  const activeTab: TabKey = queryTab === "week" || queryTab === "goals" ? queryTab : "today";

  const handleTabChange = (tabKey: TabKey) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tabKey === "today") next.delete("tab");
      else next.set("tab", tabKey);
      return next;
    }, { replace: true });
  };

  return (
    <main
      data-progress-ui="mobile-v6"
      className={cn("text-slate-900 antialiased", !embedded && "min-h-[100dvh] bg-[#F7F8FA]")}
    >
      <div
        className={cn(
          "w-full",
          !embedded &&
            "mx-auto min-h-[100dvh] max-w-[430px] bg-[#F7F8FA] px-5 pb-[calc(96px+env(safe-area-inset-bottom,0px))] pt-[calc(env(safe-area-inset-top,0px)+12px)]",
          embedded && "px-0 pb-2"
        )}
      >
        {!embedded ? (
          <header className="mb-3 flex h-12 items-center justify-between gap-3">
            <button
              type="button"
              aria-label="Go back"
              data-testid="progress-back-btn"
              onClick={() => navigate(-1)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/80 active:scale-95"
            >
              <ArrowLeft className={cn("h-5 w-5", isRTL && "rotate-180")} strokeWidth={2.4} />
            </button>
            <h1 className="min-w-0 flex-1 truncate text-center text-[17px] font-extrabold leading-none tracking-tight text-slate-950">
              {t("progress_title")}
            </h1>
            <button
              type="button"
              aria-label="Open calendar"
              data-testid="progress-calendar-btn"
              onClick={() => setShowCalendar((v) => !v)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 shadow-[0_1px_3px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/80 active:scale-95"
            >
              <CalendarDays className="h-5 w-5" strokeWidth={2.2} />
            </button>
          </header>
        ) : null}

        {/* Segmented control — scrolls away with content (no sticky) */}
        <div
          className="mb-4 rounded-full bg-[#E8EAED] p-1 ring-1 ring-slate-200/60"
          role="tablist"
          aria-label={t("progress_title")}
        >
          <div className="relative grid grid-cols-3 gap-0">
            {TABS.map(({ key, labelKey, Icon }) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  data-testid={`progress-tab-${key}`}
                  aria-selected={isActive}
                  aria-controls={`progress-panel-${key}`}
                  onClick={() => handleTabChange(key)}
                  className={cn(
                    "relative z-10 flex h-12 min-h-[48px] items-center justify-center gap-1 rounded-full px-1 outline-none transition-colors active:scale-[0.98]",
                    isActive ? "text-slate-950" : "text-slate-500"
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId={prefersReducedMotion ? undefined : "progress-seg-v6"}
                      className="absolute inset-0 -z-10 rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.12)]"
                      transition={
                        prefersReducedMotion
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 440, damping: 36 }
                      }
                    />
                  )}
                  <Icon
                    className={cn("h-4 w-4 shrink-0", isActive ? "text-emerald-600" : "text-slate-400")}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span
                    className={cn(
                      "max-w-[72px] truncate text-[12px] leading-none sm:max-w-none sm:text-[13px]",
                      isActive ? "font-extrabold" : "font-semibold"
                    )}
                  >
                    {t(labelKey)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

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

        {micronutrientsEnabled && activeTab === "today" && (
          <div className="mt-4">
            <MicronutrientAdequacyCard
              endDate={selectedDate}
              initialRange="day"
              isRTL={isRTL}
              userId={user?.id}
            />
          </div>
        )}
      </div>
    </main>
  );
}
