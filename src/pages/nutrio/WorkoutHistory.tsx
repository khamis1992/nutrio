import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Dumbbell, Clock, Trophy, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface SessionSummary {
  id: string;
  program_id: string | null;
  day_number: number;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  notes: string | null;
  programTitle?: string;
}

interface SetLog {
  id: string;
  exercise_name: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  completed: boolean;
}

interface PersonalRecord {
  exercise_name: string;
  max_weight: number;
  max_reps: number;
  date: string;
}

const fadeInUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function WorkoutHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [setLogs, setSetLogs] = useState<Record<string, SetLog[]>>({});
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const fetchHistory = async () => {
      try {
        const { data: sessionData } = await supabase
          .from("coach_workout_sessions")
          .select("id, program_id, day_number, started_at, completed_at, duration_seconds, notes")
          .eq("user_id", user.id)
          .order("started_at", { ascending: false })
          .limit(30);

        if (!sessionData || sessionData.length === 0) {
          setLoading(false);
          return;
        }

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
        const { data: logs } = await supabase
          .from("coach_workout_set_logs")
          .select("id, session_id, exercise_name, set_number, reps, weight_kg, completed")
          .in("session_id", sessionIds);

        const logsBySession: Record<string, SetLog[]> = {};
        for (const log of logs || []) {
          if (!logsBySession[log.session_id]) logsBySession[log.session_id] = [];
          logsBySession[log.session_id].push(log);
        }
        setSetLogs(logsBySession);

        const exerciseMap: Record<string, { maxWeight: number; maxReps: number; date: string }> = {};
        for (const log of logs || []) {
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
  }, [user?.id]);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "—";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const totalWorkouts = sessions.filter((s) => s.completed_at).length;
  const totalMinutes = sessions.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0) / 60;

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-lg border-b border-slate-100">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center active:scale-95 transition-transform">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div>
            <h1 className="text-[17px] font-extrabold text-slate-950">Workout History</h1>
            <p className="text-[11px] text-slate-400">Your completed workout sessions</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-4 space-y-3">
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
                                    return (
                                      <div key={log.id} className="flex items-center gap-2 px-2 py-1">
                                        <span className="text-[9px] font-bold text-slate-400 w-6">Set {log.set_number}</span>
                                        <span className="text-[11px] font-mono text-slate-600">{log.reps ?? 0} reps</span>
                                        <span className="text-[11px] font-mono text-slate-600">{log.weight_kg ?? 0}kg</span>
                                        {isPR && (
                                          <span className="text-[8px] font-bold text-amber-600 bg-amber-100 px-1 py-0.5 rounded-full">PR</span>
                                        )}
                                        {log.completed ? (
                                          <span className="text-[9px] text-emerald-500 ml-auto">Done</span>
                                        ) : (
                                          <span className="text-[9px] text-slate-300 ml-auto">Skipped</span>
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
      </div>
    </div>
  );
}
