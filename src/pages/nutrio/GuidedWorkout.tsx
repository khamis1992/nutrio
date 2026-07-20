import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  ArrowLeft,
  Calculator,
  Check,
  ChevronRight,
  Clock3,
  Dumbbell,
  Info,
  ListChecks,
  Lock,
  Minus,
  Pause,
  Play,
  Plus,
  Scale,
  Repeat2,
  SkipForward,
  Sparkles,
  Star,
  Target,
  Timer,
  Trophy,
  X,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { ExerciseCatalogSheet } from "@/components/exercises/ExerciseCatalogSheet";
import { ExerciseMedia } from "@/components/exercises/ExerciseMedia";
import { PlateCalculatorSheet } from "@/components/workout/PlateCalculatorSheet";
import {
  buildReplacementEventInput,
  buildWorkoutSetLogInput,
  plateWeightInput,
} from "@/components/workout/training-enhancement-contract";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCoachPrograms, type ProgramExercise } from "@/hooks/useCoachPrograms";
import { useExerciseCatalog } from "@/hooks/useExerciseCatalog";
import { useWorkoutDayLocks } from "@/hooks/useWorkoutDayLocks";
import { useWorkoutEquipmentProfiles } from "@/hooks/useWorkoutEquipmentProfiles";
import { useWorkoutSession } from "@/hooks/useWorkoutSession";
import { supabase } from "@/integrations/supabase/client";
import { formatExerciseLabel, type ExerciseCatalogItem } from "@/lib/exercise-catalog";
import { isPhaseOneFeatureEnabled } from "@/lib/phase-one-feature-flags";
import { cn } from "@/lib/utils";
import {
  fetchProgressionRecommendations,
  progressionRuleSummary,
  type ProgressionRecommendation,
} from "@/lib/workout-progression";
import { rpeToRir } from "@/lib/workout-set-prescription";
import { buildWorkoutSequence } from "@/lib/workout-sequence";
import { getSafeExerciseSubstitutions } from "@/lib/strength-training";

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function formatDate(value?: string): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface PreviousSetReference {
  reps: number | null;
  weight_kg: number | null;
  completed_at: string | null;
}

type PreviousSetMap = Record<string, PreviousSetReference>;

const previousSetKey = (exerciseId: string, setNumber: number) => `${exerciseId}:${setNumber}`;

const normalizeExerciseName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

