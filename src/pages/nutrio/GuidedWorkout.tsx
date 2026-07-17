import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock3,
  Dumbbell,
  Info,
  ListChecks,
  Minus,
  Pause,
  Play,
  Plus,
  Scale,
  Sparkles,
  Target,
  Timer,
  Trophy,
  X,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { ExerciseCatalogSheet } from "@/components/exercises/ExerciseCatalogSheet";
import { ExerciseMedia } from "@/components/exercises/ExerciseMedia";
import { useAuth } from "@/contexts/AuthContext";
import { useCoachPrograms, type ProgramExercise } from "@/hooks/useCoachPrograms";
import { useExerciseCatalog } from "@/hooks/useExerciseCatalog";
import { useWorkoutSession } from "@/hooks/useWorkoutSession";
import { supabase } from "@/integrations/supabase/client";
import { formatExerciseLabel, type ExerciseCatalogItem } from "@/lib/exercise-catalog";
import { cn } from "@/lib/utils";

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function formatDate(value?: string): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
  const [coachId, setCoachId] = useState<string | undefined>();
  const [assignmentLoading, setAssignmentLoading] = useState(true);

  useEffect(() => {
    if (!clientId) {
      setAssignmentLoading(false);
      return;
    }

    let active = true;
    void (async () => {
      const { data, error } = await supabase
        .from("coach_client_assignments")
        .select("coach_id")
        .eq("client_id", clientId)
        .eq("status", "active")
        .maybeSingle();

      if (!active) return;
      if (error) console.error("Error resolving workout coach:", error);
      setCoachId(data?.coach_id ?? undefined);
      setAssignmentLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [clientId]);

  const { programs, programExercises, loading: programsLoading } = useCoachPrograms(coachId, clientId);
  const { exercises: catalog, loading: catalogLoading } = useExerciseCatalog();
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

  const catalogById = useMemo(
    () => new Map(catalog.map((exercise) => [exercise.id, exercise])),
    [catalog],
  );
  const program = programs.find((item) => item.id === programId);
  const exercises = useMemo(
    () =>
      programExercises
        .filter((exercise) => exercise.program_id === programId && exercise.day_number === dayNumber)
        .sort((a, b) => a.order_index - b.order_index),
    [dayNumber, programExercises, programId],
  );

  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSetNumber, setCurrentSetNumber] = useState(1);
  const [weightInput, setWeightInput] = useState("");
  const [repsInput, setRepsInput] = useState("");
  const [restTimer, setRestTimer] = useState(0);
  const [restDuration, setRestDuration] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsExerciseId, setDetailsExerciseId] = useState<string | null>(null);

  const currentExercise: ProgramExercise | undefined = exercises[currentExerciseIndex];
  const currentCatalogExercise = currentExercise?.exercise_catalog_id
    ? catalogById.get(currentExercise.exercise_catalog_id)
    : undefined;
  const totalSets = currentExercise?.sets || 0;
  const totalPlannedSets = exercises.reduce((total, exercise) => total + exercise.sets, 0);
  const assignedCatalogExercises = exercises
    .map((exercise) => exercise.exercise_catalog_id ? catalogById.get(exercise.exercise_catalog_id) : undefined)
    .filter((exercise): exercise is ExerciseCatalogItem => Boolean(exercise));
  const focusAreas = [...new Set(assignedCatalogExercises.map((exercise) => exercise.target))]
    .slice(0, 2)
    .map(formatExerciseLabel)
    .join(", ");
  const equipmentNeeded = [...new Set(assignedCatalogExercises.map((exercise) => exercise.equipment))]
    .slice(0, 2)
    .map(formatExerciseLabel)
    .join(", ");
  const recoverySeconds = Math.max(...exercises.map((exercise) => exercise.rest_seconds ?? 0), 0);
  const completedSets = setLogs.filter((set) => set.completed).length;
  const workoutProgress = totalPlannedSets > 0
    ? Math.min(100, Math.round((completedSets / totalPlannedSets) * 100))
    : 0;

  useEffect(() => {
    if (!currentExercise) return;
    const prescribedReps = Number.parseInt(currentExercise.reps, 10);
    setRepsInput(Number.isNaN(prescribedReps) ? "" : String(prescribedReps));
  }, [currentExercise]);

  useEffect(() => {
    if (!isResting || restTimer <= 0) return;
    const timer = window.setInterval(() => {
      setRestTimer((current) => {
        if (current <= 1) {
          setIsResting(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isResting, restTimer]);

  const currentExerciseSets = useMemo(
    () => setLogs.filter(
      (set) => set.program_exercise_id === currentExercise?.id && set.completed,
    ),
    [currentExercise?.id, setLogs],
  );

  const isSetLogged = useCallback(
    (setNumber: number) => currentExerciseSets.some((set) => set.set_number === setNumber),
    [currentExerciseSets],
  );

  const openExerciseDetails = (exercise: ProgramExercise) => {
    if (!exercise.exercise_catalog_id) return;
    setDetailsExerciseId(exercise.exercise_catalog_id);
    setDetailsOpen(true);
  };

  const handleBack = () => {
    if (session && !showSummary) {
      const shouldLeave = window.confirm("Leave this workout? Your completed sets are already saved.");
      if (!shouldLeave) return;
    }
    navigate(-1);
  };

  const handleStart = useCallback(async () => {
    if (!clientId || !programId) return;
    const result = await startSession(clientId, programId, dayNumber);
    if (!result.success) toast.error(result.error?.message || "Unable to start this workout.");
  }, [clientId, dayNumber, programId, startSession]);

  const beginRest = (seconds: number) => {
    if (seconds <= 0) return;
    setRestDuration(seconds);
    setRestTimer(seconds);
    setIsResting(true);
  };

  const handleCompleteSet = useCallback(async () => {
    if (!currentExercise) return;
    const result = await logSet({
      program_exercise_id: currentExercise.id,
      exercise_name: currentExercise.exercise_name,
      set_number: currentSetNumber,
      reps: Number.parseInt(repsInput, 10) || undefined,
      weight_kg: Number.parseFloat(weightInput) || undefined,
    });

    if (!result.success) {
      toast.error(result.error?.message || "Unable to save this set.");
      return;
    }

    const restSeconds = currentExercise.rest_seconds ?? 0;
    if (currentSetNumber < totalSets) {
      setCurrentSetNumber((current) => current + 1);
      beginRest(restSeconds);
      return;
    }

    if (currentExerciseIndex < exercises.length - 1) {
      setCurrentExerciseIndex((current) => current + 1);
      setCurrentSetNumber(1);
      setWeightInput("");
      beginRest(restSeconds);
    }
  }, [currentExercise, currentExerciseIndex, currentSetNumber, exercises.length, logSet, repsInput, totalSets, weightInput]);

  const handleFinish = useCallback(async () => {
    if (!clientId) return;
    const result = await completeSession(clientId, exercises.map((exercise) => exercise.id));
    if (result.success) {
      setShowSummary(true);
    } else {
      toast.error(result.error?.message || "Unable to finish this workout.");
    }
  }, [clientId, completeSession, exercises]);

  const selectExercise = (index: number) => {
    if (isResting) return;
    const exercise = exercises[index];
    const loggedSets = setLogs.filter(
      (set) => set.program_exercise_id === exercise.id && set.completed,
    ).length;
    setCurrentExerciseIndex(index);
    setCurrentSetNumber(Math.min(loggedSets + 1, exercise.sets));
    setWeightInput("");
  };

  const allExercisesCompleted = exercises.length > 0 && exercises.every((exercise) => {
    const exerciseSets = setLogs.filter(
      (set) => set.program_exercise_id === exercise.id && set.completed,
    );
    return exerciseSets.length >= exercise.sets;
  });

  const loading = assignmentLoading || programsLoading || catalogLoading;

  if (loading) {
    return <WorkoutLoading />;
  }

  if (!program || exercises.length === 0) {
    return (
      <WorkoutShell>
        <WorkoutHeader title="Workout" onBack={() => navigate(-1)} />
        <div className="px-4 py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#E9FBF7] text-[#16A98A]">
            <Dumbbell className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-[20px] font-extrabold text-[#07152F]">This session is not available</h1>
          <p className="mx-auto mt-2 max-w-[290px] text-[13px] leading-6 text-[#71809C]">
            The workout may have been updated by your coach. Return to your plan to see the latest schedule.
          </p>
          <button onClick={() => navigate("/coach-programs")} className="mt-6 min-h-12 rounded-[16px] bg-[#22C7A1] px-6 text-[13px] font-extrabold text-white">
            Back to my plan
          </button>
        </div>
      </WorkoutShell>
    );
  }

  if (!session) {
    return (
      <WorkoutShell>
        <WorkoutHeader title="Workout preview" onBack={() => navigate(-1)} />
        <main className="mx-auto w-full max-w-[430px] space-y-4 px-3.5 pb-[calc(112px+env(safe-area-inset-bottom,0px))] pt-3">
          <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_16px_38px_rgba(15,23,42,0.07)] ring-1 ring-[#DDE5EF]">
            <div className="bg-[#F1FBF8] px-5 pb-5 pt-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#0E9F83]">Coach workout</p>
                  <h1 className="mt-2 text-[26px] font-extrabold leading-[1.08] text-[#07152F]">Day {dayNumber} workout</h1>
                  <p className="mt-2 line-clamp-1 text-[13px] font-semibold text-[#596982]">{program.title}</p>
                </div>
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[19px] bg-white text-[#16A98A] shadow-sm ring-1 ring-[#BCECDF]">
                  <Dumbbell className="h-6 w-6" />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 divide-x divide-[#DDE5EF] rounded-[19px] bg-white py-3 ring-1 ring-[#DDE5EF]">
                <SessionMetric value={exercises.length} label="Exercises" />
                <SessionMetric value={totalPlannedSets} label="Total sets" />
                <SessionMetric value={`${formatDate(program.start_date)}-${formatDate(program.end_date)}`} label="Plan range" compact />
              </div>
            </div>
          </section>

          <section className="rounded-[28px] bg-white p-4 shadow-[0_16px_38px_rgba(15,23,42,0.06)] ring-1 ring-[#DDE5EF]">
            <div className="flex items-center justify-between px-1 pb-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#7C83F6]">Session order</p>
                <h2 className="mt-1 text-[19px] font-extrabold text-[#07152F]">Know every movement</h2>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#F1EEFF] text-[#7C83F6]">
                <ListChecks className="h-5 w-5" />
              </span>
            </div>

            <div className="space-y-3">
              {exercises.map((exercise, index) => (
                <ExercisePreviewCard
                  key={exercise.id}
                  exercise={exercise}
                  catalogExercise={exercise.exercise_catalog_id ? catalogById.get(exercise.exercise_catalog_id) : undefined}
                  index={index}
                  onDetails={() => openExerciseDetails(exercise)}
                />
              ))}
            </div>
          </section>

          <section className="rounded-[24px] bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)] ring-1 ring-[#DDE5EF]">
            <div className="flex items-center gap-2 px-1 pb-3">
              <Sparkles className="h-4 w-4 text-[#E79527]" />
              <h2 className="text-[15px] font-extrabold text-[#07152F]">Session setup</h2>
            </div>
            <div className="grid grid-cols-3 divide-x divide-[#DDE5EF] rounded-[18px] bg-[#F8FAFC] py-3 ring-1 ring-[#E5EAF1]">
              <SetupMetric icon={<Target className="h-4 w-4" />} label="Focus" value={focusAreas || "Coach plan"} color="text-[#16A98A]" />
              <SetupMetric icon={<Dumbbell className="h-4 w-4" />} label="Equipment" value={equipmentNeeded || "As assigned"} color="text-[#7C83F6]" />
              <SetupMetric icon={<Timer className="h-4 w-4" />} label="Recovery" value={`${recoverySeconds}s`} color="text-[#E45F58]" />
            </div>
          </section>
        </main>

        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[430px] border-t border-[#DDE5EF] bg-white/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur-xl">
          <button
            onClick={handleStart}
            disabled={sessionLoading}
            className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#22C7A1] text-[14px] font-extrabold text-white shadow-[0_12px_26px_rgba(34,199,161,0.28)] transition active:scale-[0.98] disabled:opacity-50"
          >
            {sessionLoading ? <Pause className="h-5 w-5 animate-pulse" /> : <Play className="h-5 w-5 fill-current" />}
            {sessionLoading ? "Preparing session..." : "Start workout"}
          </button>
        </div>

        <ExerciseDetailsSheet
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          exerciseId={detailsExerciseId}
        />
      </WorkoutShell>
    );
  }

  if (showSummary) {
    return (
      <WorkoutShell>
        <WorkoutHeader title="Workout complete" onBack={() => navigate("/coach-programs")} close />
        <main className="mx-auto w-full max-w-[430px] space-y-4 px-3.5 pb-6 pt-4">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[28px] bg-white px-5 pb-5 pt-7 text-center shadow-[0_16px_38px_rgba(15,23,42,0.07)] ring-1 ring-[#DDE5EF]"
          >
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#E9FBF7] text-[#16A98A] ring-8 ring-[#F4FCFA]">
              <Trophy className="h-9 w-9" />
            </div>
            <p className="mt-6 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E9F83]">Session complete</p>
            <h1 className="mt-2 text-[27px] font-extrabold text-[#07152F]">Strong work today</h1>
            <p className="mt-2 text-[13px] font-medium text-[#71809C]">{program.title} · Day {dayNumber}</p>

            <div className="mt-6 grid grid-cols-3 divide-x divide-[#DDE5EF] rounded-[20px] bg-[#F7F9FC] py-4 ring-1 ring-[#E5EAF1]">
              <SessionMetric value={formatTime(elapsedSeconds)} label="Duration" />
              <SessionMetric value={completedSets} label="Sets" />
              <SessionMetric value={exercises.length} label="Exercises" />
            </div>
          </motion.section>

          <section className="rounded-[28px] bg-white p-4 shadow-[0_16px_38px_rgba(15,23,42,0.06)] ring-1 ring-[#DDE5EF]">
            <div className="flex items-center gap-2 px-1 pb-3">
              <Sparkles className="h-4 w-4 text-[#7C83F6]" />
              <h2 className="text-[16px] font-extrabold text-[#07152F]">Session recap</h2>
            </div>
            <div className="space-y-2.5">
              {exercises.map((exercise) => {
                const exerciseSets = setLogs.filter(
                  (set) => set.program_exercise_id === exercise.id && set.completed,
                );
                const latestSet = exerciseSets.at(-1);
                const catalogExercise = exercise.exercise_catalog_id
                  ? catalogById.get(exercise.exercise_catalog_id)
                  : undefined;
                return (
                  <div key={exercise.id} className="flex min-h-[72px] items-center gap-3 rounded-[18px] bg-[#F8FAFC] p-2.5 ring-1 ring-[#E5EAF1]">
                    <ExerciseThumb exercise={catalogExercise} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-extrabold text-[#07152F]">{exercise.exercise_name}</p>
                      <p className="mt-1 text-[10px] font-semibold text-[#71809C]">
                        {latestSet?.weight_kg ? `${latestSet.weight_kg} kg · ` : ""}{latestSet?.reps ?? exercise.reps} reps
                      </p>
                    </div>
                    <span className="rounded-full bg-[#E9FBF7] px-2.5 py-1 text-[10px] font-extrabold text-[#0E9F83]">
                      {exerciseSets.length}/{exercise.sets}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <button
            onClick={() => {
              resetSession();
              navigate("/coach-programs");
            }}
            className="min-h-[54px] w-full rounded-[18px] bg-[#22C7A1] text-[14px] font-extrabold text-white shadow-[0_12px_26px_rgba(34,199,161,0.25)]"
          >
            Return to my plan
          </button>
        </main>
      </WorkoutShell>
    );
  }

  return (
    <WorkoutShell>
      <WorkoutHeader
        title={`Day ${dayNumber}`}
        subtitle={program.title}
        onBack={handleBack}
        trailing={
          <div className="flex h-10 items-center gap-1.5 rounded-full bg-[#F4F7FA] px-3 ring-1 ring-[#DDE5EF]">
            <Timer className="h-4 w-4 text-[#16A98A]" />
            <span className="text-[12px] font-extrabold tabular-nums text-[#07152F]">{formatTime(elapsedSeconds)}</span>
          </div>
        }
      />

      <main className="mx-auto w-full max-w-[430px] space-y-4 px-3.5 pb-[calc(116px+env(safe-area-inset-bottom,0px))] pt-3">
        <section className="rounded-[22px] bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)] ring-1 ring-[#DDE5EF]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#0E9F83]">Workout progress</p>
              <p className="mt-1 text-[13px] font-bold text-[#596982]">{completedSets} of {totalPlannedSets} sets complete</p>
            </div>
            <span className="text-[20px] font-extrabold text-[#07152F]">{workoutProgress}%</span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#E5EAF1]">
            <motion.div className="h-full rounded-full bg-[#22C7A1]" animate={{ width: `${workoutProgress}%` }} />
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {exercises.map((exercise, index) => {
              const exerciseSetCount = setLogs.filter(
                (set) => set.program_exercise_id === exercise.id && set.completed,
              ).length;
              const done = exerciseSetCount >= exercise.sets;
              const active = index === currentExerciseIndex;
              return (
                <button
                  key={exercise.id}
                  type="button"
                  onClick={() => selectExercise(index)}
                  className={cn(
                    "flex h-11 min-w-11 items-center justify-center rounded-[14px] text-[12px] font-extrabold transition",
                    done && "bg-[#22C7A1] text-white",
                    active && !done && "bg-[#E9FBF7] text-[#087B67] ring-1 ring-[#A9E8D9]",
                    !active && !done && "bg-[#F4F7FA] text-[#8A98AF] ring-1 ring-[#E1E7EF]",
                  )}
                  aria-label={`Go to ${exercise.exercise_name}`}
                >
                  {done ? <Check className="h-4 w-4" /> : index + 1}
                </button>
              );
            })}
          </div>
        </section>

        {currentExercise && (
          <motion.section
            key={currentExercise.id}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            className="overflow-hidden rounded-[28px] bg-white shadow-[0_16px_38px_rgba(15,23,42,0.07)] ring-1 ring-[#DDE5EF]"
          >
            <div className="relative aspect-[16/11] bg-[#F3FAF8]">
              {currentCatalogExercise ? (
                <ExerciseMedia
                  exercise={currentCatalogExercise}
                  alt={formatExerciseLabel(currentCatalogExercise.name)}
                  className="h-full w-full object-contain p-4"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[#7C83F6]"><Dumbbell className="h-12 w-12" /></div>
              )}
              <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-extrabold text-[#596982] shadow-sm ring-1 ring-[#DDE5EF]">
                Exercise {currentExerciseIndex + 1} of {exercises.length}
              </span>
              {currentCatalogExercise && (
                <button
                  type="button"
                  onClick={() => openExerciseDetails(currentExercise)}
                  className="absolute bottom-4 right-4 flex min-h-11 items-center gap-2 rounded-[15px] bg-white/95 px-3 text-[11px] font-extrabold text-[#07152F] shadow-md ring-1 ring-[#DDE5EF]"
                >
                  <Info className="h-4 w-4 text-[#7C83F6]" /> Instructions
                </button>
              )}
            </div>

            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#7C83F6]">Current movement</p>
                  <h1 className="mt-1 text-[22px] font-extrabold leading-tight text-[#07152F]">{currentExercise.exercise_name}</h1>
                  {currentCatalogExercise && (
                    <p className="mt-1.5 text-[11px] font-semibold capitalize text-[#71809C]">
                      {currentCatalogExercise.target} · {currentCatalogExercise.equipment}
                    </p>
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-[#E9FBF7] px-3 py-1.5 text-[11px] font-extrabold text-[#087B67]">
                  Set {Math.min(currentSetNumber, totalSets)} of {totalSets}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2">
                <Prescription value={currentExercise.sets} label="Sets" color="mint" />
                <Prescription value={currentExercise.reps} label="Reps" color="blue" />
                <Prescription value={`${currentExercise.rest_seconds ?? 0}s`} label="Rest" color="coral" />
              </div>

              <div className="mt-5 flex gap-2">
                {Array.from({ length: totalSets }, (_, index) => (
                  <div
                    key={index}
                    className={cn(
                      "h-2 flex-1 rounded-full",
                      isSetLogged(index + 1) && "bg-[#22C7A1]",
                      !isSetLogged(index + 1) && index + 1 === currentSetNumber && "bg-[#7C83F6]",
                      !isSetLogged(index + 1) && index + 1 !== currentSetNumber && "bg-[#E5EAF1]",
                    )}
                  />
                ))}
              </div>

              {currentExercise.notes && (
                <div className="mt-5 flex gap-3 rounded-[18px] bg-[#FFF8EC] p-3.5 ring-1 ring-[#F8E1B9]">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-white text-[#E79527] ring-1 ring-[#F3D7A5]">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#C77B1C]">Coach cue</p>
                    <p className="mt-1 text-[11px] font-medium leading-5 text-[#6D5A3F]">{currentExercise.notes}</p>
                  </div>
                </div>
              )}

              {!allExercisesCompleted && (
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <NumberStepper
                    icon={<Scale className="h-4 w-4" />}
                    label="Weight"
                    suffix="kg"
                    value={weightInput}
                    placeholder="0"
                    onChange={setWeightInput}
                    onDecrease={() => setWeightInput((current) => String(Math.max(0, (Number.parseFloat(current) || 0) - 2.5)))}
                    onIncrease={() => setWeightInput((current) => String((Number.parseFloat(current) || 0) + 2.5))}
                  />
                  <NumberStepper
                    icon={<Target className="h-4 w-4" />}
                    label="Reps"
                    value={repsInput}
                    placeholder="0"
                    onChange={setRepsInput}
                    onDecrease={() => setRepsInput((current) => String(Math.max(1, (Number.parseInt(current, 10) || 0) - 1)))}
                    onIncrease={() => setRepsInput((current) => String((Number.parseInt(current, 10) || 0) + 1))}
                  />
                </div>
              )}
            </div>
          </motion.section>
        )}

        <section className="rounded-[28px] bg-white p-4 shadow-[0_16px_38px_rgba(15,23,42,0.05)] ring-1 ring-[#DDE5EF]">
          <div className="flex items-center justify-between px-1 pb-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#0E9F83]">Workout queue</p>
              <h2 className="mt-1 text-[17px] font-extrabold text-[#07152F]">Today&apos;s movements</h2>
            </div>
            <span className="text-[11px] font-bold text-[#71809C]">{exercises.length} total</span>
          </div>
          <div className="space-y-2.5">
            {exercises.map((exercise, index) => {
              const exerciseSetCount = setLogs.filter(
                (set) => set.program_exercise_id === exercise.id && set.completed,
              ).length;
              const done = exerciseSetCount >= exercise.sets;
              return (
                <button
                  key={exercise.id}
                  type="button"
                  onClick={() => selectExercise(index)}
                  className={cn(
                    "flex min-h-[72px] w-full items-center gap-3 rounded-[18px] p-2.5 text-left ring-1 transition",
                    index === currentExerciseIndex ? "bg-[#F1FBF8] ring-[#A9E8D9]" : "bg-[#F8FAFC] ring-[#E5EAF1]",
                  )}
                >
                  <ExerciseThumb exercise={exercise.exercise_catalog_id ? catalogById.get(exercise.exercise_catalog_id) : undefined} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-[12px] font-extrabold", done ? "text-[#8A98AF] line-through" : "text-[#07152F]")}>{exercise.exercise_name}</span>
                    <span className="mt-1 block text-[10px] font-semibold text-[#71809C]">{exerciseSetCount}/{exercise.sets} sets · {exercise.reps} reps</span>
                  </span>
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", done ? "bg-[#22C7A1] text-white" : "bg-white text-[#B0BAC9] ring-1 ring-[#DDE5EF]") }>
                    {done ? <Check className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[430px] border-t border-[#DDE5EF] bg-white/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur-xl">
        {allExercisesCompleted ? (
          <button
            onClick={handleFinish}
            disabled={sessionLoading}
            className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#22C7A1] text-[14px] font-extrabold text-white shadow-[0_12px_26px_rgba(34,199,161,0.28)] disabled:opacity-50"
          >
            <Trophy className="h-5 w-5" /> {sessionLoading ? "Saving workout..." : "Finish workout"}
          </button>
        ) : (
          <button
            onClick={handleCompleteSet}
            disabled={sessionLoading || isResting || isSetLogged(currentSetNumber)}
            className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#7C83F6] text-[14px] font-extrabold text-white shadow-[0_12px_26px_rgba(124,131,246,0.25)] transition active:scale-[0.98] disabled:opacity-45"
          >
            <Check className="h-5 w-5" />
            {sessionLoading ? "Saving set..." : `Complete set ${Math.min(currentSetNumber, totalSets)}`}
          </button>
        )}
      </div>

      <AnimatePresence>
        {isResting && (
          <RestOverlay
            seconds={restTimer}
            duration={restDuration}
            nextExercise={currentExercise?.exercise_name || "Next exercise"}
            nextSet={Math.min(currentSetNumber, totalSets)}
            onSkip={() => {
              setIsResting(false);
              setRestTimer(0);
            }}
          />
        )}
      </AnimatePresence>

      <ExerciseDetailsSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        exerciseId={detailsExerciseId}
      />
    </WorkoutShell>
  );
}

function WorkoutShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100dvh] bg-[#F4F7FA] text-[#07152F]">{children}</div>;
}

function WorkoutHeader({
  title,
  subtitle,
  onBack,
  trailing,
  close = false,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  trailing?: React.ReactNode;
  close?: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-[#DDE5EF] bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[64px] max-w-[430px] items-center gap-3 px-4">
        <button onClick={onBack} aria-label={close ? "Close workout" : "Back"} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F4F7FA] text-[#07152F] ring-1 ring-[#DDE5EF]">
          {close ? <X className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-extrabold text-[#07152F]">{title}</h1>
          {subtitle && <p className="mt-0.5 truncate text-[10px] font-semibold text-[#8A98AF]">{subtitle}</p>}
        </div>
        {trailing}
      </div>
    </header>
  );
}

function ExercisePreviewCard({
  exercise,
  catalogExercise,
  index,
  onDetails,
}: {
  exercise: ProgramExercise;
  catalogExercise?: ExerciseCatalogItem;
  index: number;
  onDetails: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-[22px] bg-[#F8FAFC] ring-1 ring-[#E1E7EF]">
      <div className="flex min-h-[112px] gap-3 p-3">
        <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-[18px] bg-white ring-1 ring-[#E1E7EF]">
          {catalogExercise ? (
            <ExerciseMedia exercise={catalogExercise} alt="" loading="lazy" className="h-full w-full object-contain p-1" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[#7C83F6]"><Dumbbell className="h-7 w-7" /></span>
          )}
          <span className="absolute left-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[9px] font-extrabold text-[#07152F] shadow-sm">{index + 1}</span>
        </div>
        <div className="min-w-0 flex-1 py-1">
          <h3 className="line-clamp-2 text-[14px] font-extrabold leading-[18px] text-[#07152F]">{exercise.exercise_name}</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-white px-2 py-1 text-[9px] font-bold text-[#596982] ring-1 ring-[#E1E7EF]">{exercise.sets} sets</span>
            <span className="rounded-full bg-white px-2 py-1 text-[9px] font-bold text-[#596982] ring-1 ring-[#E1E7EF]">{exercise.reps} reps</span>
            <span className="flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[9px] font-bold text-[#596982] ring-1 ring-[#E1E7EF]"><Clock3 className="h-3 w-3" />{exercise.rest_seconds ?? 0}s</span>
          </div>
          {catalogExercise && (
            <button onClick={onDetails} className="mt-2 flex min-h-7 items-center gap-1 text-[10px] font-extrabold text-[#7C83F6]">
              View instructions <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      {exercise.notes && (
        <div className="border-t border-[#E8E2C9] bg-[#FFF9EC] px-4 py-3 text-[10px] font-medium leading-4 text-[#756347]">
          <span className="font-extrabold text-[#C77B1C]">Coach cue: </span>{exercise.notes}
        </div>
      )}
    </article>
  );
}

function ExerciseThumb({ exercise }: { exercise?: ExerciseCatalogItem }) {
  return (
    <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-[15px] bg-white text-[#7C83F6] ring-1 ring-[#E1E7EF]">
      {exercise ? <ExerciseMedia exercise={exercise} alt="" loading="lazy" className="h-full w-full object-contain p-1" /> : <Dumbbell className="h-5 w-5" />}
    </span>
  );
}

function SessionMetric({ value, label, compact = false }: { value: string | number; label: string; compact?: boolean }) {
  return (
    <div className="min-w-0 px-2 text-center">
      <p className={cn("truncate font-extrabold leading-none text-[#07152F]", compact ? "text-[10px]" : "text-[18px]")}>{value}</p>
      <p className="mt-1.5 text-[8px] font-bold uppercase tracking-[0.08em] text-[#8A98AF]">{label}</p>
    </div>
  );
}

function SetupMetric({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="min-w-0 px-2 text-center">
      <span className={cn("mx-auto flex h-7 w-7 items-center justify-center rounded-[10px] bg-white ring-1 ring-[#E1E7EF]", color)}>{icon}</span>
      <p className="mt-2 truncate text-[9px] font-extrabold text-[#07152F]">{value}</p>
      <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.07em] text-[#8A98AF]">{label}</p>
    </div>
  );
}

function Prescription({ value, label, color }: { value: string | number; label: string; color: "mint" | "blue" | "coral" }) {
  const colors = {
    mint: "bg-[#E9FBF7] text-[#087B67] ring-[#BCECDF]",
    blue: "bg-[#EDF7FF] text-[#338DCE] ring-[#CFE8FA]",
    coral: "bg-[#FFF1EF] text-[#E45F58] ring-[#F7D4D0]",
  };
  return (
    <div className={cn("rounded-[17px] py-3 text-center ring-1", colors[color])}>
      <p className="text-[17px] font-extrabold leading-none">{value}</p>
      <p className="mt-1.5 text-[9px] font-bold opacity-70">{label}</p>
    </div>
  );
}

function NumberStepper({
  icon,
  label,
  suffix,
  value,
  placeholder,
  onChange,
  onDecrease,
  onIncrease,
}: {
  icon: React.ReactNode;
  label: string;
  suffix?: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div className="rounded-[19px] bg-[#F8FAFC] p-3 ring-1 ring-[#E1E7EF]">
      <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#71809C]">
        <span className="text-[#7C83F6]">{icon}</span>{label}
      </div>
      <div className="mt-3 grid grid-cols-[36px_minmax(0,1fr)_36px] items-center gap-1.5">
        <button type="button" onClick={onDecrease} aria-label={`Decrease ${label}`} className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-white text-[#596982] ring-1 ring-[#DDE5EF]"><Minus className="h-4 w-4" /></button>
        <label className="relative min-w-0">
          <input type="number" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={label} className="h-9 w-full rounded-[12px] bg-white px-2 text-center text-[14px] font-extrabold text-[#07152F] outline-none ring-1 ring-[#DDE5EF] focus:ring-[#7C83F6]" />
          {suffix && <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] font-bold text-[#A0ABBC]">{suffix}</span>}
        </label>
        <button type="button" onClick={onIncrease} aria-label={`Increase ${label}`} className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-white text-[#596982] ring-1 ring-[#DDE5EF]"><Plus className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

function RestOverlay({
  seconds,
  duration,
  nextExercise,
  nextSet,
  onSkip,
}: {
  seconds: number;
  duration: number;
  nextExercise: string;
  nextSet: number;
  onSkip: () => void;
}) {
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const progress = duration > 0 ? seconds / duration : 0;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/30 backdrop-blur-sm sm:items-center sm:p-4">
      <motion.section initial={{ y: 32, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 32, opacity: 0 }} className="w-full max-w-[430px] rounded-t-[32px] bg-white px-6 pb-[calc(24px+env(safe-area-inset-bottom,0px))] pt-6 text-center shadow-2xl sm:rounded-[32px]">
        <div className="mx-auto flex h-10 w-max items-center gap-2 rounded-full bg-[#FFF8EC] px-4 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#C77B1C] ring-1 ring-[#F8E1B9]">
          <Pause className="h-4 w-4" /> Recovery
        </div>
        <div className="relative mx-auto mt-5 h-36 w-36">
          <svg viewBox="0 0 144 144" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="72" cy="72" r={radius} fill="none" stroke="#E8EEF3" strokeWidth="10" />
            <circle cx="72" cy="72" r={radius} fill="none" stroke="#22C7A1" strokeWidth="10" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} className="transition-all duration-500" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[36px] font-extrabold tabular-nums text-[#07152F]">{formatTime(seconds)}</span>
            <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[#8A98AF]">Rest time</span>
          </div>
        </div>
        <p className="mt-5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#7C83F6]">Up next</p>
        <h2 className="mt-1 line-clamp-2 text-[18px] font-extrabold text-[#07152F]">{nextExercise}</h2>
        <p className="mt-1 text-[11px] font-semibold text-[#71809C]">Set {nextSet}</p>
        <button onClick={onSkip} className="mt-6 min-h-12 w-full rounded-[16px] bg-[#F4F7FA] text-[13px] font-extrabold text-[#41506A] ring-1 ring-[#DDE5EF]">Skip rest</button>
      </motion.section>
    </motion.div>
  );
}

function ExerciseDetailsSheet({ open, onOpenChange, exerciseId }: { open: boolean; onOpenChange: (open: boolean) => void; exerciseId: string | null }) {
  return (
    <ExerciseCatalogSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Movement instructions"
      allowedExerciseIds={exerciseId ? [exerciseId] : []}
      initialExerciseId={exerciseId}
    />
  );
}

function WorkoutLoading() {
  return (
    <WorkoutShell>
      <div className="mx-auto max-w-[430px] animate-pulse px-4 py-4">
        <div className="h-12 rounded-[18px] bg-white ring-1 ring-[#E5EAF1]" />
        <div className="mt-4 h-52 rounded-[28px] bg-white ring-1 ring-[#E5EAF1]" />
        <div className="mt-4 h-32 rounded-[28px] bg-white ring-1 ring-[#E5EAF1]" />
        <div className="mt-3 h-32 rounded-[28px] bg-white ring-1 ring-[#E5EAF1]" />
      </div>
    </WorkoutShell>
  );
}
