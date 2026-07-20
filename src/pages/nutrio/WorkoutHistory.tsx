import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Activity, ArrowLeft, Dumbbell, Clock, Trophy, Calendar, ChevronDown, ChevronUp, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { isPhaseOneFeatureEnabled } from "@/lib/phase-one-feature-flags";
import { didMeetSetTarget } from "@/lib/workout-set-prescription";
import { calculateDailyTrainingLoad } from "@/lib/strength-training";

interface SessionSummary {
  id: string;
  program_id: string | null;
  day_number: number;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  rating: number | null;
  perceived_effort: number | null;
  notes: string | null;
  programTitle?: string;
}

interface SetLog {
  id: string;
  session_id: string;
  exercise_name: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  rpe: number | null;
  rir: number | null;
  target_reps_min: number | null;
  target_reps_max: number | null;
  target_weight_kg: number | null;
  target_rpe: number | null;
  target_rest_seconds: number | null;
  actual_rest_seconds: number | null;
  completed: boolean;
}

interface PersonalRecord {
  exercise_name: string;
  max_weight: number;
  max_reps: number;
  date: string;
}

interface ExerciseProgressPoint {
  date: string;
  label: string;
  maxWeight: number;
  maxReps: number;
  estimatedOneRepMax: number;
  bestVolume: number;
}

const fadeInUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const calculateEstimatedOneRepMax = (weight: number, reps: number) => {
  if (weight <= 0 || reps <= 0) return 0;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
};

