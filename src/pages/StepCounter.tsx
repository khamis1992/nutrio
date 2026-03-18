import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { format, subDays, isSameDay, isToday, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth, isSameMonth, addMonths, subMonths } from "date-fns";
import { CustomerNavigation } from "@/components/CustomerNavigation";
import { ArrowLeft, ChevronDown, ChevronUp, Footprints, AlertTriangle, Clock, Flame, MapPin, Plus, Check, Dumbbell, X, RefreshCw, Link, Link2Off } from "lucide-react";
import { NavChevronLeft, NavChevronRight } from "@/components/ui/nav-chevron";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleFitWorkouts } from "@/hooks/useGoogleFitWorkouts";
import { useAutoWorkoutDetection } from "@/hooks/useAutoWorkoutDetection";

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
      
      // If still no workouts, show demo data for today only
      if (allWorkouts.length === 0 && selectedDateStr === todayStr) {
        allWorkouts = [
          { id: "demo-1", type: "Walking", startTime: new Date(Date.now() - 3600000 * 2), calories: 120, duration: 20 },
          { id: "demo-2", type: "Running", startTime: new Date(Date.now() - 3600000 * 5), calories: 250, duration: 30 },
        ];
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
            <ArrowLeft className="w-5 h-5 text-gray-700" />
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
          <button
            onClick={() => {
              if (!calendarOpen) setCalendarMonth(selectedDate);
              setCalendarOpen((prev) => !prev);
            }}
            className="flex justify-center w-full mt-2 p-2 text-gray-400 hover:text-gray-600 transition-colors"
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
          <div className="bg-background border-b border-gray-100 px-4 pb-4">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-3 pt-2">
              <button onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                <NavChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <span className="font-bold text-gray-900">{format(calendarMonth, "MMMM yyyy")}</span>
              <button onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                <NavChevronRight className="w-4 h-4 text-gray-600" />
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
              onClick={handleOpenAddSheet}
              className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-2 w-14 h-14 rounded-full bg-orange-500 flex items-center justify-center shadow-lg hover:bg-orange-600 active:scale-95 transition-all text-white"
              aria-label={t('steps_add')}
            >
              <Plus className="w-6 h-6" />
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

        {/* Detected Workouts Section */}
        {detectedWorkouts.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <Dumbbell className="w-5 h-5 text-purple-500" />
                {t('detected_workouts') || 'Detected Workouts'}
                {googleFitConnected && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Google Fit</span>
                )}
              </h2>
              <div className="flex items-center gap-2">
                {!googleFitConnected && (
                  <button
                    onClick={() => {
                      // Get OAuth URL - you'd need to configure this with your Google Cloud credentials
                      const clientId = import.meta.env.VITE_GOOGLE_FIT_CLIENT_ID;
                      if (clientId) {
                        const redirectUri = `${window.location.origin}/auth/google-fit/callback`;
                        const params = new URLSearchParams({
                          client_id: clientId,
                          redirect_uri: redirectUri,
                          response_type: "code",
                          scope: "https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.body.read",
                          access_type: "offline",
                          prompt: "consent",
                        });
                        window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
                      } else {
                        console.warn("VITE_GOOGLE_FIT_CLIENT_ID not configured");
                      }
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-full hover:bg-blue-100 transition-colors"
                  >
                    <Link className="w-3 h-3" />
                    Connect Google Fit
                  </button>
                )}
                <button
                  onClick={fetchDetectedWorkouts}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                  aria-label="Refresh workouts"
                >
                  <RefreshCw className={cn("w-4 h-4 text-gray-400", loadingWorkouts && "animate-spin")} />
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {detectedWorkouts.map((workout) => (
                <div
                  key={workout.id}
                  className="flex items-center justify-between bg-purple-50 rounded-xl px-4 py-3 border border-purple-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                      <Dumbbell className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{workout.type}</p>
                      <p className="text-xs text-gray-500">
                        {format(workout.startTime, 'h:mm a')} • {workout.duration} min
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-purple-600">
                      {workout.calories} cal
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleDismissWorkout(workout.id)}
                        className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors"
                        aria-label="Dismiss workout"
                      >
                        <X className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => handleConfirmWorkout(workout)}
                        className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center hover:bg-purple-600 transition-colors"
                        aria-label="Confirm workout"
                      >
                        <Check className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manual Workout Add Button */}
        <div className="mt-6">
          <button
            onClick={async () => {
              if (addManualWorkout) {
                await addManualWorkout('Running', 30);
                // Refresh workouts list
                fetchDetectedWorkouts();
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Manual Workout
          </button>
          
          {/* Show current thresholds for reference */}
          {workoutThresholds && (
            <p className="text-xs text-gray-400 mt-2 text-center">
              Auto-detection: {workoutThresholds.stepRateThreshold}+ spm for {workoutThresholds.minWorkoutDuration}+ min
            </p>
          )}
        </div>

        {/* Auto-Detected Workouts Section */}
        {autoDetectedWorkouts.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <Dumbbell className="w-5 h-5 text-blue-500" />
                Auto-Detected Workouts
                {isAutoDetecting && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                    Monitoring
                  </span>
                )}
              </h2>
            </div>
            <div className="space-y-2">
              {autoDetectedWorkouts.map((workout) => (
                <div
                  key={workout.id}
                  className="flex items-center justify-between bg-blue-50 rounded-xl px-4 py-3 border border-blue-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                      <Dumbbell className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{workout.type}</p>
                      <p className="text-xs text-gray-500">
                        {format(workout.startTime, 'h:mm a')} • {workout.duration} min • {workout.stepRate} spm
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-blue-600">
                      {workout.calories} cal
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => dismissAutoWorkout(workout.id)}
                        className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors"
                        aria-label="Dismiss workout"
                      >
                        <X className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => confirmAutoWorkout(workout)}
                        className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center hover:bg-blue-600 transition-colors"
                        aria-label="Confirm workout"
                      >
                        <Check className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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

      {/* Add Steps Sheet */}
      {addSheetOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setAddSheetOpen(false)}
          />
          {/* Sheet — sits above the nav bar (nav is ~84px) */}
          <div className="fixed left-0 right-0 z-50 bg-white rounded-t-3xl px-5 pt-5 shadow-xl"
            style={{ bottom: 84, paddingBottom: 16 }}>
            {/* Handle */}
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />

            <h3 className="text-base font-bold text-gray-900 mb-4">{t('steps_add')}</h3>

            {/* Quick add options */}
            <div className="grid grid-cols-4 gap-2 mb-5">
              {QUICK_ADD_OPTIONS.map((amount) => (
                <button
                  key={amount}
                  onClick={() => handleQuickAdd(amount)}
                  className="flex flex-col items-center py-3 rounded-2xl border-2 border-orange-200 bg-orange-50 hover:bg-orange-100 transition-colors"
                >
                  <span className="text-sm font-black text-orange-600">+{amount >= 1000 ? `${amount / 1000}k` : amount}</span>
                  <span className="text-[10px] text-orange-400 font-medium mt-0.5">steps</span>
                </button>
              ))}
            </div>

            {/* Custom input */}
            <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3 mb-4">
              <Footprints className="w-5 h-5 text-orange-400 shrink-0" />
              <input
                ref={inputRef}
                type="number"
                inputMode="numeric"
                min="1"
                placeholder="Enter custom steps..."
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCustomAdd()}
                className="flex-1 bg-transparent text-base font-semibold text-gray-900 placeholder-gray-400 outline-none"
              />
            </div>

            <button
              onClick={handleCustomAdd}
              disabled={!customInput || parseInt(customInput, 10) <= 0}
              className="w-full h-13 rounded-full bg-orange-500 text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-40 transition-colors hover:bg-orange-600 active:scale-95"
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
