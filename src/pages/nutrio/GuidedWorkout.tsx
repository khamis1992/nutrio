import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Timer,
  Dumbbell,
  Check,
  ChevronRight,
  Trophy,
  X,
  Minus,
  Plus,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCoachPrograms, type ProgramExercise } from "@/hooks/useCoachPrograms";
import { useWorkoutSession } from "@/hooks/useWorkoutSession";
import { supabase } from "@/integrations/supabase/client";

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function GuidedWorkout() {
  const { programId, dayNumber: dayParam } = useParams<{
    programId: string;
    dayNumber: string;
  }>();
  const dayNumber = Number(dayParam) || 1;
  const navigate = useNavigate();
  const { user } = useAuth();
  const clientId = user?.id;

  // Resolve coach
  const [coachId, setCoachId] = useState<string | undefined>();
  useEffect(() => {
    if (!clientId) return;
    (async () => {
      const { data } = await supabase
        .from("coach_client_assignments")
        .select("coach_id")
        .eq("client_id", clientId)
        .eq("status", "active")
        .maybeSingle();
      setCoachId(data?.coach_id ?? undefined);
    })();
  }, [clientId]);

  const { programs, programExercises } = useCoachPrograms(coachId, clientId);
  const {
    session,
    setLogs,
    elapsedSeconds,
    loading: sessionLoading,
    startSession,
    logSet,
    completeSession,
    resetSession,
  } = useWorkoutSession();

  const program = programs.find((p) => p.id === programId);
  const exercises = useMemo(
    () =>
      programExercises
        .filter((e) => e.program_id === programId && e.day_number === dayNumber)
        .sort((a, b) => a.order_index - b.order_index),
    [programExercises, programId, dayNumber]
  );

  // Current exercise & set tracking
  const [currentExIdx, setCurrentExIdx] = useState(0);
  const [currentSetNum, setCurrentSetNum] = useState(1);
  const [weightInput, setWeightInput] = useState("");
  const [repsInput, setRepsInput] = useState("");
  const [restTimer, setRestTimer] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const currentExercise: ProgramExercise | undefined = exercises[currentExIdx];
  const totalSets = currentExercise?.sets || 0;

  // Reps input default from exercise prescription
  useEffect(() => {
    if (currentExercise) {
      const prescribedReps = parseInt(currentExercise.reps, 10);
      if (!isNaN(prescribedReps)) setRepsInput(String(prescribedReps));
    }
  }, [currentExercise]);

  // Rest timer countdown
  useEffect(() => {
    if (!isResting || restTimer <= 0) return;
    const id = setInterval(() => {
      setRestTimer((prev) => {
        if (prev <= 1) {
          setIsResting(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isResting, restTimer]);

  // Sets completed for current exercise
  const currentExerciseSets = useMemo(
    () =>
      setLogs.filter(
        (s) => s.program_exercise_id === currentExercise?.id && s.completed
      ),
    [setLogs, currentExercise]
  );

  const isSetLogged = useCallback(
    (setNum: number) => {
      return currentExerciseSets.some((s) => s.set_number === setNum);
    },
    [currentExerciseSets]
  );

  // Start the session
  const handleStart = useCallback(async () => {
    if (!clientId || !programId) return;
    await startSession(clientId, programId, dayNumber);
  }, [clientId, programId, dayNumber, startSession]);

  // Log current set
  const handleCompleteSet = useCallback(async () => {
    if (!currentExercise) return;
    const result = await logSet({
      program_exercise_id: currentExercise.id,
      exercise_name: currentExercise.exercise_name,
      set_number: currentSetNum,
      reps: parseInt(repsInput, 10) || undefined,
      weight_kg: parseFloat(weightInput) || undefined,
    });
    if (result.success) {
      const restSeconds = currentExercise.rest_seconds ?? 0;
      // If more sets remain for this exercise
      if (currentSetNum < totalSets) {
        setCurrentSetNum((prev) => prev + 1);
        // Start rest timer
        if (restSeconds > 0) {
          setRestTimer(restSeconds);
          setIsResting(true);
        }
      } else {
        // Move to next exercise
        if (currentExIdx < exercises.length - 1) {
          setCurrentExIdx((prev) => prev + 1);
          setCurrentSetNum(1);
          setWeightInput("");
          // Rest between exercises
          if (restSeconds > 0) {
            setRestTimer(restSeconds);
            setIsResting(true);
          }
        }
        // If last exercise last set — show finish button
      }
    }
  }, [currentExercise, currentSetNum, totalSets, repsInput, weightInput, logSet, currentExIdx, exercises.length]);

  // Finish workout
  const handleFinish = useCallback(async () => {
    if (!clientId) return;
    const exerciseIds = exercises.map((e) => e.id);
    const result = await completeSession(clientId, exerciseIds);
    if (result.success) {
      setShowSummary(true);
    }
  }, [clientId, exercises, completeSession]);

  // Skip rest
  const handleSkipRest = useCallback(() => {
    setIsResting(false);
    setRestTimer(0);
  }, []);

  // Not started yet — show start screen
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <h1 className="text-[16px] font-extrabold text-slate-950">Workout</h1>
        </div>
        <div className="p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[24px] p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
          >
            <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto mb-4">
              <Dumbbell className="w-8 h-8 text-purple-600" />
            </div>
            <h2 className="text-[17px] font-extrabold text-slate-950 text-center mb-1">
              {program?.title || "Workout"}
            </h2>
            <p className="text-[13px] text-slate-500 text-center mb-1">
              Day {dayNumber}
            </p>
            <p className="text-[12px] text-slate-400 text-center mb-6">
              {exercises.length} exercise{exercises.length !== 1 ? "s" : ""}
            </p>

            <div className="space-y-2 mb-6">
              {exercises.map((ex) => (
                <div
                  key={ex.id}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50"
                >
                  <span className="text-[12px] font-medium text-slate-700">
                    {ex.exercise_name}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {ex.sets}×{ex.reps}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={handleStart}
              disabled={sessionLoading || exercises.length === 0}
              className="w-full py-3.5 rounded-2xl bg-purple-600 text-white text-[14px] font-bold shadow-lg shadow-purple-200 disabled:opacity-50"
            >
              {sessionLoading ? "Starting..." : "Start Workout"}
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  // Summary screen
  if (showSummary) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1">
            <X className="w-5 h-5 text-slate-700" />
          </button>
          <h1 className="text-[16px] font-extrabold text-slate-950">
            Workout Complete
          </h1>
        </div>
        <div className="p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[24px] p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
          >
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-[20px] font-extrabold text-slate-950 text-center mb-1">
              Great job!
            </h2>
            <p className="text-[13px] text-slate-500 text-center mb-6">
              {program?.title || "Workout"} — Day {dayNumber}
            </p>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-purple-50 rounded-2xl p-3 text-center">
                <p className="text-[18px] font-extrabold text-purple-600">
                  {formatTime(elapsedSeconds)}
                </p>
                <p className="text-[10px] text-purple-400">Duration</p>
              </div>
              <div className="bg-emerald-50 rounded-2xl p-3 text-center">
                <p className="text-[18px] font-extrabold text-emerald-600">
                  {setLogs.filter((s) => s.completed).length}
                </p>
                <p className="text-[10px] text-emerald-400">Sets</p>
              </div>
              <div className="bg-amber-50 rounded-2xl p-3 text-center">
                <p className="text-[18px] font-extrabold text-amber-600">
                  {exercises.length}
                </p>
                <p className="text-[10px] text-amber-400">Exercises</p>
              </div>
            </div>

            <div className="space-y-2 mb-6">
              {exercises.map((ex) => {
                const exSets = setLogs.filter(
                  (s) => s.program_exercise_id === ex.id && s.completed
                );
                return (
                  <div
                    key={ex.id}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50"
                  >
                    <span className="text-[12px] font-medium text-slate-700">
                      {ex.exercise_name}
                    </span>
                    <div className="flex items-center gap-2">
                      {exSets.length > 0 && (
                        <span className="text-[11px] text-slate-400">
                          {exSets[exSets.length - 1].weight_kg
                            ? `${exSets[exSets.length - 1].weight_kg}kg`
                            : `${exSets[exSets.length - 1].reps} reps`}
                        </span>
                      )}
                      <span className="text-[11px] font-bold text-emerald-600">
                        {exSets.length}/{ex.sets}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => {
                resetSession();
                navigate("/coach-programs");
              }}
              className="w-full py-3.5 rounded-2xl bg-purple-600 text-white text-[14px] font-bold shadow-lg shadow-purple-200"
            >
              Done
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  // Active workout
  const allSetsDone =
    currentExIdx === exercises.length - 1 &&
    currentSetNum > totalSets;

  const allExercisesCompleted = exercises.every((ex) => {
    const exSets = setLogs.filter(
      (s) => s.program_exercise_id === ex.id && s.completed
    );
    return exSets.length >= ex.sets;
  });

  const canFinish = allSetsDone || allExercisesCompleted;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <div>
            <h1 className="text-[14px] font-extrabold text-slate-950">
              Day {dayNumber}
            </h1>
            <p className="text-[10px] text-slate-400">
              {program?.title || "Workout"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-full">
          <Timer className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-[12px] font-bold text-slate-700 tabular-nums">
            {formatTime(elapsedSeconds)}
          </span>
        </div>
      </div>

      {/* Progress dots */}
      <div className="px-4 py-3 flex items-center justify-center gap-1.5">
        {exercises.map((_, i) => {
          const exSets = setLogs.filter(
            (s) => s.program_exercise_id === exercises[i].id && s.completed
          );
          const done = exSets.length >= exercises[i].sets;
          const active = i === currentExIdx;
          return (
            <div
              key={i}
              onClick={() => {
                if (!isResting) {
                  setCurrentExIdx(i);
                  setCurrentSetNum(exSets.length + 1);
                }
              }}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition-all cursor-pointer ${
                done
                  ? "bg-emerald-500 text-white"
                  : active
                  ? "bg-purple-600 text-white ring-2 ring-purple-200"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {done ? <Check className="w-4 h-4" /> : i + 1}
            </div>
          );
        })}
      </div>

      {/* Rest timer overlay */}
      <AnimatePresence>
        {isResting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-20 bg-black/50 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-[24px] p-8 text-center mx-4"
            >
              <p className="text-[12px] font-bold text-slate-400 uppercase mb-2">
                Rest
              </p>
              <p className="text-[48px] font-extrabold text-purple-600 tabular-nums">
                {Math.floor(restTimer / 60)}:
                {(restTimer % 60).toString().padStart(2, "0")}
              </p>
              <p className="text-[12px] text-slate-400 mb-4">
                Next: {currentExercise?.exercise_name} — Set{" "}
                {currentSetNum > totalSets ? 1 : currentSetNum}
              </p>
              <button
                onClick={handleSkipRest}
                className="px-6 py-2 rounded-full bg-slate-100 text-[13px] font-bold text-slate-600"
              >
                Skip Rest
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exercise card */}
      <div className="p-4">
        {currentExercise && (
          <motion.div
            key={currentExIdx}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[17px] font-extrabold text-slate-950">
                  {currentExercise.exercise_name}
                </h2>
                <p className="text-[12px] text-slate-400">
                  Exercise {currentExIdx + 1} of {exercises.length}
                </p>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-purple-50 text-[11px] font-bold text-purple-600">
                {currentExerciseSets.length}/{totalSets} sets
              </div>
            </div>

            {/* Prescription */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 bg-slate-50 rounded-xl p-2.5 text-center">
                <p className="text-[16px] font-extrabold text-slate-800">
                  {currentExercise.sets}
                </p>
                <p className="text-[10px] text-slate-400">Sets</p>
              </div>
              <div className="flex-1 bg-slate-50 rounded-xl p-2.5 text-center">
                <p className="text-[16px] font-extrabold text-slate-800">
                  {currentExercise.reps}
                </p>
                <p className="text-[10px] text-slate-400">Reps</p>
              </div>
              <div className="flex-1 bg-slate-50 rounded-xl p-2.5 text-center">
                <p className="text-[16px] font-extrabold text-slate-800">
                  {currentExercise.rest_seconds}s
                </p>
                <p className="text-[10px] text-slate-400">Rest</p>
              </div>
            </div>

            {/* Set dots */}
            <div className="flex items-center gap-2 mb-4">
              {Array.from({ length: totalSets }, (_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-2 rounded-full transition-all ${
                    isSetLogged(i + 1)
                      ? "bg-emerald-500"
                      : i + 1 === currentSetNum
                      ? "bg-purple-400"
                      : "bg-slate-100"
                  }`}
                />
              ))}
            </div>

            {/* Weight & Reps inputs */}
            {!allSetsDone && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">
                    Weight (kg)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setWeightInput((prev) =>
                          String(Math.max(0, (parseFloat(prev) || 0) - 2.5))
                        )
                      }
                      className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center"
                    >
                      <Minus className="w-4 h-4 text-slate-500" />
                    </button>
                    <input
                      type="number"
                      value={weightInput}
                      onChange={(e) => setWeightInput(e.target.value)}
                      placeholder="0"
                      className="flex-1 h-9 rounded-xl bg-slate-50 text-center text-[14px] font-bold text-slate-800 outline-none ring-1 ring-slate-200 focus:ring-purple-400"
                    />
                    <button
                      onClick={() =>
                        setWeightInput((prev) =>
                          String((parseFloat(prev) || 0) + 2.5)
                        )
                      }
                      className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center"
                    >
                      <Plus className="w-4 h-4 text-slate-500" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">
                    Reps
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setRepsInput((prev) =>
                          String(Math.max(1, (parseInt(prev) || 0) - 1))
                        )
                      }
                      className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center"
                    >
                      <Minus className="w-4 h-4 text-slate-500" />
                    </button>
                    <input
                      type="number"
                      value={repsInput}
                      onChange={(e) => setRepsInput(e.target.value)}
                      placeholder="0"
                      className="flex-1 h-9 rounded-xl bg-slate-50 text-center text-[14px] font-bold text-slate-800 outline-none ring-1 ring-slate-200 focus:ring-purple-400"
                    />
                    <button
                      onClick={() =>
                        setRepsInput((prev) =>
                          String((parseInt(prev) || 0) + 1)
                        )
                      }
                      className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center"
                    >
                      <Plus className="w-4 h-4 text-slate-500" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Action button */}
            {!canFinish ? (
              <button
                onClick={handleCompleteSet}
                disabled={isResting || isSetLogged(currentSetNum)}
                className="w-full py-3.5 rounded-2xl bg-purple-600 text-white text-[14px] font-bold shadow-lg shadow-purple-200 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                {isSetLogged(currentSetNum)
                  ? `Set ${currentSetNum} Done`
                  : `Complete Set ${currentSetNum}`}
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={sessionLoading}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 text-white text-[14px] font-bold shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
              >
                <Trophy className="w-4 h-4" />
                {sessionLoading ? "Finishing..." : "Finish Workout"}
              </button>
            )}

            {/* Notes */}
            {currentExercise.notes && (
              <p className="text-[11px] text-slate-400 mt-3 text-center">
                💡 {currentExercise.notes}
              </p>
            )}
          </motion.div>
        )}

        {/* Exercise list summary */}
        <div className="mt-4 space-y-1.5">
          {exercises.map((ex, i) => {
            const exSets = setLogs.filter(
              (s) => s.program_exercise_id === ex.id && s.completed
            );
            const done = exSets.length >= ex.sets;
            return (
              <div
                key={ex.id}
                onClick={() => {
                  if (!isResting) {
                    setCurrentExIdx(i);
                    setCurrentSetNum(exSets.length + 1);
                  }
                }}
                className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all ${
                  i === currentExIdx
                    ? "bg-purple-50 ring-1 ring-purple-200"
                    : "bg-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center ${
                      done
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <Check className="w-3 h-3" />
                  </div>
                  <span
                    className={`text-[12px] font-medium ${
                      done ? "text-slate-400 line-through" : "text-slate-700"
                    }`}
                  >
                    {ex.exercise_name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">
                    {exSets.length}/{ex.sets}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