const formatChartDate = (value: string) =>
  new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function WorkoutHistory() {
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const trainingEnhancementsEnabled = isPhaseOneFeatureEnabled("trainingEnhancements");
  const addedCopy = isRTL ? {
    advancedLoad: "حمل التدريب المتقدم",
    loadDescription: "عرض اختياري لمجهود الجلسة: المدة × المجهود",
    sevenDayLoad: "حمل 7 أيام",
    loadGuidance: "استخدم الحمل لمقارنة أسابيعك فقط. ليس مقياسًا طبيًا للجاهزية ولا يتجاوز وصفة مدربك.",
    noRated: "لا توجد جلسات مقيّمة بعد",
    rateNext: "قيّم المجهود بعد تمرينك الموجّه التالي لفتح هذا العرض.",
    progression: "تطور القوة",
    chart: "مخطط لكل تمرين",
    chartDescription: "تتبّع أعلى وزن والقوة المقدّرة من المجموعات الموجّهة المكتملة.",
    bestWeight: "أفضل وزن",
    estimated: "القوة المقدّرة",
    change: "التغيير",
    noWeighted: "لا توجد مجموعات بأوزان بعد",
    buildChart: "سجّل الوزن أو التكرارات في تمرين موجّه لبناء هذا المخطط.",
    noExerciseData: "لا توجد بيانات تمارين بعد",
    startTracking: "أكمل مجموعة في تمرين موجّه لبدء تتبّع كل تمرين.",
    onTarget: "ضمن الهدف",
    belowTarget: "أقل من الهدف",
    target: "الهدف",
    rested: "الراحة",
  } : {
    advancedLoad: "Advanced training load",
    loadDescription: "Optional session-RPE view · duration × effort",
    sevenDayLoad: "7-day load",
    loadGuidance: "Use load to compare your own weeks. It is not a medical readiness score and does not override your coach's prescription.",
    noRated: "No effort-rated sessions yet",
    rateNext: "Rate effort after your next guided workout to unlock this view.",
    progression: "Strength Progression",
    chart: "Per-exercise chart",
    chartDescription: "Track max weight and estimated strength from completed guided sets.",
    bestWeight: "Best weight",
    estimated: "Est. strength",
    change: "Change",
    noWeighted: "No weighted sets yet",
    buildChart: "Log weight or reps in a guided workout to build this chart.",
    noExerciseData: "No exercise data yet",
    startTracking: "Complete a guided workout set to start tracking each exercise.",
    onTarget: "On target",
    belowTarget: "Below target",
    target: "Target",
    rested: "Rested",
  };
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [setLogs, setSetLogs] = useState<Record<string, SetLog[]>>({});
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [showTrainingLoad, setShowTrainingLoad] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const fetchHistory = async () => {
      try {
        const sessionColumns = trainingEnhancementsEnabled
          ? "id, program_id, day_number, started_at, completed_at, duration_seconds, rating, perceived_effort, notes"
          : "id, program_id, day_number, started_at, completed_at, duration_seconds, notes";
        const { data: rawSessionData } = await supabase
          .from("coach_workout_sessions")
          .select(sessionColumns)
          .eq("user_id", user.id)
          .order("started_at", { ascending: false })
          .limit(30);

        if (!rawSessionData || rawSessionData.length === 0) {
          setLoading(false);
          return;
        }

        const sessionData = (rawSessionData as unknown as SessionSummary[]).map((session) => ({
          ...session,
          rating: session.rating ?? null,
          perceived_effort: session.perceived_effort ?? null,
        }));
        const programIds = [...new Set(sessionData.map((s) => s.program_id).filter(Boolean))] as string[];
        const programTitles: Record<string, string> = {};
        if (programIds.length > 0) {
          const { data: programs } = await supabase
            .from("coach_programs")
            .select("id, title")
            .in("id", programIds);
          for (const p of programs || []) {
            programTitles[p.id] = p.title;
          }
        }

        const enrichedSessions: SessionSummary[] = sessionData.map((s) => ({
          ...s,
          programTitle: s.program_id ? programTitles[s.program_id] : undefined,
        }));
        setSessions(enrichedSessions);

        const sessionIds = sessionData.map((s) => s.id);
        const setLogColumns = trainingEnhancementsEnabled
          ? "id, session_id, exercise_name, set_number, reps, weight_kg, rpe, rir, target_reps_min, target_reps_max, target_weight_kg, target_rpe, target_rest_seconds, actual_rest_seconds, completed"
          : "id, session_id, exercise_name, set_number, reps, weight_kg, completed";
        const { data: rawLogs } = await supabase
          .from("coach_workout_set_logs")
          .select(setLogColumns)
          .in("session_id", sessionIds);

        const logs = ((rawLogs || []) as unknown as SetLog[]).map((log) => ({
          ...log,
          rpe: log.rpe ?? null,
          rir: log.rir ?? null,
          target_reps_min: log.target_reps_min ?? null,
          target_reps_max: log.target_reps_max ?? null,
          target_weight_kg: log.target_weight_kg ?? null,
          target_rpe: log.target_rpe ?? null,
          target_rest_seconds: log.target_rest_seconds ?? null,
          actual_rest_seconds: log.actual_rest_seconds ?? null,
        }));

        const logsBySession: Record<string, SetLog[]> = {};
        for (const log of logs) {
          if (!logsBySession[log.session_id]) logsBySession[log.session_id] = [];
          logsBySession[log.session_id].push(log as SetLog);
        }
        setSetLogs(logsBySession);

        const exerciseMap: Record<string, { maxWeight: number; maxReps: number; date: string }> = {};
        for (const log of logs) {
          if (!log.completed) continue;
          const key = log.exercise_name;
          if (!exerciseMap[key]) {
            exerciseMap[key] = { maxWeight: 0, maxReps: 0, date: "" };
          }
          if ((log.weight_kg ?? 0) > exerciseMap[key].maxWeight) {
            exerciseMap[key].maxWeight = log.weight_kg ?? 0;
            const session = sessionData.find((s) => s.id === log.session_id);
            exerciseMap[key].date = session?.started_at ?? "";
          }
          if ((log.reps ?? 0) > exerciseMap[key].maxReps) {
            exerciseMap[key].maxReps = log.reps ?? 0;
          }
        }
        const prs: PersonalRecord[] = Object.entries(exerciseMap).map(([name, data]) => ({
          exercise_name: name,
          max_weight: data.maxWeight,
          max_reps: data.maxReps,
          date: data.date,
        }));
        setPersonalRecords(prs);
      } catch (err) {
        console.error("Error fetching workout history:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [trainingEnhancementsEnabled, user?.id]);

  const exerciseProgression = useMemo(() => {
    const sessionDateById = new Map(sessions.map((session) => [session.id, session.started_at]));
    const grouped: Record<string, Record<string, ExerciseProgressPoint>> = {};

    for (const [sessionId, logs] of Object.entries(setLogs)) {
      const sessionDate = sessionDateById.get(sessionId);
      if (!sessionDate) continue;
      const dateKey = sessionDate.split("T")[0];

      for (const log of logs) {
        if (!log.completed) continue;
        const exerciseName = log.exercise_name.trim();
        if (!exerciseName) continue;

        const weight = Number(log.weight_kg ?? 0);
        const reps = Number(log.reps ?? 0);
        const estimatedOneRepMax = calculateEstimatedOneRepMax(weight, reps);
        const bestVolume = weight * reps;

        grouped[exerciseName] ??= {};
        grouped[exerciseName][dateKey] ??= {
          date: dateKey,
          label: formatChartDate(dateKey),
          maxWeight: 0,
          maxReps: 0,
          estimatedOneRepMax: 0,
          bestVolume: 0,
        };

        const point = grouped[exerciseName][dateKey];
        point.maxWeight = Math.max(point.maxWeight, weight);
        point.maxReps = Math.max(point.maxReps, reps);
        point.estimatedOneRepMax = Math.max(point.estimatedOneRepMax, estimatedOneRepMax);
        point.bestVolume = Math.max(point.bestVolume, bestVolume);
      }
    }

    return Object.fromEntries(
      Object.entries(grouped).map(([name, pointsByDate]) => [
        name,
        Object.values(pointsByDate).sort((a, b) => a.date.localeCompare(b.date)),
      ])
    ) as Record<string, ExerciseProgressPoint[]>;
  }, [sessions, setLogs]);

  const exerciseNames = useMemo(
    () =>
      Object.entries(exerciseProgression)
        .sort((a, b) => {
          const aLatest = a[1].at(-1)?.date ?? "";
          const bLatest = b[1].at(-1)?.date ?? "";
          return bLatest.localeCompare(aLatest);
        })
        .map(([name]) => name),
    [exerciseProgression]
  );

  useEffect(() => {
    if (!selectedExercise && exerciseNames.length > 0) {
      setSelectedExercise(exerciseNames[0]);
      return;
    }
    if (selectedExercise && exerciseNames.length > 0 && !exerciseNames.includes(selectedExercise)) {
      setSelectedExercise(exerciseNames[0]);
    }
  }, [exerciseNames, selectedExercise]);

  const selectedProgress = selectedExercise ? exerciseProgression[selectedExercise] ?? [] : [];
  const latestProgress = selectedProgress.at(-1);
  const firstProgress = selectedProgress[0];
  const bestWeight = selectedProgress.reduce((max, point) => Math.max(max, point.maxWeight), 0);
  const bestEstimatedStrength = selectedProgress.reduce((max, point) => Math.max(max, point.estimatedOneRepMax), 0);
  const weightChange = latestProgress && firstProgress ? latestProgress.maxWeight - firstProgress.maxWeight : 0;
  const hasProgressChart = selectedProgress.some((point) => point.maxWeight > 0 || point.maxReps > 0);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "--";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const totalWorkouts = sessions.filter((s) => s.completed_at).length;
  const totalMinutes = sessions.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0) / 60;
  const trainingLoad = trainingEnhancementsEnabled ? calculateDailyTrainingLoad(sessions.map((item) => ({
    startedAt: item.started_at,
    durationSeconds: item.duration_seconds,
    perceivedEffort: item.perceived_effort,
  }))).slice(-7) : [];
  const maxTrainingLoad = Math.max(...trainingLoad.map((item) => item.load), 1);
  const totalTrainingLoad = trainingLoad.reduce((sum, item) => sum + item.load, 0);

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-lg border-b border-slate-100">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 transition-transform active:scale-95"
            aria-label={isRTL ? "الرجوع" : "Go back"}
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div>
            <h1 className="text-[17px] font-extrabold text-slate-950">Workout History</h1>
            <p className="text-[11px] text-slate-400">Your completed workout sessions</p>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-md space-y-3 px-4 pt-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="bg-white rounded-[24px] p-8 text-center shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80">
            <Dumbbell className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-[14px] font-bold text-slate-700">No workouts yet</p>
            <p className="text-[12px] text-slate-400 mt-1">Complete a guided workout to see your history here</p>
          </motion.div>
        ) : (
          <>
            {personalRecords.length > 0 && (
              <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="bg-white rounded-[24px] p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <h2 className="text-[13px] font-extrabold text-slate-950">Personal Records</h2>
                </div>
                <div className="space-y-1.5">
                  {personalRecords.map((pr) => (
                    <div key={pr.exercise_name} className="flex items-center gap-2 px-2.5 py-2 bg-amber-50/50 rounded-xl">
                      <Dumbbell className="w-3 h-3 text-amber-500 shrink-0" />
                      <span className="text-[11px] font-semibold text-slate-700 flex-1 truncate">{pr.exercise_name}</span>
                      {pr.max_weight > 0 && (
                        <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">{pr.max_weight}kg</span>
                      )}
                      <span className="text-[9px] text-slate-400">{pr.max_reps} reps</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="bg-white rounded-2xl p-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80 text-center">
                <p className="text-[22px] font-black text-purple-600">{totalWorkouts}</p>
                <p className="text-[10px] text-slate-400 font-semibold">Workouts</p>
              </motion.div>
              <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="bg-white rounded-2xl p-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80 text-center">
                <p className="text-[22px] font-black text-purple-600">{Math.round(totalMinutes)}</p>
                <p className="text-[10px] text-slate-400 font-semibold">Minutes</p>
              </motion.div>
            </div>

            {trainingEnhancementsEnabled && <motion.section dir={isRTL ? "rtl" : "ltr"} variants={fadeInUp} initial="hidden" animate="visible" className="overflow-hidden rounded-[24px] bg-white ring-1 ring-[#E5EAF1] shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
              <button
                type="button"
                onClick={() => setShowTrainingLoad((value) => !value)}
                className="flex min-h-[64px] w-full items-center gap-3 px-4 text-start active:bg-[#F8FAFC]"
                aria-expanded={showTrainingLoad}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[#FFF0F2] text-[#FB6B7A]">
                  <Activity className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-black text-[#020617]">{addedCopy.advancedLoad}</span>
                  <span className="mt-0.5 block text-[10px] font-semibold text-[#94A3B8]">{addedCopy.loadDescription}</span>
                </span>
                <span className="text-end">
                  <span className="block text-[17px] font-black text-[#FB6B7A]">{totalTrainingLoad}</span>
                  <span className="text-[8px] font-black uppercase tracking-wide text-[#94A3B8]">{addedCopy.sevenDayLoad}</span>
                </span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-[#94A3B8] transition", showTrainingLoad && "rotate-180")} />
              </button>
              {showTrainingLoad && (
                <div className="border-t border-[#E5EAF1] bg-[#F6F8FB] px-4 pb-4 pt-3">
                  {trainingLoad.length > 0 ? (
                    <>
                      <div className="flex h-[112px] items-end gap-2">
                        {trainingLoad.map((day) => (
                          <div key={day.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                            <span className="text-[8px] font-black text-[#64748B]">{day.load}</span>
                            <span className="w-full max-w-8 rounded-t-[8px] bg-[#FB6B7A]" style={{ height: `${Math.max(8, (day.load / maxTrainingLoad) * 76)}px` }} />
                            <span className="text-[8px] font-bold text-[#94A3B8]">{new Date(`${day.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2)}</span>
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 text-[9px] font-semibold leading-4 text-[#94A3B8]">{addedCopy.loadGuidance}</p>
                    </>
                  ) : (
                    <div className="py-5 text-center">
                      <p className="text-[12px] font-black text-[#020617]">{addedCopy.noRated}</p>
                      <p className="mt-1 text-[10px] font-semibold text-[#94A3B8]">{addedCopy.rateNext}</p>
                    </div>
                  )}
                </div>
              )}
            </motion.section>}

            {trainingEnhancementsEnabled && <motion.div dir={isRTL ? "rtl" : "ltr"} variants={fadeInUp} initial="hidden" animate="visible" className="rounded-[24px] bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7C83F6]">{addedCopy.progression}</p>
                  <h2 className="mt-1 text-[18px] font-black leading-tight text-[#020617]">{addedCopy.chart}</h2>
                  <p className="mt-1 text-[12px] font-semibold leading-4 text-[#94A3B8]">{addedCopy.chartDescription}</p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F3F4FF] text-[#7C83F6] ring-1 ring-[#E5EAF1]">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>

              {exerciseNames.length > 0 ? (
                <>
                  <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {exerciseNames.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setSelectedExercise(name)}
                        className={cn(
                          "h-10 shrink-0 rounded-full px-4 text-[12px] font-black transition-all active:scale-[0.98]",
                          selectedExercise === name
                            ? "bg-[#020617] text-white shadow-[0_10px_22px_rgba(2,6,23,0.18)]"
                            : "bg-[#F6F8FB] text-[#64748B] ring-1 ring-[#E5EAF1]"
                        )}
                      >
                        {name}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-2xl bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
                      <p className="text-[9px] font-black uppercase tracking-wide text-[#94A3B8]">{addedCopy.bestWeight}</p>
                      <p className="mt-1 text-[18px] font-black text-[#020617]">{bestWeight > 0 ? bestWeight : "--"}<span className="ms-0.5 text-[10px] font-bold text-[#94A3B8]">kg</span></p>
                    </div>
                    <div className="rounded-2xl bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
                      <p className="text-[9px] font-black uppercase tracking-wide text-[#94A3B8]">{addedCopy.estimated}</p>
                      <p className="mt-1 text-[18px] font-black text-[#7C83F6]">{bestEstimatedStrength > 0 ? bestEstimatedStrength : "--"}<span className="ms-0.5 text-[10px] font-bold text-[#94A3B8]">kg</span></p>
                    </div>
                    <div className="rounded-2xl bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
                      <p className="text-[9px] font-black uppercase tracking-wide text-[#94A3B8]">{addedCopy.change}</p>
                      <p className={cn("mt-1 text-[18px] font-black", weightChange >= 0 ? "text-[#22C7A1]" : "text-[#FB6B7A]")}>
                        {weightChange > 0 ? "+" : ""}{Number(weightChange.toFixed(1))}<span className="ms-0.5 text-[10px] font-bold text-[#94A3B8]">kg</span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 h-[190px] rounded-[20px] bg-[#F6F8FB] px-1 py-3 ring-1 ring-[#E5EAF1]">
                    {hasProgressChart ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={selectedProgress} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#94A3B8", fontSize: 10, fontWeight: 700 }} interval="preserveStartEnd" />
                          <YAxis hide domain={["dataMin - 2", "dataMax + 2"]} />
                          <Tooltip
                            cursor={{ stroke: "#E5EAF1", strokeWidth: 1 }}
                            contentStyle={{ border: "1px solid #E5EAF1", borderRadius: 16, boxShadow: "0 16px 40px rgba(2,6,23,0.12)" }}
                            formatter={(value: unknown, name: unknown) => [`${value} kg`, name === "estimatedOneRepMax" ? "Est. strength" : "Max weight"]}
                            labelStyle={{ color: "#020617", fontWeight: 800 }}
                          />
                          <Line type="monotone" dataKey="estimatedOneRepMax" stroke="#7C83F6" strokeWidth={3} dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: "#7C83F6" }} />
                          <Line type="monotone" dataKey="maxWeight" stroke="#22C7A1" strokeWidth={3} dot={{ r: 3, strokeWidth: 0, fill: "#22C7A1" }} activeDot={{ r: 5, strokeWidth: 0, fill: "#22C7A1" }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                        <Dumbbell className="h-8 w-8 text-[#94A3B8]" />
                        <p className="mt-2 text-[13px] font-black text-[#020617]">{addedCopy.noWeighted}</p>
                        <p className="mt-1 text-[11px] font-semibold leading-4 text-[#94A3B8]">{addedCopy.buildChart}</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-center gap-4 text-[10px] font-black text-[#94A3B8]">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#22C7A1]" /> Max weight</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#7C83F6]" /> Est. strength</span>
                  </div>
                </>
              ) : (
                <div className="mt-4 rounded-[20px] bg-[#F6F8FB] p-5 text-center ring-1 ring-[#E5EAF1]">
                  <Dumbbell className="mx-auto h-9 w-9 text-[#94A3B8]" />
                  <p className="mt-3 text-[14px] font-black text-[#020617]">{addedCopy.noExerciseData}</p>
                  <p className="mt-1 text-[12px] font-semibold leading-4 text-[#94A3B8]">{addedCopy.startTracking}</p>
                </div>
              )}
            </motion.div>}

            <div className="space-y-2">
              {sessions.map((session) => {
                const logs = setLogs[session.id] || [];
                const isExpanded = expandedSession === session.id;
                const isCompleted = !!session.completed_at;
                const exerciseNames = [...new Set(logs.filter((l) => l.completed).map((l) => l.exercise_name))];
                const completedSets = logs.filter((l) => l.completed).length;
                const totalSets = logs.length;

                return (
                  <motion.div
                    key={session.id}
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    className={cn(
                      "bg-white rounded-2xl shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80 overflow-hidden",
                      isExpanded && "ring-2 ring-purple-100"
                    )}
                  >
                    <button
                      onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                      className="w-full p-3.5 flex items-center gap-3 text-left"
                    >
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", isCompleted ? "bg-emerald-100" : "bg-amber-100")}>
                        <Dumbbell className={cn("w-5 h-5", isCompleted ? "text-emerald-600" : "text-amber-600")} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-slate-800 truncate">
                          {session.programTitle || `Day ${session.day_number} Workout`}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span className="text-[10px] text-slate-500">
                            {new Date(session.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                          {session.duration_seconds && (
                            <>
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span className="text-[10px] text-slate-500">{formatDuration(session.duration_seconds)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", isCompleted ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                          {isCompleted ? "Done" : "Partial"}
                        </span>
                        <span className="text-[9px] text-slate-400">{completedSets}/{totalSets} sets</span>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                    </button>

                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="px-3.5 pb-3.5">
                        <div className="space-y-2">
                          {exerciseNames.map((exName) => {
                            const exLogs = logs.filter((l) => l.exercise_name === exName);
                            return (
                              <div key={exName} className="bg-slate-50 rounded-xl p-2.5">
                                <p className="text-[11px] font-bold text-slate-700 mb-1.5">{exName}</p>
                                <div className="space-y-0.5">
                                  {exLogs.map((log) => {
                                    const isPR = personalRecords.some(
                                      (pr) => pr.exercise_name === exName && pr.max_weight === log.weight_kg && log.weight_kg !== null && log.weight_kg > 0
                                    );
                                    const targetResult = didMeetSetTarget({
                                      reps: log.reps,
                                      weightKg: log.weight_kg,
                                      rpe: log.rpe,
                                      targetRepsMin: log.target_reps_min,
                                      targetWeightKg: log.target_weight_kg,
                                      targetRpe: log.target_rpe,
                                    });
                                    const targetReps = log.target_reps_min == null
                                      ? null
                                      : log.target_reps_min === log.target_reps_max
                                        ? String(log.target_reps_min)
                                        : `${log.target_reps_min}-${log.target_reps_max}`;
                                    return (
                                      <div key={log.id} className="rounded-xl bg-white px-2.5 py-2 ring-1 ring-slate-200/80">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[9px] font-bold text-slate-400">Set {log.set_number}</span>
                                          <span className="text-[11px] font-mono font-bold text-slate-700">{log.reps ?? 0} reps</span>
                                          <span className="text-[11px] font-mono font-bold text-slate-700">{log.weight_kg ?? 0}kg</span>
                                          {trainingEnhancementsEnabled && log.rir != null && <span className="text-[9px] font-bold text-[#7C83F6]">RIR {log.rir}</span>}
                                          {isPR && <span className="rounded-full bg-amber-100 px-1 py-0.5 text-[8px] font-bold text-amber-600">PR</span>}
                                          {trainingEnhancementsEnabled && targetResult != null && (
                                            <span className={cn("ms-auto rounded-full px-1.5 py-0.5 text-[8px] font-bold", targetResult ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-600") }>
                                              {targetResult ? addedCopy.onTarget : addedCopy.belowTarget}
                                            </span>
                                          )}
                                        </div>
                                        {trainingEnhancementsEnabled && (targetReps || log.target_weight_kg != null || log.target_rpe != null || log.actual_rest_seconds != null) && (
                                          <p className="mt-1 text-[9px] font-semibold text-slate-400">
                                            {addedCopy.target} {targetReps ? `${targetReps} reps` : "--"}
                                            {log.target_weight_kg != null ? ` · ${log.target_weight_kg}kg` : ""}
                                            {log.target_rpe != null ? ` · RPE ≤ ${log.target_rpe}` : ""}
                                            {log.actual_rest_seconds != null ? ` · ${addedCopy.rested} ${log.actual_rest_seconds}s` : ""}
                                          </p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