export default function GuidedWorkout() {
  const { programId, dayNumber: dayParam } = useParams<{
    programId: string;
    dayNumber: string;
  }>();
  const dayNumber = Number(dayParam) || 1;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const trainingEnhancementsEnabled = isPhaseOneFeatureEnabled("trainingEnhancements");
  const addedCopy = isRTL ? {
    quickCheckIn: "تقييم سريع",
    howWasWorkout: "كيف كان هذا التمرين؟",
    perceivedEffort: "المجهود المحسوس",
    optionalCoachNote: "ملاحظة اختيارية لمدربك",
    feedbackSaved: "تم حفظ التقييم",
    shareWithCoach: "مشاركة مع المدرب",
    safeAlternative: "بديل آمن",
    skip: "تخطي",
    plateCalculator: "حاسبة الأوزان",
    effortQuestion: "ما مدى صعوبة هذه المجموعة؟",
    skipped: "تم التخطي",
    skipExerciseTitle: "تخطي هذا التمرين؟",
    skipExerciseBody: "سيرى مدربك هذا التغيير. سيبقى باقي التمرين بالترتيب نفسه.",
    optionalReason: "السبب (اختياري)",
    keepExercise: "الاحتفاظ بالتمرين",
    skipExercise: "تخطي التمرين",
    chooseAlternative: "اختر بديلاً لهذه الجلسة",
  } : {
    quickCheckIn: "Quick check-in",
    howWasWorkout: "How was this workout?",
    perceivedEffort: "Perceived effort",
    optionalCoachNote: "Optional note for your coach",
    feedbackSaved: "Feedback saved",
    shareWithCoach: "Share with coach",
    safeAlternative: "Safe alternative",
    skip: "Skip",
    plateCalculator: "Plate calculator",
    effortQuestion: "How hard did this set feel?",
    skipped: "Skipped",
    skipExerciseTitle: "Skip this exercise?",
    skipExerciseBody: "Your coach will see this change. The rest of the workout stays in sequence.",
    optionalReason: "Reason (optional)",
    keepExercise: "Keep exercise",
    skipExercise: "Skip exercise",
    chooseAlternative: "Choose a session alternative",
  };
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
  const {
    isDayUnlocked,
    getPreviousLockedDay,
    loading: dayLocksLoading,
  } = useWorkoutDayLocks(clientId, programExercises);
  const { exercises: catalog, loading: catalogLoading } = useExerciseCatalog();
  const { profiles: equipmentProfiles, defaultProfile: equipmentProfile, saveProfile: saveEquipmentProfile } = useWorkoutEquipmentProfiles(trainingEnhancementsEnabled);
  const {
    session,
    setLogs,
    exerciseEvents,
    elapsedSeconds,
    loading: sessionLoading,
    savingSet,
    startSession,
    logSet,
    updateSetRest,
    recordExerciseEvent,
    updateSessionFeedback,
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
  const workoutSequence = useMemo(
    () => trainingEnhancementsEnabled ? buildWorkoutSequence(exercises) : [],
    [exercises, trainingEnhancementsEnabled],
  );

  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSetNumber, setCurrentSetNumber] = useState(1);
  const [weightInput, setWeightInput] = useState("");
  const [repsInput, setRepsInput] = useState("");
  const [rpeInput, setRpeInput] = useState("8");
  const [progressionRecommendations, setProgressionRecommendations] = useState<Map<string, ProgressionRecommendation>>(new Map());
  const [restTimer, setRestTimer] = useState(0);
  const [restDuration, setRestDuration] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [restPaused, setRestPaused] = useState(false);
  const restStartedAtRef = useRef<number | null>(null);
  const restSetLogIdRef = useRef<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [replacementOpen, setReplacementOpen] = useState(false);
  const [plateCalculatorOpen, setPlateCalculatorOpen] = useState(false);
  const [skipSheetOpen, setSkipSheetOpen] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [exerciseOverrides, setExerciseOverrides] = useState<Record<string, ExerciseCatalogItem>>({});
  const [sessionRating, setSessionRating] = useState(5);
  const [sessionEffort, setSessionEffort] = useState(7);
  const [sessionFeedback, setSessionFeedback] = useState("");
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [detailsExerciseId, setDetailsExerciseId] = useState<string | null>(null);
  const [previousSets, setPreviousSets] = useState<PreviousSetMap>({});
  const [previousSetsLoading, setPreviousSetsLoading] = useState(false);

  const currentExercise: ProgramExercise | undefined = exercises[currentExerciseIndex];
  const currentOverride = trainingEnhancementsEnabled && currentExercise ? exerciseOverrides[currentExercise.id] : undefined;
  const currentSequenceStep = trainingEnhancementsEnabled ? workoutSequence.find(
    (step) => step.exercise.id === currentExercise?.id && step.setNumber === currentSetNumber,
  ) : undefined;
  const currentCatalogExercise = currentOverride ?? (currentExercise?.exercise_catalog_id
    ? catalogById.get(currentExercise.exercise_catalog_id)
    : undefined);
  const currentExerciseName = currentOverride ? formatExerciseLabel(currentOverride.name) : currentExercise?.exercise_name;
  const safeSubstitutions = useMemo(
    () => trainingEnhancementsEnabled
      ? getSafeExerciseSubstitutions(currentCatalogExercise, catalog, equipmentProfile.equipment)
      : [],
    [catalog, currentCatalogExercise, equipmentProfile.equipment, trainingEnhancementsEnabled],
  );
  const safeSubstitutionIds = useMemo(
    () => safeSubstitutions.map((item) => item.exercise.id),
    [safeSubstitutions],
  );
  const skippedExerciseIds = useMemo(
    () => new Set(trainingEnhancementsEnabled
      ? exerciseEvents.filter((event) => event.event_type === "skipped" && event.program_exercise_id).map((event) => event.program_exercise_id as string)
      : []),
    [exerciseEvents, trainingEnhancementsEnabled],
  );
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
  const currentPreviousSet = currentExercise
    ? previousSets[previousSetKey(currentExercise.id, currentSetNumber)]
    : undefined;
  const currentProgression = currentExercise
    ? progressionRecommendations.get(currentExercise.id)
    : undefined;

  const finalizeRest = useCallback(async () => {
    const startedAt = restStartedAtRef.current;
    const setLogId = restSetLogIdRef.current;
    restStartedAtRef.current = null;
    restSetLogIdRef.current = null;
    setIsResting(false);
    setRestPaused(false);
    setRestTimer(0);

    if (trainingEnhancementsEnabled && startedAt && setLogId) {
      const actualSeconds = Math.floor((Date.now() - startedAt) / 1000);
      const result = await updateSetRest(setLogId, actualSeconds);
      if (!result.success) console.error("Unable to save actual rest time", result.error);
    }
  }, [trainingEnhancementsEnabled, updateSetRest]);

  const loadProgressionRecommendations = useCallback(async (sessionId?: string) => {
    if (!clientId || exercises.length === 0) return;
    try {
      const recommendations = await fetchProgressionRecommendations({
        userId: clientId,
        exerciseIds: exercises.map((exercise) => exercise.id),
        sessionId,
      });
      setProgressionRecommendations(recommendations);
    } catch (error) {
      console.error("Unable to load workout progression:", error);
    }
  }, [clientId, exercises]);

  useEffect(() => {
    void loadProgressionRecommendations();
  }, [loadProgressionRecommendations]);

  useEffect(() => {
    if (!currentExercise) return;
    const prescribedReps = currentProgression?.recommended_reps ?? Number.parseInt(currentExercise.reps, 10);
    setRepsInput(currentProgression?.recommended_reps
      ? String(currentProgression.recommended_reps)
      : currentPreviousSet?.reps
        ? String(currentPreviousSet.reps)
        : Number.isNaN(prescribedReps) ? "" : String(prescribedReps));
    setWeightInput(currentProgression?.recommended_weight_kg != null
      ? String(currentProgression.recommended_weight_kg)
      : currentPreviousSet?.weight_kg ? String(currentPreviousSet.weight_kg) : "");
    setRpeInput("8");
  }, [currentExercise, currentPreviousSet, currentProgression, currentSetNumber]);

  useEffect(() => {
    if (!clientId || exercises.length === 0) {
      setPreviousSets({});
      return;
    }

    let active = true;
    setPreviousSetsLoading(true);

    void (async () => {
      try {
        const { data: sessions, error: sessionsError } = await supabase
          .from("coach_workout_sessions")
          .select("id, completed_at, started_at")
          .eq("user_id", clientId)
          .not("completed_at", "is", null)
          .order("started_at", { ascending: false })
          .limit(20);

        if (sessionsError) throw sessionsError;
        const sessionRows = sessions || [];
        const sessionIds = sessionRows.map((item) => item.id);
        if (sessionIds.length === 0) {
          if (active) setPreviousSets({});
          return;
        }

        const { data: logs, error: logsError } = await supabase
          .from("coach_workout_set_logs")
          .select("session_id, program_exercise_id, exercise_name, set_number, reps, weight_kg, completed")
          .in("session_id", sessionIds)
          .eq("completed", true)
          .order("created_at", { ascending: false })
          .limit(600);

        if (logsError) throw logsError;
        if (!active) return;

        const sessionRank = new Map(sessionRows.map((item, index) => [item.id, index]));
        const sessionCompletedAt = new Map(sessionRows.map((item) => [item.id, item.completed_at]));
        const exerciseIds = new Set(exercises.map((exercise) => exercise.id));
        const exerciseByName = new Map(exercises.map((exercise) => [normalizeExerciseName(exercise.exercise_name), exercise.id]));
        const nextPreviousSets: PreviousSetMap = {};

        (logs || [])
          .slice()
          .sort((a, b) => (sessionRank.get(a.session_id) ?? 999) - (sessionRank.get(b.session_id) ?? 999))
          .forEach((log) => {
            const exerciseId = log.program_exercise_id && exerciseIds.has(log.program_exercise_id)
              ? log.program_exercise_id
              : exerciseByName.get(normalizeExerciseName(log.exercise_name));
            if (!exerciseId || !log.set_number) return;

            const key = previousSetKey(exerciseId, log.set_number);
            if (nextPreviousSets[key]) return;
            nextPreviousSets[key] = {
              reps: log.reps,
              weight_kg: log.weight_kg,
              completed_at: sessionCompletedAt.get(log.session_id) || null,
            };
          });

        setPreviousSets(nextPreviousSets);
      } catch (error) {
        console.error("Error loading previous workout set numbers:", error);
        if (active) setPreviousSets({});
      } finally {
        if (active) setPreviousSetsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [clientId, exercises]);

  useEffect(() => {
    if (!isResting) return;
    if (restTimer <= 0) {
      void finalizeRest();
      return;
    }
    if (restPaused) return;

    const timer = window.setInterval(() => {
      setRestTimer((current) => {
        if (current <= 1) {
          if (!trainingEnhancementsEnabled) {
            setIsResting(false);
            setRestPaused(false);
          }
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [finalizeRest, isResting, restPaused, restTimer, trainingEnhancementsEnabled]);

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
    if (!isDayUnlocked(programId, dayNumber)) {
      const previousLockedDay = getPreviousLockedDay(programId, dayNumber);
      toast.error(previousLockedDay ? `Complete and log Day ${previousLockedDay} to unlock Day ${dayNumber}.` : "This workout day is locked.");
      return;
    }
    const result = await startSession(clientId, programId, dayNumber);
    if (!result.success) toast.error(result.error?.message || "Unable to start this workout.");
  }, [clientId, dayNumber, getPreviousLockedDay, isDayUnlocked, programId, startSession]);

  const beginRest = useCallback((seconds: number, setLogId?: string) => {
    if (seconds <= 0) return;
    if (trainingEnhancementsEnabled && setLogId) {
      restStartedAtRef.current = Date.now();
      restSetLogIdRef.current = setLogId;
    }
    setRestDuration(seconds);
    setRestTimer(seconds);
    setRestPaused(false);
    setIsResting(true);
  }, [trainingEnhancementsEnabled]);

  const skipRest = useCallback(() => {
    if (trainingEnhancementsEnabled) {
      void finalizeRest();
      return;
    }
    setIsResting(false);
    setRestPaused(false);
    setRestTimer(0);
  }, [finalizeRest, trainingEnhancementsEnabled]);

  const reduceRestTime = useCallback(() => {
    setRestTimer((current) => Math.max(0, current - 15));
  }, []);

  const addRestTime = useCallback(() => {
    setRestTimer((current) => current + 15);
    setRestDuration((current) => current + 15);
  }, []);

  const applyPreviousSet = useCallback(() => {
    if (!currentPreviousSet) return;
    if (currentPreviousSet.weight_kg) setWeightInput(String(currentPreviousSet.weight_kg));
    if (currentPreviousSet.reps) setRepsInput(String(currentPreviousSet.reps));
  }, [currentPreviousSet]);

  const handleCompleteSet = useCallback(async () => {
    if (!currentExercise) return;
    const result = await logSet(buildWorkoutSetLogInput({
      enhancementsEnabled: trainingEnhancementsEnabled,
      exercise: currentExercise,
      exerciseName: currentExerciseName,
      setNumber: currentSetNumber,
      repsInput,
      weightInput,
      rpeInput,
      progression: currentProgression,
      sequenceRestSeconds: currentSequenceStep?.restAfterSeconds,
    }));

    if (!result.success) {
      toast.error(result.error?.message || "Unable to save this set.");
      return;
    }

    const restSeconds = currentExercise.rest_seconds ?? 0;
    if (!trainingEnhancementsEnabled) {
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
      return;
    }

    const currentStepIndex = workoutSequence.findIndex(
      (step) => step.exercise.id === currentExercise.id && step.setNumber === currentSetNumber,
    );
    const nextStep = currentStepIndex >= 0
      ? workoutSequence.slice(currentStepIndex + 1).find((step) => !skippedExerciseIds.has(step.exercise.id))
      : undefined;
    const enhancedRestSeconds = currentSequenceStep?.restAfterSeconds ?? restSeconds;
    const savedSetId = result.data?.id;
    if (nextStep) {
      const nextExerciseIndex = exercises.findIndex((exercise) => exercise.id === nextStep.exercise.id);
      setCurrentExerciseIndex(Math.max(0, nextExerciseIndex));
      setCurrentSetNumber(nextStep.setNumber);
      setWeightInput("");
      if (savedSetId) beginRest(enhancedRestSeconds, savedSetId);
    }
  }, [beginRest, currentExercise, currentExerciseIndex, currentExerciseName, currentProgression, currentSequenceStep, currentSetNumber, exercises, logSet, repsInput, rpeInput, skippedExerciseIds, totalSets, trainingEnhancementsEnabled, weightInput, workoutSequence]);

  const handleSkipExercise = useCallback(async () => {
    if (!currentExercise) return;
    const result = await recordExerciseEvent({
      program_exercise_id: currentExercise.id,
      event_type: "skipped",
      original_exercise_name: currentExercise.exercise_name,
      reason: skipReason,
    });
    if (!result.success) {
      toast.error(result.error?.message || "Unable to skip this exercise.");
      return;
    }
    const currentStepIndex = workoutSequence.findIndex(
      (step) => step.exercise.id === currentExercise.id && step.setNumber === currentSetNumber,
    );
    const nextSkipped = new Set(skippedExerciseIds).add(currentExercise.id);
    const nextStep = workoutSequence.slice(Math.max(0, currentStepIndex + 1))
      .find((step) => !nextSkipped.has(step.exercise.id));
    if (nextStep) {
      setCurrentExerciseIndex(exercises.findIndex((exercise) => exercise.id === nextStep.exercise.id));
      setCurrentSetNumber(nextStep.setNumber);
      setWeightInput("");
    }
    setSkipSheetOpen(false);
    setSkipReason("");
    toast.success("Exercise skipped. Your coach will see the reason.");
  }, [currentExercise, currentSetNumber, exercises, recordExerciseEvent, skipReason, skippedExerciseIds, workoutSequence]);

  const handleReplacement = useCallback(async (replacement: ExerciseCatalogItem) => {
    if (!currentExercise) return;
    const replacementName = formatExerciseLabel(replacement.name);
    const result = await recordExerciseEvent(buildReplacementEventInput(currentExercise, replacement, replacementName));
    if (!result.success) {
      toast.error(result.error?.message || "Unable to replace this exercise.");
      return;
    }
    setExerciseOverrides((current) => ({ ...current, [currentExercise.id]: replacement }));
    setReplacementOpen(false);
    toast.success(`${replacementName} is active for this session.`);
  }, [currentExercise, recordExerciseEvent]);

  const handleFinish = useCallback(async () => {
    if (!clientId) return;
    const completedExerciseIds = trainingEnhancementsEnabled
      ? exercises
        .filter((exercise) => setLogs.some((set) => set.program_exercise_id === exercise.id && set.completed))
        .map((exercise) => exercise.id)
      : exercises.map((exercise) => exercise.id);
    const result = await completeSession(clientId, completedExerciseIds);
    if (result.success) {
      await loadProgressionRecommendations(result.data?.id);
      setShowSummary(true);
    } else {
      toast.error(result.error?.message || "Unable to finish this workout.");
    }
  }, [clientId, completeSession, exercises, loadProgressionRecommendations, setLogs, trainingEnhancementsEnabled]);

  const handleSaveFeedback = useCallback(async () => {
    const result = await updateSessionFeedback({
      rating: sessionRating,
      perceived_effort: sessionEffort,
      feedback: sessionFeedback,
    });
    if (!result.success) {
      toast.error(result.error?.message || "Unable to save your workout feedback.");
      return;
    }
    setFeedbackSaved(true);
    toast.success("Feedback shared with your coach.");
  }, [sessionEffort, sessionFeedback, sessionRating, updateSessionFeedback]);

  const selectExercise = (index: number) => {
    if (isResting) return;
    const exercise = exercises[index];
    if (!trainingEnhancementsEnabled) {
      const loggedSets = setLogs.filter(
        (set) => set.program_exercise_id === exercise.id && set.completed,
      ).length;
      setCurrentExerciseIndex(index);
      setCurrentSetNumber(Math.min(loggedSets + 1, exercise.sets));
      setWeightInput("");
      return;
    }
    const loggedSetNumbers = new Set(setLogs
      .filter((set) => set.program_exercise_id === exercise.id && set.completed)
      .map((set) => set.set_number));
    const nextStep = workoutSequence.find(
      (step) => step.exercise.id === exercise.id && !loggedSetNumbers.has(step.setNumber),
    );
    setCurrentExerciseIndex(index);
    setCurrentSetNumber(nextStep?.setNumber ?? exercise.sets);
    setWeightInput("");
  };

  const allExercisesCompleted = exercises.length > 0 && exercises.every((exercise) => {
    if (skippedExerciseIds.has(exercise.id)) return true;
    const exerciseSets = setLogs.filter(
      (set) => set.program_exercise_id === exercise.id && set.completed,
    );
    return exerciseSets.length >= exercise.sets;
  });

  const loading = assignmentLoading || programsLoading || catalogLoading || dayLocksLoading;

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

  if (!isDayUnlocked(program.id, dayNumber)) {
    const previousLockedDay = getPreviousLockedDay(program.id, dayNumber);
    return (
      <WorkoutShell>
        <WorkoutHeader title="Workout locked" onBack={() => navigate(-1)} />
        <div className="mx-auto w-full max-w-[430px] px-4 py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#F6F8FB] text-[#020617] ring-1 ring-[#E5EAF1]">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-[20px] font-extrabold text-[#07152F]">Day {dayNumber} is locked</h1>
          <p className="mx-auto mt-2 max-w-[300px] text-[13px] font-semibold leading-6 text-[#71809C]">
            {previousLockedDay
              ? `Complete and log Day ${previousLockedDay} before starting this session.`
              : "Complete the previous workout logs before starting this session."}
          </p>
          <button onClick={() => navigate("/coach-programs")} className="mt-6 min-h-12 rounded-[16px] bg-[#020617] px-6 text-[13px] font-extrabold text-white">
            Back to workout plan
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

          {trainingEnhancementsEnabled && <section dir={isRTL ? "rtl" : "ltr"} className="rounded-[28px] bg-white p-4 shadow-[0_16px_38px_rgba(15,23,42,0.06)] ring-1 ring-[#DDE5EF]">
            <div className="flex items-center gap-2 px-1">
              <Star className="h-4 w-4 text-[#FB6B7A]" />
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#E94E65]">{addedCopy.quickCheckIn}</p>
                <h2 className="mt-0.5 text-[16px] font-extrabold text-[#07152F]">{addedCopy.howWasWorkout}</h2>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button key={rating} type="button" onClick={() => { setSessionRating(rating); setFeedbackSaved(false); }} className={cn("flex h-11 items-center justify-center rounded-[14px] ring-1", rating <= sessionRating ? "bg-[#FFF0F2] text-[#FB6B7A] ring-[#FFD4DA]" : "bg-[#F6F8FB] text-[#C1CAD7] ring-[#E5EAF1]")} aria-label={`${rating} star rating`}>
                  <Star className={cn("h-4 w-4", rating <= sessionRating && "fill-current")} />
                </button>
              ))}
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-[10px] font-bold text-[#71809C]"><span>{addedCopy.perceivedEffort}</span><span>{sessionEffort}/10</span></div>
              <input type="range" min={1} max={10} value={sessionEffort} onChange={(event) => { setSessionEffort(Number(event.target.value)); setFeedbackSaved(false); }} className="mt-2 w-full accent-[#7C83F6]" aria-label="Perceived workout effort" />
            </div>
            <textarea value={sessionFeedback} onChange={(event) => { setSessionFeedback(event.target.value); setFeedbackSaved(false); }} rows={3} placeholder={addedCopy.optionalCoachNote} className="mt-3 w-full resize-none rounded-[16px] bg-[#F6F8FB] px-3 py-2.5 text-[11px] font-semibold leading-5 text-[#07152F] outline-none ring-1 ring-[#E5EAF1] placeholder:text-[#94A3B8] focus:ring-[#7C83F6]" />
            <button type="button" onClick={handleSaveFeedback} disabled={feedbackSaved} className="mt-3 min-h-11 w-full rounded-[15px] bg-[#020617] text-[11px] font-extrabold text-white disabled:bg-[#E9EEF4] disabled:text-[#71809C]">
              {feedbackSaved ? addedCopy.feedbackSaved : addedCopy.shareWithCoach}
            </button>
          </section>}

          {progressionRecommendations.size > 0 && (
            <section className="rounded-[28px] bg-[#F3F1FF] p-4 shadow-[0_16px_38px_rgba(70,60,160,0.08)] ring-1 ring-[#DCD8FF]">
              <div className="flex items-center gap-2 px-1 pb-3">
                <ArrowUpRight className="h-4 w-4 text-[#7C83F6]" />
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#656BD8]">Rule evaluated</p>
                  <h2 className="mt-0.5 text-[16px] font-extrabold text-[#07152F]">Targets for next time</h2>
                </div>
              </div>
              <div className="space-y-2">
                {exercises.map((exercise) => {
                  const recommendation = progressionRecommendations.get(exercise.id);
                  if (!recommendation) return null;
                  return (
                    <div key={exercise.id} className="rounded-[18px] bg-white p-3 ring-1 ring-[#E3E0FF]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-extrabold text-[#07152F]">{exercise.exercise_name}</p>
                          <p className="mt-1 text-[9px] font-medium leading-4 text-[#71809C]">{recommendation.reason}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-[#ECE9FF] px-2.5 py-1 text-[9px] font-extrabold text-[#656BD8]">
                          {recommendation.outcome === "increase_load" && "Load up"}
                          {recommendation.outcome === "increase_reps" && "Reps up"}
                          {recommendation.outcome === "increase_sets" && "Sets up"}
                          {recommendation.outcome === "adjust_rest" && "Rest down"}
                          {recommendation.outcome === "repeat" && "Repeat"}
                          {recommendation.outcome === "deload" && "Deload"}
                        </span>
                      </div>
                      <p className="mt-2 text-[13px] font-black text-[#31365F]">
                        {recommendation.recommended_weight_kg != null ? `${recommendation.recommended_weight_kg} kg` : "Current load"}
                        {recommendation.recommended_reps ? ` x ${recommendation.recommended_reps} reps` : ""}
                        {recommendation.recommended_sets ? ` · ${recommendation.recommended_sets} sets` : ""}
                        {recommendation.recommended_rest_seconds != null ? ` · ${recommendation.recommended_rest_seconds}s rest` : ""}
                        {recommendation.recommended_rir != null ? ` · ${recommendation.recommended_rir} RIR` : ""}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

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
              const skipped = skippedExerciseIds.has(exercise.id);
              const active = index === currentExerciseIndex;
              return (
                <button
                  key={exercise.id}
                  type="button"
                  onClick={() => selectExercise(index)}
                  className={cn(
                    "flex h-11 min-w-11 items-center justify-center rounded-[14px] text-[12px] font-extrabold transition",
                    done && "bg-[#22C7A1] text-white",
                    skipped && !done && "bg-[#FFF0F2] text-[#E94E65] ring-1 ring-[#FFD4DA]",
                    active && !done && "bg-[#E9FBF7] text-[#087B67] ring-1 ring-[#A9E8D9]",
                    !active && !done && !skipped && "bg-[#F4F7FA] text-[#8A98AF] ring-1 ring-[#E1E7EF]",
                  )}
                  aria-label={`Go to ${exercise.exercise_name}`}
                >
                  {done ? <Check className="h-4 w-4" /> : skipped ? <SkipForward className="h-4 w-4" /> : index + 1}
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
                  preferVideo
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
                  <h1 className="mt-1 text-[22px] font-extrabold leading-tight text-[#07152F]">{currentExerciseName}</h1>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {currentSequenceStep?.supersetGroup && (
                      <span className="rounded-full bg-[#F3F1FF] px-2.5 py-1 text-[9px] font-extrabold text-[#656BD8] ring-1 ring-[#DCD8FF]">
                        Superset {currentSequenceStep.supersetGroup} · {currentSequenceStep.roundExerciseNumber}/{currentSequenceStep.roundExerciseCount}
                      </span>
                    )}
                    {trainingEnhancementsEnabled && currentExercise.set_type && currentExercise.set_type !== "normal" && (
                      <span className="rounded-full bg-[#FFF0F2] px-2.5 py-1 text-[9px] font-extrabold capitalize text-[#E94E65] ring-1 ring-[#FFD4DA]">
                        {currentExercise.set_type}
                      </span>
                    )}
                  </div>
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
                <Prescription value={currentExercise.reps} label={currentExercise.prescription_unit ?? "Reps"} color="blue" />
                <Prescription value={`${currentSequenceStep?.restAfterSeconds ?? currentExercise.rest_seconds ?? 0}s`} label="Rest after" color="coral" />
              </div>

              {(currentProgression || progressionRuleSummary(currentExercise.progression_rule) !== "Manual progression") && (
                <div className="mt-4 flex gap-3 rounded-[18px] bg-[#F3F1FF] p-3.5 ring-1 ring-[#DCD8FF]">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-white text-[#7C83F6] ring-1 ring-[#DCD8FF]">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#656BD8]">
                      {currentProgression ? "Next progression target" : "Progression rule"}
                    </p>
                    <p className="mt-1 text-[11px] font-bold leading-5 text-[#31365F]">
                      {currentProgression
                        ? `${currentProgression.recommended_weight_kg != null ? `${currentProgression.recommended_weight_kg} kg` : "Current load"}${currentProgression.recommended_reps ? ` x ${currentProgression.recommended_reps} reps` : ""}${currentProgression.recommended_sets ? ` · ${currentProgression.recommended_sets} sets` : ""}${currentProgression.recommended_rest_seconds != null ? ` · ${currentProgression.recommended_rest_seconds}s rest` : ""}`
                        : progressionRuleSummary(currentExercise.progression_rule)}
                    </p>
                    {currentProgression && <p className="mt-0.5 text-[9px] font-medium leading-4 text-[#737A9B]">{currentProgression.reason}</p>}
                  </div>
                </div>
              )}

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

              {trainingEnhancementsEnabled && !skippedExerciseIds.has(currentExercise.id) && (
                <div dir={isRTL ? "rtl" : "ltr"} className={cn("mt-3 grid gap-2", safeSubstitutionIds.length > 0 ? "grid-cols-2" : "grid-cols-1")}>
                  {safeSubstitutionIds.length > 0 && (
                    <button type="button" onClick={() => setReplacementOpen(true)} className="flex min-h-11 items-center justify-center gap-2 rounded-[15px] bg-[#F3F1FF] text-[11px] font-extrabold text-[#656BD8] ring-1 ring-[#DCD8FF]">
                      <Repeat2 className="h-4 w-4" /> {addedCopy.safeAlternative}
                    </button>
                  )}
                  <button type="button" onClick={() => setSkipSheetOpen(true)} className="flex min-h-11 items-center justify-center gap-2 rounded-[15px] bg-[#FFF0F2] text-[11px] font-extrabold text-[#E94E65] ring-1 ring-[#FFD4DA]">
                    <SkipForward className="h-4 w-4" /> {addedCopy.skip}
                  </button>
                </div>
              )}

              {!allExercisesCompleted && (
                <>
                  <PreviousSetHint
                    loading={previousSetsLoading}
                    previousSet={currentPreviousSet}
                    onApply={applyPreviousSet}
                  />
                  <div className="mt-3 grid grid-cols-2 gap-3">
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
                  {trainingEnhancementsEnabled && <button
                    type="button"
                    onClick={() => setPlateCalculatorOpen(true)}
                    className="mt-2 flex min-h-11 w-full items-center justify-between rounded-[15px] bg-[#EEF6FF] px-3 text-start text-[#1687D9] ring-1 ring-[#D9ECFF] active:scale-[0.99]"
                  >
                    <span className="flex items-center gap-2 text-[11px] font-extrabold"><Calculator className="h-4 w-4" /> {addedCopy.plateCalculator}</span>
                    <span className="text-[9px] font-bold text-[#64748B]">{equipmentProfile.name} · {equipmentProfile.bar_weight_kg}kg bar</span>
                  </button>}
                  <div className="mt-3 rounded-[18px] bg-[#F8FAFC] p-3 ring-1 ring-[#E5EAF1]">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-extrabold text-[#07152F]">Effort (RPE)</p>
                        <p className="mt-0.5 text-[9px] font-medium text-[#71809C]">{trainingEnhancementsEnabled ? addedCopy.effortQuestion : "How hard did this set feel?"}</p>
                      </div>
                      <div className="text-right">
                        <span className="block text-[16px] font-black text-[#7C83F6]">{rpeInput}/10</span>
                        {trainingEnhancementsEnabled && <span className="block text-[9px] font-bold text-[#94A3B8]">RIR {rpeToRir(Number.parseFloat(rpeInput)) ?? "--"}</span>}
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-5 gap-1.5">
                      {[6, 7, 8, 9, 10].map((rpe) => (
                        <button
                          key={rpe}
                          type="button"
                          onClick={() => setRpeInput(String(rpe))}
                          className={cn("h-9 rounded-xl text-[11px] font-extrabold transition", rpeInput === String(rpe) ? "bg-[#7C83F6] text-white" : "bg-white text-[#71809C] ring-1 ring-[#DDE5EF]")}
                        >
                          {rpe}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.section>
        )}

        {isResting && (
          <RestTimerCard
            seconds={restTimer}
            duration={restDuration}
            paused={restPaused}
            nextExercise={currentExerciseName || "Next exercise"}
            nextSet={Math.min(currentSetNumber, totalSets)}
            onReduce={reduceRestTime}
            onAdd={addRestTime}
            onTogglePause={() => setRestPaused((current) => !current)}
            onSkip={skipRest}
          />
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
              const skipped = skippedExerciseIds.has(exercise.id);
              const override = exerciseOverrides[exercise.id];
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
                  <ExerciseThumb exercise={override ?? (exercise.exercise_catalog_id ? catalogById.get(exercise.exercise_catalog_id) : undefined)} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-[12px] font-extrabold", (done || skipped) ? "text-[#8A98AF] line-through" : "text-[#07152F]")}>{override ? formatExerciseLabel(override.name) : exercise.exercise_name}</span>
                    <span className="mt-1 block text-[10px] font-semibold text-[#71809C]">{skipped ? addedCopy.skipped : `${exerciseSetCount}/${exercise.sets} sets · ${exercise.reps} reps`}</span>
                  </span>
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", done ? "bg-[#22C7A1] text-white" : skipped ? "bg-[#FFF0F2] text-[#E94E65]" : "bg-white text-[#B0BAC9] ring-1 ring-[#DDE5EF]") }>
                    {done ? <Check className="h-4 w-4" /> : skipped ? <SkipForward className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
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
            disabled={sessionLoading || savingSet || isResting || isSetLogged(currentSetNumber)}
            className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#7C83F6] text-[14px] font-extrabold text-white shadow-[0_12px_26px_rgba(124,131,246,0.25)] transition active:scale-[0.98] disabled:opacity-45"
          >
            <Check className="h-5 w-5" />
            {savingSet ? "Saving set..." : `Complete set ${Math.min(currentSetNumber, totalSets)}`}
          </button>
        )}
      </div>

      <AnimatePresence>
        {isResting && (
          <RestOverlay
            seconds={restTimer}
            duration={restDuration}
            paused={restPaused}
            nextExercise={currentExerciseName || "Next exercise"}
            nextSet={Math.min(currentSetNumber, totalSets)}
            onReduce={reduceRestTime}
            onAdd={addRestTime}
            onTogglePause={() => setRestPaused((current) => !current)}
            onSkip={skipRest}
          />
        )}
      </AnimatePresence>

      <ExerciseDetailsSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        exerciseId={detailsExerciseId}
      />
      {trainingEnhancementsEnabled && <ExerciseCatalogSheet
        open={replacementOpen}
        onOpenChange={setReplacementOpen}
        onSelect={handleReplacement}
        selectedId={currentOverride?.id}
        title={addedCopy.chooseAlternative}
        allowedExerciseIds={safeSubstitutionIds}
      />}
      {trainingEnhancementsEnabled && <PlateCalculatorSheet
        open={plateCalculatorOpen}
        onOpenChange={setPlateCalculatorOpen}
        targetWeightKg={Number.parseFloat(weightInput) || equipmentProfile.bar_weight_kg}
        profiles={equipmentProfiles}
        defaultProfile={equipmentProfile}
        onApply={(weightKg) => setWeightInput(plateWeightInput(weightKg))}
        onSaveProfile={saveEquipmentProfile}
      />}
      <AnimatePresence>
        {trainingEnhancementsEnabled && skipSheetOpen && currentExercise && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex items-end justify-center bg-[#020617]/40" onClick={() => setSkipSheetOpen(false)}>
            <motion.section dir={isRTL ? "rtl" : "ltr"} initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} onClick={(event) => event.stopPropagation()} className="w-full max-w-[430px] rounded-t-[30px] bg-white px-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))] pt-3 shadow-2xl">
              <div className="mx-auto h-1 w-10 rounded-full bg-[#DDE5EF]" />
              <div className="mt-5 flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[#FFF0F2] text-[#FB6B7A]"><SkipForward className="h-5 w-5" /></span><div><h2 className="text-[17px] font-extrabold text-[#07152F]">{addedCopy.skipExerciseTitle}</h2><p className="mt-1 text-[11px] font-medium leading-5 text-[#71809C]">{addedCopy.skipExerciseBody}</p></div></div>
              <textarea value={skipReason} onChange={(event) => setSkipReason(event.target.value)} rows={3} placeholder={addedCopy.optionalReason} className="mt-4 w-full resize-none rounded-[17px] bg-[#F6F8FB] px-4 py-3 text-[12px] font-semibold text-[#07152F] outline-none ring-1 ring-[#E5EAF1] placeholder:text-[#94A3B8] focus:ring-[#FB6B7A]" />
              <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setSkipSheetOpen(false)} className="min-h-12 rounded-[16px] bg-[#F6F8FB] text-[12px] font-extrabold text-[#41506A] ring-1 ring-[#DDE5EF]">{addedCopy.keepExercise}</button><button type="button" onClick={handleSkipExercise} className="min-h-12 rounded-[16px] bg-[#020617] text-[12px] font-extrabold text-white">{addedCopy.skipExercise}</button></div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
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

function PreviousSetHint({
  loading,
  previousSet,
  onApply,
}: {
  loading: boolean;
  previousSet?: PreviousSetReference;
  onApply: () => void;
}) {
  if (loading) {
    return (
      <div className="mt-5 rounded-[18px] bg-[#F8FAFC] px-3.5 py-3 ring-1 ring-[#E1E7EF]">
        <div className="flex items-center gap-2">
          <span className="h-8 w-8 animate-pulse rounded-[12px] bg-[#E5EAF1]" />
          <span className="min-w-0 flex-1">
            <span className="block h-3 w-28 animate-pulse rounded-full bg-[#E5EAF1]" />
            <span className="mt-2 block h-2.5 w-40 animate-pulse rounded-full bg-[#EDF1F5]" />
          </span>
        </div>
      </div>
    );
  }

  if (!previousSet) {
    return (
      <div className="mt-5 flex items-center gap-3 rounded-[18px] bg-[#F8FAFC] px-3.5 py-3 ring-1 ring-[#E1E7EF]">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-white text-[#8A98AF] ring-1 ring-[#DDE5EF]">
          <Clock3 className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8A98AF]">Previous set</p>
          <p className="mt-1 text-[11px] font-semibold text-[#71809C]">No previous numbers for this set yet.</p>
        </div>
      </div>
    );
  }

  const values = [
    previousSet.weight_kg ? `${previousSet.weight_kg} kg` : null,
    previousSet.reps ? `${previousSet.reps} reps` : null,
  ].filter(Boolean);
  const dateLabel = previousSet.completed_at
    ? new Date(previousSet.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "last session";

  return (
    <div className="mt-5 rounded-[18px] bg-[#F1FBF8] p-3.5 ring-1 ring-[#BCECDF]">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#16A98A] ring-1 ring-[#BCECDF]">
          <ArrowUpRight className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#0E9F83]">Previous set</p>
          <p className="mt-1 truncate text-[13px] font-extrabold text-[#07152F]">
            {values.length ? values.join(" · ") : "Completed"} <span className="text-[#71809C]">on {dateLabel}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onApply}
          className="min-h-10 shrink-0 rounded-[14px] bg-[#07152F] px-3 text-[11px] font-extrabold text-white active:scale-95"
        >
          Use
        </button>
      </div>
    </div>
  );
}

function RestTimerCard({
  seconds,
  duration,
  paused,
  nextExercise,
  nextSet,
  onReduce,
  onAdd,
  onTogglePause,
  onSkip,
}: {
  seconds: number;
  duration: number;
  paused: boolean;
  nextExercise: string;
  nextSet: number;
  onReduce: () => void;
  onAdd: () => void;
  onTogglePause: () => void;
  onSkip: () => void;
}) {
  const progress = duration > 0 ? Math.max(0, Math.min(100, (seconds / duration) * 100)) : 0;

  return (
    <section className="rounded-[28px] bg-[#020617] p-4 text-white shadow-[0_18px_40px_rgba(2,6,23,0.18)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#22C7A1]">Rest timer</p>
          <h2 className="mt-1 text-[18px] font-black tabular-nums">{formatTime(seconds)}</h2>
          <p className="mt-1 truncate text-[11px] font-semibold text-[#94A3B8]">
            Up next: {nextExercise} · set {nextSet}
          </p>
        </div>
        <button
          type="button"
          onClick={onTogglePause}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-white text-[#020617] active:scale-95"
          aria-label={paused ? "Resume rest timer" : "Pause rest timer"}
        >
          {paused ? <Play className="h-5 w-5 fill-current" /> : <Pause className="h-5 w-5" />}
        </button>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/12">
        <div className="h-full rounded-full bg-[#22C7A1] transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        <RestControlButton onClick={onReduce} label="-15s" icon={<Minus className="h-4 w-4" />} />
        <RestControlButton onClick={onTogglePause} label={paused ? "Resume" : "Pause"} icon={paused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4" />} />
        <RestControlButton onClick={onAdd} label="+15s" icon={<Plus className="h-4 w-4" />} />
        <button
          type="button"
          onClick={onSkip}
          className="min-h-11 rounded-[15px] bg-white text-[11px] font-extrabold text-[#020617] active:scale-95"
        >
          Skip
        </button>
      </div>
    </section>
  );
}

function RestControlButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 items-center justify-center gap-1.5 rounded-[15px] bg-white/10 px-2 text-[11px] font-extrabold text-white ring-1 ring-white/10 active:scale-95"
    >
      {icon}
      {label}
    </button>
  );
}

function RestOverlay({
  seconds,
  duration,
  paused,
  nextExercise,
  nextSet,
  onReduce,
  onAdd,
  onTogglePause,
  onSkip,
}: {
  seconds: number;
  duration: number;
  paused: boolean;
  nextExercise: string;
  nextSet: number;
  onReduce: () => void;
  onAdd: () => void;
  onTogglePause: () => void;
  onSkip: () => void;
}) {
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const progress = duration > 0 ? seconds / duration : 0;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/30 backdrop-blur-sm sm:items-center sm:p-4">
      <motion.section initial={{ y: 32, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 32, opacity: 0 }} className="w-full max-w-[430px] rounded-t-[32px] bg-white px-6 pb-[calc(24px+env(safe-area-inset-bottom,0px))] pt-6 text-center shadow-2xl sm:rounded-[32px]">
        <div className="mx-auto flex h-10 w-max items-center gap-2 rounded-full bg-[#ECFDF8] px-4 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#0E9F83] ring-1 ring-[#BCECDF]">
          <Timer className="h-4 w-4" /> {paused ? "Recovery paused" : "Recovery"}
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
        <div className="mt-6 grid grid-cols-3 gap-2">
          <button type="button" onClick={onReduce} className="min-h-12 rounded-[16px] bg-[#F6F8FB] text-[12px] font-extrabold text-[#020617] ring-1 ring-[#E5EAF1]">-15s</button>
          <button type="button" onClick={onTogglePause} className="flex min-h-12 items-center justify-center gap-2 rounded-[16px] bg-[#020617] text-[12px] font-extrabold text-white">
            {paused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4" />}
            {paused ? "Resume" : "Pause"}
          </button>
          <button type="button" onClick={onAdd} className="min-h-12 rounded-[16px] bg-[#F6F8FB] text-[12px] font-extrabold text-[#020617] ring-1 ring-[#E5EAF1]">+15s</button>
        </div>
        <button onClick={onSkip} className="mt-3 min-h-12 w-full rounded-[16px] bg-[#F6F8FB] text-[13px] font-extrabold text-[#41506A] ring-1 ring-[#DDE5EF]">Skip rest</button>
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
