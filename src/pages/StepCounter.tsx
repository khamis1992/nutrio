import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { format, subDays, isSameDay, isToday, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth, isSameMonth, addMonths, subMonths } from "date-fns";
import { CustomerNavigation } from "@/components/CustomerNavigation";
import { ArrowLeft, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Play, Footprints, AlertTriangle, Clock, Flame, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const GOAL_OPTIONS = [3000, 5000, 6000, 8000, 10000, 15000];
const ADD_STEP_AMOUNT = 500;
const WEEK_DAYS = 7;

function getStepsKey(userId: string | undefined, dateStr: string) {
  return `tracker_steps_${userId}_${dateStr}`;
}

function getGoalKey(userId: string | undefined) {
  return `tracker_step_goal_${userId}`;
}

function getStepsSessionKey(userId: string | undefined, dateStr: string) {
  return `tracker_steps_session_id_${userId}_${dateStr}`;
}

export default function StepCounter() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [steps, setSteps] = useState(0);
  const [goalSteps, setGoalSteps] = useState<number>(() => {
    const stored = localStorage.getItem(getGoalKey(undefined));
    return stored ? parseInt(stored, 10) : 6000;
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const getStepsForDate = (d: Date) => {
    const key = getStepsKey(user?.id, format(d, "yyyy-MM-dd"));
    return parseInt(localStorage.getItem(key) || "0", 10);
  };

  // Burned calories derived directly from today's steps
  const burnedCal = Math.round(steps * 0.04);

  // Load goal from localStorage once user is available
  useEffect(() => {
    const stored = localStorage.getItem(getGoalKey(user?.id));
    if (stored) setGoalSteps(parseInt(stored, 10));
  }, [user?.id]);

  useEffect(() => {
    const key = getStepsKey(user?.id, selectedDateStr);
    const stored = localStorage.getItem(key);
    setSteps(stored ? parseInt(stored, 10) : 0);
  }, [user?.id, selectedDateStr]);

  // Sync today's steps to workout_sessions as a "Walking (steps)" entry
  const syncStepsToWorkout = useCallback(async (stepsVal: number) => {
    if (!user) return;
    const sessionKey = getStepsSessionKey(user.id, todayStr);
    const existingId = localStorage.getItem(sessionKey);
    const cal = Math.round(stepsVal * 0.04);
    const mins = Math.max(1, Math.round(stepsVal / 100));

    if (existingId) {
      await supabase
        .from("workout_sessions")
        .update({ duration_minutes: mins, calories_burned: cal })
        .eq("id", existingId)
        .eq("user_id", user.id);
    } else {
      const { data } = await supabase
        .from("workout_sessions")
        .insert({
          user_id: user.id,
          session_date: todayStr,
          workout_type: t('workout_type_walking_steps') || "Walking (steps)",
          duration_minutes: mins,
          calories_burned: cal,
        })
        .select("id")
        .single();
      if (data?.id) localStorage.setItem(sessionKey, data.id);
    }
  }, [user, todayStr, t]);

  const saveSteps = (value: number) => {
    const val = Math.max(0, value);
    setSteps(val);
    const key = getStepsKey(user?.id, selectedDateStr);
    localStorage.setItem(key, String(val));
    // Only sync to workout_sessions for today
    if (selectedDateStr === todayStr) {
      syncStepsToWorkout(val);
    }
  };

  const handleSetGoal = (goal: number) => {
    setGoalSteps(goal);
    localStorage.setItem(getGoalKey(user?.id), String(goal));
  };

  const handleAddSteps = () => {
    saveSteps(steps + ADD_STEP_AMOUNT);
  };

  const weekDates = Array.from({ length: WEEK_DAYS }, (_, i) =>
    subDays(selectedDate, Math.floor(WEEK_DAYS / 2) - i)
  );

  // History: all days of the current week (Mon–Sun)
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekLabel = `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`;
  const historyDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const historyEntries = historyDays.map((d) => {
    const key = getStepsKey(user?.id, format(d, "yyyy-MM-dd"));
    const s = parseInt(localStorage.getItem(key) || "0", 10);
    const km = parseFloat((s * 0.0008).toFixed(1));
    const cal = Math.round(s * 0.04);
    const mins = Math.round(s / 100);
    return { date: d, steps: s, km, cal, mins };
  });

  const totals = historyEntries.reduce(
    (acc, e) => ({ steps: acc.steps + e.steps, km: acc.km + e.km, cal: acc.cal + e.cal, mins: acc.mins + e.mins }),
    { steps: 0, km: 0, cal: 0, mins: 0 }
  );

  const progressPct = Math.min(100, (steps / goalSteps) * 100);
  const circumference = 2 * Math.PI * 54;
  const strokeDash = (progressPct / 100) * circumference;
  const isBelowGoal = isToday(selectedDate) && steps < goalSteps;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-4 rtl:flex-row-reverse">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700 rtl-flip-back" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">{t('steps_title')}</h1>
          <div className="w-10 h-10" />
        </div>

        {/* Date selector */}
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between gap-2 overflow-x-auto">
            {weekDates.map((d) => (
              <button
                key={d.toISOString()}
                onClick={() => setSelectedDate(d)}
                className={cn(
                  "flex-shrink-0 flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all",
                  isSameDay(d, selectedDate)
                    ? "bg-orange-500 text-white"
                    : "text-gray-600 hover:bg-gray-50 border border-gray-200"
                )}
              >
                <span className="text-xs font-medium">{format(d, "EEE")}</span>
                <span className="text-sm font-bold">{format(d, "d")}</span>
                {isSameDay(d, selectedDate) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-200" />
                )}
              </button>
            ))}
          </div>
          <div className="flex justify-end mt-2">
            <button
              onClick={() => {
                if (!calendarOpen) setCalendarMonth(selectedDate);
                setCalendarOpen((prev) => !prev);
              }}
              className="p-1 rounded-full hover:bg-gray-100 transition-colors"
            >
              {calendarOpen
                ? <ChevronUp className="w-5 h-5 text-gray-400" />
                : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>
          </div>
        </div>
      </div>

      {/* Monthly calendar overlay */}
      {calendarOpen && (() => {
        const monthStart = startOfMonth(calendarMonth);
        const monthEnd = endOfMonth(calendarMonth);
        const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
        const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
        const calDays = eachDayOfInterval({ start: calStart, end: calEnd });
        const DAY_HEADERS = [t('day_mon'), t('day_tue'), t('day_wed'), t('day_thu'), t('day_fri'), t('day_sat'), t('day_sun')];
        const R = 14; const CIRC = 2 * Math.PI * R;

        return (
          <div className="bg-background border-b border-gray-100 px-4 pb-4">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-3 pt-2">
              <button onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <span className="font-bold text-gray-900">{format(calendarMonth, "MMMM yyyy")}</span>
              <button onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_HEADERS.map((h) => (
                <div key={h} className="text-center text-xs font-semibold text-gray-400">{h}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-y-1">
              {calDays.map((d) => {
                const inMonth = isSameMonth(d, calendarMonth);
                const isSelected = isSameDay(d, selectedDate);
                const daySteps = getStepsForDate(d);
                const pct = Math.min(1, daySteps / goalSteps);
                const dash = pct * CIRC;

                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => { setSelectedDate(d); setCalendarOpen(false); }}
                    className="flex flex-col items-center py-1"
                  >
                    <div className="relative w-9 h-9">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r={R} fill="none" stroke="#e5e7eb" strokeWidth="3" />
                        {daySteps > 0 && (
                          <circle cx="18" cy="18" r={R} fill="none"
                            stroke={isSelected ? "#ea580c" : "#fb923c"}
                            strokeWidth="3" strokeLinecap="round"
                            strokeDasharray={`${dash} ${CIRC}`} />
                        )}
                      </svg>
                      <span className={cn(
                        "absolute inset-0 flex items-center justify-center text-xs font-bold",
                        !inMonth && "text-gray-300",
                        inMonth && isSelected && "text-orange-600",
                        inMonth && !isSelected && isToday(d) && "text-orange-500",
                        inMonth && !isSelected && !isToday(d) && "text-gray-700",
                      )}>
                        {format(d, "d")}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Collapse button */}
            <div className="flex justify-end mt-2">
              <button onClick={() => setCalendarOpen(false)}
                className="p-1 rounded-full hover:bg-gray-100 transition-colors">
                <ChevronUp className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>
        );
      })()}

      <div className="container mx-auto px-4 py-8">
        {/* Warning banner */}
        {isBelowGoal && (
          <div className="flex items-center gap-2 mb-5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
            <p className="text-sm font-medium">
              {t('steps_keep_going', { count: (goalSteps - steps).toLocaleString() })}
            </p>
          </div>
        )}

        {/* Circular progress */}
        <div className="flex flex-col items-center">
          <div className="relative w-64 h-64">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray="339.3 339.3"
              />
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="#f97316"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${strokeDash} 339.3`}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm font-medium text-gray-500">{t('steps_today')}</span>
              <span className="text-4xl font-bold text-gray-900">{steps.toLocaleString()}</span>
              <span className="text-sm text-gray-500">/ {goalSteps.toLocaleString()}</span>
            </div>
            <button
              onClick={handleAddSteps}
              className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-2 w-14 h-14 rounded-full bg-orange-500 flex items-center justify-center shadow-lg hover:bg-orange-600 active:scale-95 transition-all text-white"
              aria-label={t('steps_add')}
            >
              <Play className="w-6 h-6 fill-white ml-0.5" />
            </button>
          </div>

          {/* Goal selector */}
          <div className="mt-10 w-full">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 text-center">
              {t('steps_goal')}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {GOAL_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => handleSetGoal(option)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-sm font-semibold border transition-all",
                    goalSteps === option
                      ? "bg-orange-500 border-orange-500 text-white shadow-sm"
                      : "bg-white border-gray-200 text-gray-600 hover:border-orange-400 hover:text-orange-500"
                  )}
                >
                  {option >= 1000 ? `${option / 1000}k` : option}
                </button>
              ))}
            </div>
          </div>

          {/* Calories burned — auto-calculated from today's steps */}
          {isToday(selectedDate) && (
            <div className="mt-6 w-full flex items-center gap-3 bg-orange-50 rounded-2xl px-4 py-3">
              <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                <Flame className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-orange-400 font-medium">{t('steps_calories')}</p>
                <p className="text-lg font-black text-orange-600">
                  {burnedCal} <span className="text-xs font-semibold">{t('steps_cal_unit')}</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* History */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900">{t('steps_history')}</h2>
          </div>
          <p className="text-xs text-gray-500 mb-3">{weekLabel}</p>
          <div className="rounded-2xl bg-gray-50 overflow-hidden divide-y divide-gray-100">
            {historyEntries.map((entry) => (
              <div
                key={entry.date.toISOString()}
                className={cn(
                  "flex items-center py-3 px-4 gap-2",
                  isSameDay(entry.date, selectedDate) && "bg-orange-50"
                )}
              >
                <span className="text-xs font-semibold text-gray-400 w-8 shrink-0">
                  {format(entry.date, "EEE")}
                </span>
                <div className="flex items-center gap-1.5 flex-1">
                  <Footprints className="w-4 h-4 text-orange-400 shrink-0" />
                  <span className="text-sm font-semibold text-gray-800">{entry.steps.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1 justify-center w-14">
                  <Clock className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-sm font-semibold text-gray-800">{entry.mins}m</span>
                </div>
                <div className="flex items-center gap-1 justify-center w-14">
                  <Flame className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="text-sm font-semibold text-gray-800">{entry.cal}</span>
                </div>
                <div className="flex items-center gap-1 justify-end w-14">
                  <MapPin className="w-4 h-4 text-sky-400 shrink-0" />
                  <span className="text-sm font-semibold text-gray-800">{entry.km.toFixed(1)}</span>
                </div>
              </div>
            ))}

            {/* Totals row */}
            <div className="px-4 pt-3 pb-1 bg-gray-100">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('steps_total')}</span>
            </div>
            <div className="flex items-center pb-3 px-4 bg-gray-100 gap-2">
              <span className="text-xs font-semibold text-gray-400 w-8 shrink-0" />
              <div className="flex items-center gap-1.5 flex-1">
                <Footprints className="w-4 h-4 text-orange-400 shrink-0" />
                <span className="text-sm font-bold text-gray-900">{totals.steps.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1 justify-center w-14">
                <Clock className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-sm font-bold text-gray-900">{totals.mins}m</span>
              </div>
              <div className="flex items-center gap-1 justify-center w-14">
                <Flame className="w-4 h-4 text-red-400 shrink-0" />
                <span className="text-sm font-bold text-gray-900">{totals.cal}</span>
              </div>
              <div className="flex items-center gap-1 justify-end w-14">
                <MapPin className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="text-sm font-bold text-gray-900">{totals.km.toFixed(1)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <CustomerNavigation />
    </div>
  );
}
