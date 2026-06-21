import { getNavArrows } from "@/lib/rtl";
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useProfile } from "@/hooks/useProfile";
import { format, subDays, isSameDay, isToday, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth, isSameMonth, addMonths, subMonths } from "date-fns";

import { ArrowLeft, ChevronDown, ChevronUp, Footprints, AlertTriangle, Clock, Flame, MapPin, Plus, Check, Dumbbell, X, RefreshCw, Link, Link2Off, Apple, Smartphone } from "lucide-react";
import { NavChevronLeft, NavChevronRight } from "@/components/ui/nav-chevron";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleFitWorkouts } from "@/hooks/useGoogleFitWorkouts";
import { useAutoWorkoutDetection } from "@/hooks/useAutoWorkoutDetection";
import { useHealthKitIntegration } from "@/hooks/useHealthKitIntegration";
import { Badge } from "@/components/ui/badge";

const GOAL_OPTIONS = [3000, 5000, 6000, 8000, 10000, 15000];
const QUICK_ADD_OPTIONS = [500, 1000, 2000, 5000];
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

function calcCaloriesPerStep(weightKg: number | null | undefined, met: number): number {
  if (weightKg == null) return 0;
  return (met * 3.5 * weightKg) / (200 * 120);
}

export default function StepCounter() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { t, isRTL } = useLanguage();
  const calPerStep = calcCaloriesPerStep(profile?.current_weight_kg, 3.5);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [steps, setSteps] = useState(0);
  const [goalSteps, setGoalSteps] = useState<number>(() => {
    const stored = localStorage.getItem(getGoalKey(undefined));
    return stored ? parseInt(stored, 10) : 6000;
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-workout detection state
  const [detectedWorkouts, setDetectedWorkouts] = useState<{
    id: string;
    type: string;
    startTime: Date;
    calories: number;
    duration: number;
  }[]>([]);
  const [loadingWorkouts, setLoadingWorkouts] = useState(false);
  const [googleFitConnected, setGoogleFitConnected] = useState(false);
  
  // Google Fit hook
  const { isConnected, checkConnection, fetchWorkouts } = useGoogleFitWorkouts();
  
  // HealthKit integration hook
  const {
    isConnected: healthKitConnected,
    enabledTypes,
    syncedData,
    platform: healthPlatform,
    lastSyncTimestamp,
    formatLastSync,
  } = useHealthKitIntegration();
  
  // Auto workout detection hook
  const { 
    detectedWorkouts: autoDetectedWorkouts, 
    isMonitoring: isAutoDetecting,
    pendingConfirmation: pendingAutoWorkout,
    confirmWorkout: confirmAutoWorkout,
    dismissWorkout: dismissAutoWorkout,
    addManualWorkout: addManualWorkout,
    thresholds: workoutThresholds,
  } = useAutoWorkoutDetection();

  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const getStepsForDate = (d: Date) => {
    const key = getStepsKey(user?.id, format(d, "yyyy-MM-dd"));
    return parseInt(localStorage.getItem(key) || "0", 10);
  };

  // Burned calories derived from user profile weight and steps
  const burnedCal = calPerStep > 0 ? Math.round(steps * calPerStep) : null;

  // Load goal from localStorage once user is available
  useEffect(() => {
    const stored = localStorage.getItem(getGoalKey(user?.id));
    if (stored) setGoalSteps(parseInt(stored, 10));
  }, [user?.id]);

  useEffect(() => {
    const key = getStepsKey(user?.id, selectedDateStr);
    const stored = localStorage.getItem(key);
    const localSteps = stored ? parseInt(stored, 10) : 0;
    // Priority: health kit data > manual data, but only if health sync has steps and is enabled
    const healthSteps = syncedData?.steps && enabledTypes.includes("steps") ? syncedData.steps : null;
    setSteps(healthSteps !== null ? healthSteps : localSteps);
  }, [user?.id, selectedDateStr, syncedData, enabledTypes]);

  // Sync today's steps to workout_sessions as a "Walking (steps)" entry
  const syncStepsToWorkout = useCallback(async (stepsVal: number) => {
    if (!user) return;
    const sessionKey = getStepsSessionKey(user.id, todayStr);
    const existingId = localStorage.getItem(sessionKey);
    const cal = calPerStep > 0 ? Math.round(stepsVal * calPerStep) : 0;
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

  // Check Google Fit connection on mount
  useEffect(() => {
    const checkFit = async () => {
      const connected = await checkConnection();
      setGoogleFitConnected(connected);
    };
    if (user) checkFit();
  }, [user, checkConnection]);

  // Fetch detected workouts (now with Google Fit integration)
  const fetchDetectedWorkouts = useCallback(async () => {
    if (!user) return;
    setLoadingWorkouts(true);
    
    try {
      // First try to get from Supabase/workout_sessions
      const { data: workouts } = await supabase
        .from("workout_sessions")
        .select("id, workout_type, session_date, duration_minutes, calories_burned, created_at")
        .eq("user_id", user.id)
        .eq("session_date", selectedDateStr)
        .order("created_at", { ascending: false })
        .limit(5);
      
      let allWorkouts: typeof detectedWorkouts = [];
      
      if (workouts && workouts.length > 0) {
        const dbWorkouts = workouts.map(w => ({
          id: w.id,
          type: w.workout_type || "Workout",
          startTime: new Date(w.created_at),
          calories: w.calories_burned || 0,
          duration: w.duration_minutes || 0,
        }));
        allWorkouts = [...allWorkouts, ...dbWorkouts];
      }
      
      // If Google Fit is connected, fetch from there too
      const fitConnected = await checkConnection();
      setGoogleFitConnected(fitConnected);
      
      if (fitConnected) {
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        const googleWorkouts = await fetchWorkouts(startOfDay, endOfDay);
        if (googleWorkouts.length > 0) {
          const fitWorkouts = googleWorkouts.map(w => ({
            id: w.id,
            type: w.type,
            startTime: new Date(w.startTime),
            calories: w.calories,
            duration: w.duration,
          }));
          // Add Google Fit workouts that aren't already in the list
          const existingIds = new Set(allWorkouts.map(w => w.id));
          const newFitWorkouts = fitWorkouts.filter(w => !existingIds.has(w.id));
          allWorkouts = [...allWorkouts, ...newFitWorkouts];
        }
      }
      
      setDetectedWorkouts(allWorkouts);
    } catch (error) {
      console.error("Failed to fetch workouts:", error);
    } finally {
      setLoadingWorkouts(false);
    }
  }, [user, selectedDateStr, todayStr, selectedDate, checkConnection, fetchWorkouts]);

  // Load workouts when page loads or date changes
  useEffect(() => {
    fetchDetectedWorkouts();
  }, [fetchDetectedWorkouts]);

  // Confirm a detected workout
  const handleConfirmWorkout = async (workout: typeof detectedWorkouts[0]) => {
    if (!user) return;
    
    try {
      await supabase
        .from("workout_sessions")
        .update({ confirmed: true })
        .eq("id", workout.id);
      
      setDetectedWorkouts(prev => prev.filter(w => w.id !== workout.id));
    } catch (error) {
      console.error("Failed to confirm workout:", error);
    }
  };

  // Dismiss a detected workout
  const handleDismissWorkout = (workoutId: string) => {
    setDetectedWorkouts(prev => prev.filter(w => w.id !== workoutId));
  };

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

  const handleOpenAddSheet = () => {
    setCustomInput("");
    setAddSheetOpen(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleQuickAdd = (amount: number) => {
    saveSteps(steps + amount);
    setAddSheetOpen(false);
  };

  const handleCustomAdd = () => {
    const val = parseInt(customInput, 10);
    if (!val || val <= 0) return;
    saveSteps(steps + val);
    setAddSheetOpen(false);
  };

  const weekDates = Array.from({ length: WEEK_DAYS }, (_, i) =>
    subDays(selectedDate, Math.floor(WEEK_DAYS / 2) - i)
  );

  // History: all days of the current week (Mon-Sun)
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekLabel = `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`;
  const historyDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const historyEntries = historyDays.map((d) => {
    const key = getStepsKey(user?.id, format(d, "yyyy-MM-dd"));
    const s = parseInt(localStorage.getItem(key) || "0", 10);
    const km = parseFloat((s * 0.0008).toFixed(1));
    const cal = calPerStep > 0 ? Math.round(s * calPerStep) : null;
    const mins = Math.round(s / 100);
    return { date: d, steps: s, km, cal: cal ?? 0, mins };
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
    <div className="min-h-screen bg-white pb-24 pt-safe">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3 rtl:flex-row-reverse">
          <button
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-950 shadow-sm transition-transform active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 text-center">
            <p className="truncate text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
              {format(selectedDate, "EEE, MMM d")}
            </p>
            <h1 className="truncate text-base font-extrabold leading-tight text-slate-950">{t('steps_title')}</h1>
          </div>
          <button
            onClick={handleOpenAddSheet}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#020617] text-white shadow-[0_12px_24px_rgba(2,6,23,0.16)] transition-transform active:scale-95"
            aria-label={t('steps_add')}
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        {/* Health connection badge */}
        {healthKitConnected && enabledTypes.includes("steps") && (
          <div className="mx-auto max-w-lg px-4 pb-2">
            <Badge
              variant="outline"
              className="flex w-fit items-center gap-1.5 rounded-full border-slate-200 bg-white text-xs font-bold text-slate-700"
            >
              {healthPlatform === "apple_health" ? (
                <Apple className="w-3 h-3" />
              ) : (
                <Smartphone className="w-3 h-3" />
              )}
              Connected to {healthPlatform === "apple_health" ? "Apple Health" : "Google Fit"}
              {lastSyncTimestamp && (
                <span className="ml-1 text-slate-500">
                  &middot; {formatLastSync()}
                </span>
              )}
            </Badge>
          </div>
        )} 

        {/* Date selector */}
        <div className="mx-auto max-w-lg px-4 pb-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {weekDates.map((d) => (
              <button
                key={d.toISOString()}
                onClick={() => setSelectedDate(d)}
                className={cn(
                  "flex min-h-[58px] min-w-[48px] flex-shrink-0 flex-col items-center justify-center gap-1 rounded-2xl px-3 transition-all",
                  isSameDay(d, selectedDate)
                    ? "bg-[#020617] text-white shadow-[0_10px_20px_rgba(2,6,23,0.16)]"
                    : "bg-white text-slate-500 ring-1 ring-slate-200"
                )}
              >
                <span className="text-[10px] font-extrabold uppercase">{format(d, "EEE")}</span>
                <span className="text-base font-black">{format(d, "d")}</span>
                {isSameDay(d, selectedDate) && (
                  <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
                )}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              if (!calendarOpen) setCalendarMonth(selectedDate);
              setCalendarOpen((prev) => !prev);
            }}
            className="mt-1 flex w-full justify-center p-2 text-slate-400 transition-colors hover:text-slate-600"
          >
            {calendarOpen
              ? <ChevronUp className="w-5 h-5" />
              : <ChevronDown className="w-5 h-5" />}
          </button>
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
          <div className="border-b border-slate-100 bg-white px-4 pb-4">
            {/* Month nav */}
            <div className="mx-auto mb-3 flex max-w-lg items-center justify-between pt-2">
              <button onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-950 shadow-sm transition-transform active:scale-95">
                <NavChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-black text-slate-950">{format(calendarMonth, "MMMM yyyy")}</span>
              <button onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-950 shadow-sm transition-transform active:scale-95">
                <NavChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Day headers */}
            <div className="mx-auto mb-1 grid max-w-lg grid-cols-7">
              {DAY_HEADERS.map((h) => (
                <div key={h} className="text-center text-xs font-bold text-slate-400">{h}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="mx-auto grid max-w-lg grid-cols-7 gap-y-1">
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
                        <circle cx="18" cy="18" r={R} fill="none" stroke="#e2e8f0" strokeWidth="3" />
                        {daySteps > 0 && (
                          <circle cx="18" cy="18" r={R} fill="none"
                            stroke={isSelected ? "#020617" : "#94a3b8"}
                            strokeWidth="3" strokeLinecap="round"
                            strokeDasharray={`${dash} ${CIRC}`} />
                        )}
                      </svg>
                      <span className={cn(
                        "absolute inset-0 flex items-center justify-center text-xs font-bold",
                        !inMonth && "text-slate-300",
                        inMonth && isSelected && "text-slate-950",
                        inMonth && !isSelected && isToday(d) && "text-[#020617]",
                        inMonth && !isSelected && !isToday(d) && "text-slate-600",
                      )}>
                        {format(d, "d")}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Collapse button */}
            <div className="mx-auto mt-2 flex max-w-lg justify-end">
              <button onClick={() => setCalendarOpen(false)}
                className="rounded-full p-1 text-slate-400 transition-colors hover:bg-white hover:text-slate-600">
                <ChevronUp className="h-5 w-5" />
              </button>
            </div>
          </div>
        );
      })()}

      <div className="mx-auto max-w-lg px-4 py-4">
        {/* Warning banner */}
        {isBelowGoal && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-amber-200 bg-white px-4 py-3 text-amber-800 shadow-sm">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
            <p className="text-sm font-semibold">
              {t('steps_keep_going', { count: (goalSteps - steps).toLocaleString() })}
            </p>
          </div>
        )}

        {/* Circular progress */}
        <div className="flex flex-col items-center rounded-[30px] border border-slate-200 bg-white px-5 py-7 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <div className="relative h-60 w-60">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="#f1f5f9"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray="339.3 339.3"
              />
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="#020617"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${strokeDash} 339.3`}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm font-bold text-slate-400">{t('steps_today')}</span>
              <span className="text-[40px] font-black leading-none text-slate-950">{steps.toLocaleString()}</span>
              <span className="mt-1 text-sm font-bold text-slate-400">/ {goalSteps.toLocaleString()}</span>
            </div>
            <button
              onClick={handleOpenAddSheet}
              className="absolute bottom-0 left-1/2 flex h-14 w-14 -translate-x-1/2 translate-y-2 items-center justify-center rounded-full bg-[#020617] text-white shadow-[0_14px_28px_rgba(2,6,23,0.18)] transition-all active:scale-95"
              aria-label={t('steps_add')}
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>

          {/* Goal selector */}
          <div className="mt-10 w-full">
            <p className="mb-2 text-center text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">
              {t('steps_goal')}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {GOAL_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => handleSetGoal(option)}
                  className={cn(
                    "min-h-10 rounded-full border px-4 py-2 text-sm font-extrabold transition-all",
                    goalSteps === option
                      ? "border-[#020617] bg-[#020617] text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-950"
                  )}
                >
                  {option >= 1000 ? `${option / 1000}k` : option}
                </button>
              ))}
            </div>
          </div>

          {/* Calories burned - auto-calculated from today's steps */}
          {isToday(selectedDate) && (
            <div className="mt-6 flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#020617] shadow-sm">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400">{t('steps_calories')}</p>
                <p className="text-lg font-black text-slate-950">
                  {burnedCal != null ? burnedCal : "-"} <span className="text-xs font-semibold text-slate-400">{t('steps_cal_unit')}</span>
                </p>
              </div>
            </div>
          )}
        </div>


        {/* Auto-Detected Workouts Section */}
        {autoDetectedWorkouts.length > 0 && (
          <div className="mt-5 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-black text-slate-950">
                <Dumbbell className="h-5 w-5 text-[#020617]" />
                Auto-Detected Workouts
                {isAutoDetecting && (
                  <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#020617]" />
                    Monitoring
                  </span>
                )}
              </h2>
            </div>
            <div className="space-y-2">
              {autoDetectedWorkouts.map((workout) => (
                <div
                  key={workout.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white ring-1 ring-slate-100">
                      <Dumbbell className="h-5 w-5 text-[#020617]" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-black text-slate-950">{workout.type}</p>
                      <p className="truncate text-xs font-medium text-slate-500">
                        {format(workout.startTime, 'h:mm a')} - {workout.duration} min - {workout.stepRate} spm
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-black text-[#020617]">
                      {workout.calories} cal
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => dismissAutoWorkout(workout.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm transition-transform active:scale-95"
                        aria-label="Dismiss workout"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => confirmAutoWorkout(workout)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-[#020617] text-white shadow-sm transition-transform active:scale-95"
                        aria-label="Confirm workout"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History */}
        <div className="mt-5 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[18px] font-black text-slate-950">{t('steps_history')}</h2>
          </div>
          <p className="mb-3 text-xs font-semibold text-slate-500">{weekLabel}</p>
          <div className="overflow-hidden rounded-2xl bg-slate-50 divide-y divide-slate-200/70">
            {historyEntries.map((entry) => (
              <div
                key={entry.date.toISOString()}
                className={cn(
                  "flex items-center gap-2 px-4 py-3",
                  isSameDay(entry.date, selectedDate) && "bg-slate-100"
                )}
              >
                <span className="w-8 shrink-0 text-xs font-bold text-slate-400">
                  {format(entry.date, "EEE")}
                </span>
                <div className="flex items-center gap-1.5 flex-1">
                  <Footprints className="h-4 w-4 shrink-0 text-[#020617]" />
                  <span className="text-sm font-bold text-slate-950">{entry.steps.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1 justify-center w-14">
                  <Clock className="h-4 w-4 shrink-0 text-[#020617]" />
                  <span className="text-sm font-bold text-slate-950">{entry.mins}m</span>
                </div>
                <div className="flex items-center gap-1 justify-center w-14">
                  <Flame className="h-4 w-4 shrink-0 text-amber-500" />
                  <span className="text-sm font-bold text-slate-950">{entry.cal}</span>
                </div>
                <div className="flex items-center gap-1 justify-end w-14">
                  <MapPin className="h-4 w-4 shrink-0 text-[#020617]" />
                  <span className="text-sm font-bold text-slate-950">{entry.km.toFixed(1)}</span>
                </div>
              </div>
            ))}

            {/* Totals row */}
            <div className="bg-slate-100 px-4 pb-1 pt-3">
              <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">{t('steps_total')}</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-100 px-4 pb-3">
              <span className="w-8 shrink-0 text-xs font-semibold text-slate-400" />
              <div className="flex items-center gap-1.5 flex-1">
                <Footprints className="h-4 w-4 shrink-0 text-[#020617]" />
                <span className="text-sm font-black text-slate-950">{totals.steps.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1 justify-center w-14">
                <Clock className="h-4 w-4 shrink-0 text-[#020617]" />
                <span className="text-sm font-black text-slate-950">{totals.mins}m</span>
              </div>
              <div className="flex items-center gap-1 justify-center w-14">
                <Flame className="h-4 w-4 shrink-0 text-amber-500" />
                <span className="text-sm font-black text-slate-950">{totals.cal}</span>
              </div>
              <div className="flex items-center gap-1 justify-end w-14">
                <MapPin className="h-4 w-4 shrink-0 text-[#020617]" />
                <span className="text-sm font-black text-slate-950">{totals.km.toFixed(1)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Steps Sheet */}
      {addSheetOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setAddSheetOpen(false)}
          />
          {/* Sheet - sits above the nav bar (nav is ~84px) */}
          <div className="fixed left-0 right-0 z-50 rounded-t-[30px] bg-white px-5 pt-5 shadow-[0_-18px_45px_rgba(15,23,42,0.16)]"
            style={{ bottom: 84, paddingBottom: 16 }}>
            {/* Handle */}
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-slate-200" />

            <h3 className="mb-4 text-base font-black text-slate-950">{t('steps_add')}</h3>

            {/* Quick add options */}
            <div className="grid grid-cols-4 gap-2 mb-5">
              {QUICK_ADD_OPTIONS.map((amount) => (
                <button
                  key={amount}
                  onClick={() => handleQuickAdd(amount)}
                  className="flex min-h-[72px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 py-3 transition-transform active:scale-95"
                >
                  <span className="text-sm font-black text-[#020617]">+{amount >= 1000 ? `${amount / 1000}k` : amount}</span>
                  <span className="mt-0.5 text-[10px] font-bold text-slate-400">steps</span>
                </button>
              ))}
            </div>

            {/* Custom input */}
            <div className="mb-4 flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
              <Footprints className="h-5 w-5 shrink-0 text-[#020617]" />
              <input
                ref={inputRef}
                type="number"
                inputMode="numeric"
                min="1"
                placeholder="Enter custom steps..."
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCustomAdd()}
                className="min-w-0 flex-1 bg-transparent text-base font-bold text-slate-950 placeholder:text-slate-400 outline-none"
              />
            </div>

            <button
              onClick={handleCustomAdd}
              disabled={!customInput || parseInt(customInput, 10) <= 0}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#020617] text-base font-extrabold text-white transition-transform active:scale-95 disabled:opacity-40"
              style={{ height: 52 }}
            >
              <Check className="w-5 h-5" /> Add Steps
            </button>
          </div>
        </>
      )}
    </div>
  );
}
