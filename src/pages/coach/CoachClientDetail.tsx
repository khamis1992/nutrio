import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, CalendarCheck, TrendingDown, TrendingUp, Minus,
  Flame, Loader2, UtensilsCrossed, ChefHat, AlertCircle, Pencil,
  Lock, Plus, Check, X, Ruler, Camera, Dumbbell, Flag, FileDown,
  ChevronDown, ChevronUp, Search, Trash2, Sun, Moon, Cookie, Zap,
  ZoomIn, ChevronLeft, ChevronRight, Images,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EditClientTargetsModal } from "@/components/coach/EditClientTargetsModal";
import { CoachPerformanceDirectivePanel } from "@/components/coach/CoachPerformanceDirectivePanel";
import { CareGovernancePanel } from "@/components/coach/CareGovernancePanel";
import { ExerciseCatalogSheet } from "@/components/exercises/ExerciseCatalogSheet";
import { ExerciseMedia } from "@/components/exercises/ExerciseMedia";
import { MuscleLoadMap } from "@/components/workout/MuscleLoadMap";
import {
  CoachClientHero,
  CoachClientSectionNav,
  CoachClientViewIntro,
  type CoachClientView,
} from "@/components/coach/client/CoachClientShell";
import { useCoachNotes } from "@/hooks/useCoachNotes";
import { useBodyMeasurements, type ProgressPhoto } from "@/hooks/useBodyMeasurements";
import { useGoalProposals } from "@/hooks/useGoalProposals";
import { useCoachPrograms } from "@/hooks/useCoachPrograms";
import { useClientCompletionStats } from "@/hooks/useClientCompletionStats";
import { useWorkoutAdherence } from "@/hooks/useWorkoutAdherence";
import { useCoachReport } from "@/hooks/useCoachReport";
import { useExerciseCatalog } from "@/hooks/useExerciseCatalog";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  formatExerciseLabel,
  type ExerciseCatalogItem,
} from "@/lib/exercise-catalog";
import {
  DEFAULT_PROGRESSION_RULE,
  normalizeProgressionRule,
  progressionRuleSummary,
  type ProgressionStrategy,
} from "@/lib/workout-progression";
import type { WorkoutPrescriptionUnit, WorkoutSetType } from "@/lib/workout-sequence";
import { calculateMuscleVolume } from "@/lib/strength-training";
import { isPhaseOneFeatureEnabled } from "@/lib/phase-one-feature-flags";
import { toast } from "sonner";

import "./CoachClientDetail.css";

interface ClientProfile {
  full_name: string | null;
  avatar_url: string | null;
  health_goal: string | null;
  daily_calorie_target: number | null;
  protein_target_g: number | null;
  carbs_target_g: number | null;
  fat_target_g: number | null;
}

interface MealSchedule {
  id: string;
  scheduled_date: string;
  order_status: string;
  meal_name: string;
  restaurant_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface WeightEntry {
  log_date: string;
  weight_kg: number;
}

interface DayAdherence {
  date: string;
  label: string;
  adherence: number;
  mealsTotal: number;
  mealsDelivered: number;
}

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 24 } },
};

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ProgressionField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max?: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="rounded-xl bg-white p-2 ring-1 ring-violet-100">
      <span className="block text-[8px] font-extrabold uppercase tracking-wide text-slate-400">{label}</span>
      <span className="mt-1 flex items-center gap-1">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-7 min-w-0 flex-1 bg-transparent text-[12px] font-extrabold text-slate-900 outline-none"
        />
        {suffix && <span className="text-[8px] font-bold text-slate-400">{suffix}</span>}
      </span>
    </label>
  );
}

function PrivateProgressPhotoGallery({ photos }: { photos: ProgressPhoto[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activePhoto = typeof activeIndex === "number" ? photos[activeIndex] : null;

  const goToPrevious = () => {
    setActiveIndex((current) => {
      if (current === null) return current;
      return current === 0 ? photos.length - 1 : current - 1;
    });
  };

  const goToNext = () => {
    setActiveIndex((current) => {
      if (current === null) return current;
      return current === photos.length - 1 ? 0 : current + 1;
    });
  };

  if (photos.length === 0) return null;

  return (
    <div className="pt-3 border-t border-[#E5EAF1]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F3F4FF] text-[#7C83F6] ring-1 ring-[#E5EAF1]">
            <Images className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7C83F6]">Private gallery</p>
            <p className="text-[12px] font-black text-[#020617]">{photos.length} progress photo{photos.length === 1 ? "" : "s"}</p>
          </div>
        </div>
        <span className="rounded-full bg-[#F6F8FB] px-2.5 py-1 text-[10px] font-black text-[#94A3B8] ring-1 ring-[#E5EAF1]">Tap to zoom</span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {photos.slice(0, 8).map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setActiveIndex(index)}
            className="group relative aspect-square overflow-hidden rounded-2xl bg-[#F6F8FB] ring-1 ring-[#E5EAF1] active:scale-[0.98]"
            aria-label={`Open progress photo ${index + 1}`}
          >
            <img src={photo.url} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
            <span className="absolute inset-0 flex items-center justify-center bg-[#020617]/0 opacity-0 transition-all group-hover:bg-[#020617]/25 group-hover:opacity-100">
              <ZoomIn className="h-5 w-5 text-white" />
            </span>
            {index === 0 && (
              <span className="absolute right-1.5 top-1.5 rounded-full bg-[#22C7A1] px-1.5 py-0.5 text-[8px] font-black text-white shadow-sm">
                NEW
              </span>
            )}
            <span className="absolute bottom-1 left-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[8px] font-black text-[#64748B]">
              {new Date(photo.log_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </button>
        ))}
      </div>

      {activePhoto && (
        <div className="fixed inset-0 z-[1300] bg-[#020617]/92 px-4 py-[max(20px,env(safe-area-inset-top))] pb-[max(20px,env(safe-area-inset-bottom))]" role="dialog" aria-modal="true">
          <div className="mx-auto flex h-full max-w-md flex-col">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">Progress photo</p>
                <p className="text-[15px] font-black text-white">
                  {new Date(activePhoto.log_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveIndex(null)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 active:scale-[0.98]"
                aria-label="Close photo"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative min-h-0 flex-1 overflow-hidden rounded-[28px] bg-black ring-1 ring-white/10">
              <img src={activePhoto.url} alt="" className="h-full w-full object-contain" />
              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={goToPrevious}
                    className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#020617] shadow-lg active:scale-[0.98]"
                    aria-label="Previous photo"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={goToNext}
                    className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#020617] shadow-lg active:scale-[0.98]"
                    aria-label="Next photo"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/10 px-3 py-2 text-white ring-1 ring-white/10">
              <span className="text-[11px] font-bold text-[#94A3B8]">Private signed storage preview</span>
              <span className="text-[12px] font-black">{(activeIndex ?? 0) + 1}/{photos.length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CoachClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [meals, setMeals] = useState<MealSchedule[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [streak, setStreak] = useState(0);
  const [adherenceDays, setAdherenceDays] = useState<DayAdherence[]>([]);
  const [overallAdherence, setOverallAdherence] = useState(0);
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const trainingEnhancementsEnabled = isPhaseOneFeatureEnabled("trainingEnhancements");
  const trainingCopy = isRTL ? {
    sessionChanges: "تغييرات الجلسة",
    prescriptionAccuracy: "دقة الوصفة التدريبية",
    basedOnSets: (count: number) => `بناءً على ${count} مجموعة مسجلة`,
    volumeKg: "الحجم بالكيلوغرام",
    averageRpe: "متوسط RPE",
    bestOneRepMax: "أفضل 1RM تقديري",
    restAccuracy: "دقة الراحة",
    muscleMap: "خريطة العضلات",
    muscleMapDescription: "المجموعات الموصوفة مقابل المكتملة خلال آخر 7 أيام.",
    startFromTemplate: "ابدأ من قالب",
    chooseTemplate: "اختر قالبًا محفوظًا",
    weeks: "أسابيع",
    use: "استخدام",
    templateError: "تعذر تطبيق القالب",
    schedule: "الجدول",
    flexible: "مرن",
    fixed: "ثابت",
    daysPerWeek: "أيام/أسبوع",
    phases: "المراحل",
    dayPurpose: "هدف اليوم",
    workout: "تمرين",
    rest: "راحة",
    recovery: "استشفاء",
    phase: "المرحلة",
    setStructure: "بنية المجموعة",
    setStructureDescription: "تسلسل وقياس ودقة الحمل",
    setType: "نوع المجموعة",
    setTypes: {
      normal: "عادية", dropset: "مجموعة إسقاط", myo: "تكرارات مايو", partial: "تكرارات جزئية",
      forced: "تكرارات مساعدة", tut: "وقت تحت الشد", isometric: "ثبات", jump: "قفز / قوة",
    },
    superset: "مجموعة فائقة",
    none: "لا يوجد",
    group: "مجموعة",
    measureBy: "القياس حسب",
    measures: { reps: "تكرارات", seconds: "ثوانٍ", minutes: "دقائق", meters: "أمتار", kilometers: "كيلومترات" },
    weightRounding: "تقريب الوزن",
    setsOnlyDescription: "أضف المجموعات تدريجيًا مع تثبيت الحمل وعدد التكرارات المستهدف.",
    rirDescription: "زد الحمل فقط عندما يحافظ العميل على التكرارات الاحتياطية المحددة.",
    densityDescription: "قلل الراحة تدريجيًا مع الحفاظ على الحجم والجهد الموصوفين.",
    addSets: "إضافة مجموعات",
    maximumSets: "الحد الأقصى للمجموعات",
    targetRir: "RIR المستهدف",
    reduceRest: "تقليل الراحة",
    minimumRest: "أقل راحة",
    secondsShort: "ث",
    saveTemplate: "حفظ كقالب",
    templateSaved: "تم حفظ التمرين كقالب قابل لإعادة الاستخدام",
    templateSaveError: "تعذر حفظ القالب",
  } : {
    sessionChanges: "Session changes",
    prescriptionAccuracy: "Prescription accuracy",
    basedOnSets: (count: number) => `Based on ${count} logged sets`,
    volumeKg: "Volume kg",
    averageRpe: "Average RPE",
    bestOneRepMax: "Best est. 1RM",
    restAccuracy: "Rest accuracy",
    muscleMap: "Muscle map",
    muscleMapDescription: "Prescribed versus completed working sets in the last 7 days.",
    startFromTemplate: "Start from template",
    chooseTemplate: "Choose a saved template",
    weeks: "weeks",
    use: "Use",
    templateError: "Unable to apply template",
    schedule: "Schedule",
    flexible: "Flexible",
    fixed: "Fixed",
    daysPerWeek: "Days/week",
    phases: "Phases",
    dayPurpose: "Day purpose",
    workout: "Workout",
    rest: "Rest",
    recovery: "Recovery",
    phase: "Phase",
    setStructure: "Set structure",
    setStructureDescription: "Sequence, measurement and loading precision",
    setType: "Set type",
    setTypes: {
      normal: "Normal", dropset: "Drop set", myo: "Myo reps", partial: "Partial reps",
      forced: "Forced reps", tut: "Time under tension", isometric: "Isometric", jump: "Jump / power",
    },
    superset: "Superset",
    none: "None",
    group: "Group",
    measureBy: "Measure by",
    measures: { reps: "Repetitions", seconds: "Seconds", minutes: "Minutes", meters: "Meters", kilometers: "Kilometers" },
    weightRounding: "Weight rounding",
    setsOnlyDescription: "Add sets gradually while keeping the current load and repetition target.",
    rirDescription: "Increase load only when the client maintains the prescribed reps in reserve.",
    densityDescription: "Reduce rest gradually while the client preserves prescribed volume and effort.",
    addSets: "Add sets",
    maximumSets: "Maximum sets",
    targetRir: "Target RIR",
    reduceRest: "Reduce rest",
    minimumRest: "Minimum rest",
    secondsShort: "sec",
    saveTemplate: "Save template",
    templateSaved: "Workout saved as a reusable template",
    templateSaveError: "Unable to save template",
  };
  const coachId = user?.id;
  const { notes, loading: notesLoading, addNote, updateNote, deleteNote } = useCoachNotes(coachId, clientId);
  const { measurements, photos, loading: measurementsLoading, uploadPhoto } = useBodyMeasurements(clientId);
  const { proposals, proposeGoal, completeGoal } = useGoalProposals(coachId, clientId);
  const { programs, programMeals, programExercises, programWorkoutDays, workoutTemplates, mealInfos, createProgram, updateProgram, assignMeal, updateMeal, removeMeal, assignExercise, updateExercise, removeExercise, upsertWorkoutDay, saveWorkoutTemplate, createProgramFromTemplate } = useCoachPrograms(coachId, clientId, true, trainingEnhancementsEnabled);
  const { getExerciseStat, getMealStat } = useClientCompletionStats(clientId);
  const { weekAdherence, exerciseHistory, exerciseEvents: workoutExerciseEvents, alerts: workoutAlerts, overallWeeklyPct, targetAdherencePct, targetSetCount, analytics: workoutAnalytics, loading: adherenceLoading, getExerciseWeightHistory, getExerciseTrend } = useWorkoutAdherence(clientId, trainingEnhancementsEnabled);
  const { generating, generateReport } = useCoachReport();
  const { exercises: exerciseCatalog } = useExerciseCatalog();
  const exerciseCatalogById = useMemo(
    () => new Map(exerciseCatalog.map((exercise) => [exercise.id, exercise])),
    [exerciseCatalog],
  );
  const [newNote, setNewNote] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const [loading, setLoading] = useState(true);
  const [targetsModalOpen, setTargetsModalOpen] = useState(false);
  const [mealBuilderOpen, setMealBuilderOpen] = useState(false);
  const [workoutBuilderOpen, setWorkoutBuilderOpen] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [activeView, setActiveView] = useState<CoachClientView>("overview");
  // Meal plan builder state
  const [mealPlanTitle, setMealPlanTitle] = useState("");
  const [mealPlanStartDate, setMealPlanStartDate] = useState("");
  const [mealPlanEndDate, setMealPlanEndDate] = useState("");
  const [mealPlanProgramId, setMealPlanProgramId] = useState<string | null>(null);
  const [mealPlanStep, setMealPlanStep] = useState<"create" | "assign">("create");
  const [selectedMealDate, setSelectedMealDate] = useState("");
  const [, setSelectedMealType] = useState("lunch");
  const [availableMeals, setAvailableMeals] = useState<{ id: string; name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; image_url: string | null; price: number; restaurant_name?: string }[]>([]);
  // Workout builder state
  const [workoutPlanTitle, setWorkoutPlanTitle] = useState("");
  const [workoutPlanStartDate, setWorkoutPlanStartDate] = useState("");
  const [workoutPlanEndDate, setWorkoutPlanEndDate] = useState("");
  const [workoutScheduleMode, setWorkoutScheduleMode] = useState<"fixed" | "flexible">("flexible");
  const [workoutDaysPerWeek, setWorkoutDaysPerWeek] = useState(3);
  const [workoutPhaseCount, setWorkoutPhaseCount] = useState(1);
  const [selectedWorkoutTemplateId, setSelectedWorkoutTemplateId] = useState("");
  const [workoutProgramId, setWorkoutProgramId] = useState<string | null>(null);
  const [workoutStep, setWorkoutStep] = useState<"create" | "assign">("create");
  const [exerciseName, setExerciseName] = useState("");
  const [exerciseCatalogOpen, setExerciseCatalogOpen] = useState(false);
  const [exercisePreviewOpen, setExercisePreviewOpen] = useState(false);
  const [exercisePreviewId, setExercisePreviewId] = useState<string | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [selectedCatalogExercise, setSelectedCatalogExercise] = useState<ExerciseCatalogItem | null>(null);
  const [exerciseSets, setExerciseSets] = useState(3);
  const [exerciseReps, setExerciseReps] = useState("10");
  const [exerciseRest, setExerciseRest] = useState(60);
  const [exerciseSetType, setExerciseSetType] = useState<WorkoutSetType>("normal");
  const [exerciseSupersetGroup, setExerciseSupersetGroup] = useState("");
  const [exercisePrescriptionUnit, setExercisePrescriptionUnit] = useState<WorkoutPrescriptionUnit>("reps");
  const [exerciseWeightRounding, setExerciseWeightRounding] = useState(0.5);
  const [exerciseNotes, setExerciseNotes] = useState("");
  const [progressionEnabled, setProgressionEnabled] = useState(false);
  const [progressionStrategy, setProgressionStrategy] = useState<ProgressionStrategy>("double_progression");
  const [progressionRepMin, setProgressionRepMin] = useState(8);
  const [progressionRepMax, setProgressionRepMax] = useState(12);
  const [progressionLoadIncrement, setProgressionLoadIncrement] = useState(2.5);
  const [progressionRepIncrement, setProgressionRepIncrement] = useState(1);
  const [progressionSetIncrement, setProgressionSetIncrement] = useState(1);
  const [progressionMaxSets, setProgressionMaxSets] = useState(6);
  const [progressionTargetRir, setProgressionTargetRir] = useState(2);
  const [progressionRestDecrement, setProgressionRestDecrement] = useState(15);
  const [progressionMinRest, setProgressionMinRest] = useState(30);
  const [progressionRpeCeiling, setProgressionRpeCeiling] = useState(8.5);
  const [progressionFailureLimit, setProgressionFailureLimit] = useState(2);
  const [progressionDeloadPercent, setProgressionDeloadPercent] = useState(10);
  const [programTab, setProgramTab] = useState<"meal" | "workout">("meal");
  const [expandedProgramId, setExpandedProgramId] = useState<string | null>(null);
  const [mealSearch, setMealSearch] = useState("");
  const [assigningSlot, setAssigningSlot] = useState<{ date: string; type: string } | null>(null);
  const [selectedWorkoutDay, setSelectedWorkoutDay] = useState(1);
  const [creatingProgram, setCreatingProgram] = useState(false);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [editingProgramTitle, setEditingProgramTitle] = useState("");
  const [editingProgramStartDate, setEditingProgramStartDate] = useState("");
  const [editingProgramEndDate, setEditingProgramEndDate] = useState("");
  const [clientSub, setClientSub] = useState<{ remainingMeals: number; totalMeals: number; remainingMealsWeekly: number; totalMealsWeekly: number; isUnlimited: boolean } | null>(null);
  const weeklyMuscleVolume = useMemo(() => {
    if (!trainingEnhancementsEnabled) return [];
    const activeWorkoutProgramIds = new Set(programs
      .filter((program) => program.type === "workout_plan" && program.status === "active")
      .map((program) => program.id));
    const prescribedExercises = programExercises.filter((exercise) =>
      activeWorkoutProgramIds.size === 0 || activeWorkoutProgramIds.has(exercise.program_id));
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);

    return calculateMuscleVolume(
      prescribedExercises.map((exercise) => {
        const catalogExercise = exercise.exercise_catalog_id
          ? exerciseCatalogById.get(exercise.exercise_catalog_id)
          : undefined;
        return {
          id: exercise.id,
          sets: exercise.sets,
          muscle: catalogExercise?.target
            ? formatExerciseLabel(catalogExercise.target)
            : "Other",
        };
      }),
      exerciseHistory
        .filter((entry) => new Date(entry.completed_at).getTime() >= start.getTime())
        .map((entry) => ({
          programExerciseId: entry.program_exercise_id,
          completed: true,
        })),
    );
  }, [exerciseCatalogById, exerciseHistory, programExercises, programs, trainingEnhancementsEnabled]);

  useEffect(() => {
    if (!clientId) return;
    fetchClientData();
  }, [clientId]);

  const fetchClientData = async () => {
    if (!clientId) return;
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split("T")[0];
    const todayStr = today.toISOString().split("T")[0];

    try {
      // Fetch profile separately so it always resolves even if other queries fail
      const { data: prof, error: profError } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, health_goal, daily_calorie_target, protein_target_g, carbs_target_g, fat_target_g")
        .eq("user_id", clientId)
        .maybeSingle();

      if (profError) {
        console.error("Profile query error:", profError);
      }

      setProfile(prof || null);

      // Fetch secondary data in parallel (non-blocking for profile display)
      const [
        { data: mealData },
        { data: weightData },
        { data: streakData },
        { data: subData },
      ] = await Promise.all([
        supabase.from("meal_schedules").select("id, scheduled_date, order_status, meals:meal_id(name, calories, protein_g, carbs_g, fat_g), restaurants:restaurant_id(name)").eq("user_id", clientId).gte("scheduled_date", weekAgoStr).lte("scheduled_date", todayStr).order("scheduled_date", { ascending: true }),
        supabase.from("body_measurements").select("log_date, weight_kg").eq("user_id", clientId).gte("log_date", weekAgoStr).order("log_date", { ascending: true }),
        supabase.from("user_streaks").select("current_streak").eq("user_id", clientId).eq("streak_type", "logging").maybeSingle(),
        supabase.from("subscriptions").select("meals_per_month, meals_used_this_month, meals_per_week, meals_used_this_week, tier").eq("user_id", clientId).in("status", ["active", "pending"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      setStreak(streakData?.current_streak || 0);

      if (subData) {
        const isUnlimited = subData.tier === "vip";
        const totalMeals = subData.meals_per_month || 0;
        const mealsUsed = subData.meals_used_this_month || 0;
        const remainingMeals = isUnlimited ? Infinity : Math.max(0, totalMeals - mealsUsed);
        const totalMealsWeekly = subData.meals_per_week || 0;
        const mealsUsedWeekly = subData.meals_used_this_week || 0;
        const remainingMealsWeekly = isUnlimited ? Infinity : Math.max(0, totalMealsWeekly - mealsUsedWeekly);
        setClientSub({ remainingMeals, totalMeals, remainingMealsWeekly, totalMealsWeekly, isUnlimited });
      } else {
        setClientSub({ remainingMeals: 0, totalMeals: 0, remainingMealsWeekly: 0, totalMealsWeekly: 0, isUnlimited: false });
      }

      if (weightData) {
        setWeights(
          weightData.flatMap((entry) =>
            entry.weight_kg === null
              ? []
              : [{ log_date: entry.log_date, weight_kg: entry.weight_kg }]
          )
        );
      }

      if (mealData) {
        const formattedMeals: MealSchedule[] = (mealData as any[]).map((m: any) => ({
          id: m.id,
          scheduled_date: m.scheduled_date,
          order_status: m.order_status,
          meal_name: m.meals?.name || "Meal",
          restaurant_name: m.restaurants?.name || "Restaurant",
          calories: m.meals?.calories || 0,
          protein_g: m.meals?.protein_g || 0,
          carbs_g: m.meals?.carbs_g || 0,
          fat_g: m.meals?.fat_g || 0,
        }));
        setMeals(formattedMeals);

        // Calculate daily adherence
        const dayMap = new Map<string, { total: number; delivered: number }>();
        for (const meal of formattedMeals) {
          const d = meal.scheduled_date;
          if (!dayMap.has(d)) dayMap.set(d, { total: 0, delivered: 0 });
          const entry = dayMap.get(d)!;
          entry.total++;
          if (meal.order_status === "delivered" || meal.order_status === "completed") {
            entry.delivered++;
          }
        }

        const adherenceArr: DayAdherence[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const ds = d.toISOString().split("T")[0];
          const entry = dayMap.get(ds);
          const total = entry?.total || 0;
          const delivered = entry?.delivered || 0;
          adherenceArr.push({
            date: ds,
            label: days[d.getDay()],
            adherence: total > 0 ? Math.round((delivered / total) * 100) : 0,
            mealsTotal: total,
            mealsDelivered: delivered,
          });
        }
        setAdherenceDays(adherenceArr);

        const totalAll = adherenceArr.reduce((s, d) => s + d.mealsTotal, 0);
        const deliveredAll = adherenceArr.reduce((s, d) => s + d.mealsDelivered, 0);
        setOverallAdherence(totalAll > 0 ? Math.round((deliveredAll / totalAll) * 100) : 0);
      }
    } catch (err) {
      console.error("Error fetching client data:", err);
    } finally {
      setLoading(false);
    }
  };

  function GoalProposalForm({ onPropose }: { onPropose: (data: { goal_type: string; target_value: string; deadline: string; notes: string }) => Promise<void> }) {
    const [goalType, setGoalType] = useState("weight_loss");
    const [targetValue, setTargetValue] = useState("");
    const [goalDeadline, setGoalDeadline] = useState("");
    const [goalNotes, setGoalNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);
    return (
      <div className="space-y-4">
        <div>
          <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Goal Type</label>
          <select value={goalType} onChange={(e) => setGoalType(e.target.value)} className="w-full h-[44px] px-4 rounded-full bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
            <option value="weight_loss">Weight Loss</option>
            <option value="muscle_gain">Muscle Gain</option>
            <option value="meal_adherence">Meal Adherence</option>
            <option value="calorie_target">Calorie Target</option>
            <option value="exercise_frequency">Exercise Frequency</option>
            <option value="body_fat_reduction">Body Fat Reduction</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Target Value</label>
            <input type="text" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder="e.g. 75kg, 90%" className="w-full h-[44px] px-4 rounded-full bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Deadline</label>
            <input type="date" value={goalDeadline} onChange={(e) => setGoalDeadline(e.target.value)} className="w-full h-[44px] px-4 rounded-full bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Notes (optional)</label>
          <textarea value={goalNotes} onChange={(e) => setGoalNotes(e.target.value)} rows={2} placeholder="Additional guidance..." className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none" />
        </div>
        <button
          onClick={async () => {
            if (!targetValue.trim()) return;
            setSubmitting(true);
            await onPropose({ goal_type: goalType, target_value: targetValue.trim(), deadline: goalDeadline, notes: goalNotes });
            setSubmitting(false);
          }}
          disabled={!targetValue.trim() || submitting}
          className="w-full h-[44px] rounded-full bg-emerald-600 text-white text-[13px] font-bold hover:bg-emerald-700 disabled:opacity-40 active:scale-[0.98] transition-all"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Propose Goal"}
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-12 h-12 text-slate-300 mb-3" />
        <p className="text-slate-500 font-semibold">Client not found</p>
      </div>
    );
  }

  const weightTrend = weights.length >= 2
    ? Math.round((weights[weights.length - 1].weight_kg - weights[0].weight_kg) * 100) / 100
    : null;

  const WeightIcon = weightTrend === null ? null : weightTrend < 0 ? TrendingDown : weightTrend > 0 ? TrendingUp : Minus;
  const weightColor = weightTrend === null ? "text-slate-400" : weightTrend < 0 ? "text-emerald-500" : weightTrend > 0 ? "text-red-500" : "text-slate-400";

  const activeGoals = proposals.filter((proposal) => proposal.status === "accepted").length;
  const activePlans = programs.filter((program) => program.status === "active").length;
  const clientGoal = profile.health_goal
    ? profile.health_goal.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "General Health";
  const openReport = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    setReportStartDate(start.toISOString().split("T")[0]);
    setReportEndDate(end.toISOString().split("T")[0]);
    setReportModalOpen(true);
  };

  const resetExerciseForm = () => {
    setEditingExerciseId(null);
    setSelectedExerciseId(null);
    setSelectedCatalogExercise(null);
    setExerciseName("");
    setExerciseSets(3);
    setExerciseReps("10");
    setExerciseRest(60);
    setExerciseSetType("normal");
    setExerciseSupersetGroup("");
    setExercisePrescriptionUnit("reps");
    setExerciseWeightRounding(0.5);
    setExerciseNotes("");
    setProgressionEnabled(DEFAULT_PROGRESSION_RULE.enabled);
    setProgressionStrategy(DEFAULT_PROGRESSION_RULE.strategy);
    setProgressionRepMin(DEFAULT_PROGRESSION_RULE.rep_min);
    setProgressionRepMax(DEFAULT_PROGRESSION_RULE.rep_max);
    setProgressionLoadIncrement(DEFAULT_PROGRESSION_RULE.load_increment_kg);
    setProgressionRepIncrement(DEFAULT_PROGRESSION_RULE.rep_increment);
    setProgressionSetIncrement(DEFAULT_PROGRESSION_RULE.set_increment);
    setProgressionMaxSets(DEFAULT_PROGRESSION_RULE.max_sets);
    setProgressionTargetRir(DEFAULT_PROGRESSION_RULE.target_rir);
    setProgressionRestDecrement(DEFAULT_PROGRESSION_RULE.rest_decrement_seconds);
    setProgressionMinRest(DEFAULT_PROGRESSION_RULE.min_rest_seconds);
    setProgressionRpeCeiling(DEFAULT_PROGRESSION_RULE.rpe_ceiling);
    setProgressionFailureLimit(DEFAULT_PROGRESSION_RULE.failure_sessions_before_deload);
    setProgressionDeloadPercent(DEFAULT_PROGRESSION_RULE.deload_percent);
  };

  const openWorkoutBuilder = (program?: (typeof programs)[number], day = 1) => {
    resetExerciseForm();
    setSelectedWorkoutDay(day);
    if (program) {
      setWorkoutPlanTitle(program.title);
      setWorkoutPlanStartDate(program.start_date);
      setWorkoutPlanEndDate(program.end_date);
      setWorkoutScheduleMode(program.schedule_mode === "flexible" ? "flexible" : "fixed");
      setWorkoutDaysPerWeek(program.days_per_week ?? 3);
      setWorkoutPhaseCount(program.phase_count ?? 1);
      setWorkoutProgramId(program.id);
      setWorkoutStep("assign");
      setExpandedProgramId(program.id);
    } else {
      const start = new Date();
      const end = new Date(start);
      end.setDate(end.getDate() + 28);
      setWorkoutPlanTitle("");
      setWorkoutPlanStartDate(start.toISOString().split("T")[0]);
      setWorkoutPlanEndDate(end.toISOString().split("T")[0]);
      setWorkoutProgramId(null);
      setWorkoutScheduleMode("flexible");
      setWorkoutDaysPerWeek(3);
      setWorkoutPhaseCount(1);
      setSelectedWorkoutTemplateId("");
      setWorkoutStep("create");
    }
    setWorkoutBuilderOpen(true);
  };

  return (
    <div className="coach-client-page space-y-4 pb-4">
      <CoachClientHero
        name={profile.full_name || "Client"}
        avatarUrl={profile.avatar_url}
        goal={clientGoal}
        streak={streak}
        adherence={overallAdherence}
        activeGoals={activeGoals}
        activePlans={activePlans}
        onBack={() => navigate(-1)}
        onEditTargets={() => setTargetsModalOpen(true)}
        onExportReport={openReport}
      />

      <CoachClientSectionNav value={activeView} onChange={setActiveView} />
      <CoachClientViewIntro view={activeView} />
      {/* Back button + Header */}
      <div className="hidden items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center shrink-0 shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center shrink-0">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="text-base font-bold text-emerald-700">
                {(profile.full_name || "C")[0].toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-[16px] font-extrabold tracking-[-0.02em] text-slate-950 truncate">
              {profile.full_name || "Client"}
            </h1>
            <p className="text-[11px] font-medium text-slate-500">
              {profile.health_goal ? profile.health_goal.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase()) : "General Health"}
              {streak > 0 && ` · 🔥 ${streak}-day streak`}
            </p>
          </div>
        </div>
      </div>

      {/* Export Report Button */}
      {profile && clientId && (
        <button
          onClick={() => {
            const end = new Date();
            const start = new Date();
            start.setDate(start.getDate() - 30);
            setReportStartDate(start.toISOString().split("T")[0]);
            setReportEndDate(end.toISOString().split("T")[0]);
            setReportModalOpen(true);
          }}
          className="hidden items-center gap-1.5 h-[34px] px-3 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600 hover:bg-slate-200 active:scale-95 transition-all ml-auto"
        >
          <FileDown className="w-3.5 h-3.5" />
          Export Report
        </button>
      )}

      {/* Macro Compliance Ring */}
      {activeView === "overview" && profile.daily_calorie_target && (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="client-card client-card--teal bg-white rounded-[24px] p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[15px] font-extrabold tracking-[-0.02em] text-slate-950">Daily Targets</h2>
              <p className="text-[11px] font-medium text-slate-500">Macro goals for this client</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTargetsModalOpen(true)}
                className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-200 active:scale-95 transition-all"
              >
                <Pencil className="w-3 h-3" />
                Edit
              </button>
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5">
                <CalendarCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-[12px] font-bold text-emerald-700">{overallAdherence}% adherence</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Calories", value: profile.daily_calorie_target, unit: "kcal", color: "text-slate-900", bg: "bg-slate-50" },
              { label: "Protein", value: profile.protein_target_g, unit: "g", color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Carbs", value: profile.carbs_target_g, unit: "g", color: "text-amber-600", bg: "bg-amber-50" },
              { label: "Fat", value: profile.fat_target_g, unit: "g", color: "text-purple-600", bg: "bg-purple-50" },
            ].map((macro) => (
              <div key={macro.label} className="text-center">
                <div className={cn("rounded-xl px-2 py-3", macro.bg)}>
                  <p className={cn("text-lg font-extrabold", macro.color)}>{macro.value}</p>
                  <p className="text-[10px] font-medium text-slate-400">{macro.unit}</p>
                </div>
                <p className="mt-1.5 text-[10px] font-semibold text-slate-500">{macro.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* 7-Day Meal Adherence */}
      {activeView === "overview" && adherenceDays.length > 0 && (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="client-card client-card--orange bg-white rounded-[24px] p-5"
        >
          <h2 className="text-[15px] font-extrabold tracking-[-0.02em] text-slate-950 mb-3">Meal Adherence</h2>
          <div className="flex justify-between gap-1">
            {adherenceDays.map((day) => {
              const isToday = day.date === new Date().toISOString().split("T")[0];
              const dotColor = day.adherence >= 80 ? "bg-emerald-500" : day.adherence >= 50 ? "bg-amber-500" : day.adherence > 0 ? "bg-red-500" : "bg-slate-200";
              return (
                <div key={day.date} className={cn("flex flex-col items-center gap-1.5 px-1", isToday && "relative")}>
                  {isToday && <div className="absolute -top-1 -bottom-1 -left-0.5 -right-0.5 rounded-xl bg-emerald-50/50" />}
                  <span className="relative text-[10px] font-semibold text-slate-400">{day.label}</span>
                  <div className={cn("relative w-8 h-8 rounded-full flex items-center justify-center", dotColor, day.adherence > 0 ? "text-white" : "text-slate-400")}>
                    <span className="text-[10px] font-extrabold">{day.adherence}%</span>
                  </div>
                  <span className="text-[9px] text-slate-400">{day.mealsDelivered}/{day.mealsTotal}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Weight Trend */}
      {activeView === "progress" && weights.length > 0 && (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="client-card client-card--blue bg-white rounded-[24px] p-5"
        >
          <h2 className="text-[15px] font-extrabold tracking-[-0.02em] text-slate-950 mb-3">Weight Trend</h2>
          <div className="flex items-end gap-2 h-16">
            {weights.map((w, i) => {
              const maxWeight = Math.max(...weights.map(x => x.weight_kg));
              const minWeight = Math.min(...weights.map(x => x.weight_kg));
              const range = maxWeight - minWeight || 1;
              const height = ((w.weight_kg - minWeight) / range) * 48 + 8;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-700">{w.weight_kg.toFixed(1)}</span>
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-emerald-400 to-emerald-300 min-h-[4px] transition-all"
                    style={{ height: `${height}px` }}
                  />
                  <span className="text-[9px] text-slate-400">{new Date(w.log_date).getDate()}/{new Date(w.log_date).getMonth() + 1}</span>
                </div>
              );
            })}
          </div>
          {weightTrend !== null && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
              {WeightIcon && <WeightIcon className={cn("w-4 h-4", weightColor)} />}
              <span className={cn("text-[12px] font-semibold", weightColor)}>
                7-day change: {weightTrend > 0 ? "+" : ""}{weightTrend} kg
              </span>
            </div>
          )}
        </motion.div>
      )}

      {/* Upcoming Meals */}
      {activeView === "overview" && meals.length > 0 && (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="client-card client-card--coral bg-white rounded-[24px] p-5"
        >
          <h2 className="text-[15px] font-extrabold tracking-[-0.02em] text-slate-950 mb-3">Scheduled Meals</h2>
          <div className="space-y-2">
            {meals.slice(0, 5).map((meal) => {
              const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
                delivered: { label: "Delivered", color: "text-emerald-600", bg: "bg-emerald-50" },
                completed: { label: "Completed", color: "text-emerald-600", bg: "bg-emerald-50" },
                preparing: { label: "Preparing", color: "text-amber-600", bg: "bg-amber-50" },
                confirmed: { label: "Confirmed", color: "text-blue-600", bg: "bg-blue-50" },
                pending: { label: "Pending", color: "text-slate-500", bg: "bg-slate-50" },
              };
              const status = statusConfig[meal.order_status] || statusConfig.pending;
              return (
                <div key={meal.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center shrink-0">
                    <UtensilsCrossed className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-slate-900 truncate">{meal.meal_name}</p>
                    <p className="text-[10px] text-slate-500">{meal.restaurant_name} · {meal.calories} kcal</p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", status.bg, status.color)}>
                      {status.label}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {new Date(meal.scheduled_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {activeView === "overview" && meals.length === 0 && (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="bg-white rounded-[24px] p-10 text-center shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <ChefHat className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-[15px] font-bold text-slate-900 mb-1">No meals scheduled</h3>
          <p className="text-[12px] text-slate-500">This client hasn't scheduled any meals this week.</p>
          <button
            type="button"
            onClick={() => {
              setProgramTab("meal");
              setActiveView("plans");
            }}
            className="mt-5 h-11 rounded-full bg-[#08162f] px-5 text-[12px] font-bold text-white active:scale-95"
          >
            Build a meal plan
          </button>
        </motion.div>
      )}

      {activeView === "notes" && coachId && clientId && (
        <CareGovernancePanel
          coachId={coachId}
          clientId={clientId}
          nutritionSnapshot={{
            daily_calorie_target: profile.daily_calorie_target,
            protein_target_g: profile.protein_target_g,
            carbs_target_g: profile.carbs_target_g,
            fat_target_g: profile.fat_target_g,
          }}
        />
      )}

      {/* Private Notes Section */}
      {activeView === "notes" && (
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="client-card client-card--yellow bg-white rounded-[24px] p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-400" />
            <h2 className="text-[15px] font-extrabold tracking-[-0.02em] text-slate-950">Private Notes</h2>
          </div>
        </div>

        {/* New note input */}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newNote.trim()) {
                addNote(newNote.trim()).then(() => setNewNote(""));
              }
            }}
            placeholder="Add a private observation..."
            className="flex-1 h-[40px] px-4 rounded-full bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
          <button
            onClick={async () => {
              if (!newNote.trim()) return;
              await addNote(newNote.trim());
              setNewNote("");
            }}
            disabled={!newNote.trim()}
            className="flex items-center gap-1 h-[40px] px-4 rounded-full bg-emerald-600 text-white text-[13px] font-semibold hover:bg-emerald-700 disabled:opacity-40 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>

        {/* Notes list */}
        {notesLoading ? (
          <div className="space-y-2 pt-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-[12px] text-slate-400">No notes yet. Add private observations about this client.</p>
          </div>
        ) : (
          <div className="space-y-2 pt-2">
            {notes.slice(0, 10).map((note) => (
              <div key={note.id} className="p-3 rounded-2xl bg-slate-50 group">
                {editingNoteId === note.id ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editingNoteText}
                      onChange={(e) => setEditingNoteText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && editingNoteText.trim()) {
                          updateNote(note.id, editingNoteText.trim()).then(() => setEditingNoteId(null));
                        } else if (e.key === "Escape") {
                          setEditingNoteId(null);
                        }
                      }}
                      className="flex-1 h-[36px] px-3 rounded-full bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        if (editingNoteText.trim()) {
                          updateNote(note.id, editingNoteText.trim()).then(() => setEditingNoteId(null));
                        }
                      }}
                      className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 hover:bg-emerald-700"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingNoteId(null)}
                      className="w-9 h-9 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 hover:bg-slate-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap">{note.note}</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {new Date(note.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingNoteId(note.id);
                          setEditingNoteText(note.note);
                        }}
                        className="w-7 h-7 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center hover:bg-slate-300"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="w-7 h-7 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </motion.div>
      )}

      {/* Body Measurements Section */}
      {activeView === "progress" && (
      <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="client-card client-card--blue bg-white rounded-[24px] overflow-hidden">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Ruler className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-[15px] font-extrabold text-slate-950 tracking-[-0.02em]">Body Composition</h2>
                <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                  {measurements.length > 0 ? `${measurements.length} measurements tracked` : "No data yet"}
                </p>
              </div>
            </div>
            <label className="flex items-center gap-1.5 rounded-full bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 active:scale-95 transition-all cursor-pointer">
              <Camera className="w-3.5 h-3.5" />
              Photo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); }} />
            </label>
          </div>
        </div>

        {measurementsLoading ? (
          <div className="px-5 py-4 space-y-3">
            <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-10 animate-pulse rounded-2xl bg-slate-100" />
          </div>
        ) : measurements.length === 0 ? (
          <div className="px-5 py-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <Ruler className="w-7 h-7 text-slate-300" />
              </div>
              <p className="text-[13px] font-semibold text-slate-500">No measurements recorded</p>
              <p className="text-[11px] text-slate-400 mt-1">Measurements will appear once the client logs their first entry</p>
            </div>
            <div className="mt-5">
              <PrivateProgressPhotoGallery photos={photos} />
            </div>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-4">
            {/* Primary metric — Weight */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Weight</p>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-[28px] font-extrabold tracking-[-0.04em] text-slate-950 leading-none">
                    {measurements[0]?.weight_kg?.toFixed(1) ?? "—"}
                  </span>
                  <span className="text-[12px] font-bold text-slate-400">kg</span>
                </div>
                {weightTrend !== null && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <div className={cn("flex items-center gap-1 rounded-full px-2 py-0.5", weightTrend < 0 ? "bg-emerald-50" : weightTrend > 0 ? "bg-red-50" : "bg-slate-50")}>
                      {WeightIcon && <WeightIcon className={cn("w-3 h-3", weightColor)} />}
                      <span className={cn("text-[10px] font-bold", weightColor)}>
                        {weightTrend > 0 ? "+" : ""}{weightTrend} kg
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-400">7d</span>
                  </div>
                )}
              </div>

              {/* Mini weight sparkline */}
              {weights.length >= 2 && (
                <div className="w-24 h-12 flex items-end gap-[2px]">
                  {(() => {
                    const maxW = Math.max(...weights.map(x => x.weight_kg));
                    const minW = Math.min(...weights.map(x => x.weight_kg));
                    const range = maxW - minW || 1;
                    return weights.map((w, i) => {
                      const h = ((w.weight_kg - minW) / range) * 36 + 6;
                      const isLast = i === weights.length - 1;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                          <div
                            className={cn("w-full rounded-t-sm transition-all", isLast ? "bg-emerald-500" : "bg-slate-200")}
                            style={{ height: `${h}px` }}
                          />
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

            {/* Secondary metrics grid */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Body Fat", value: measurements[0]?.body_fat_percent, unit: "%", icon: "◇", color: "from-amber-50 to-orange-50", text: "text-amber-700", ring: "ring-amber-200" },
                { label: "Waist", value: measurements[0]?.waist_cm, unit: "cm", icon: "○", color: "from-sky-50 to-blue-50", text: "text-sky-700", ring: "ring-sky-200" },
                { label: "Hips", value: measurements[0]?.hip_cm, unit: "cm", icon: "◎", color: "from-violet-50 to-purple-50", text: "text-violet-700", ring: "ring-violet-200" },
              ].map((m) => (
                <div key={m.label} className={cn("relative rounded-2xl bg-gradient-to-br p-3 ring-1", m.color, m.ring)}>
                  <span className="text-[10px] text-slate-400 absolute top-2.5 right-2.5">{m.icon}</span>
                  <p className={cn("text-[18px] font-extrabold leading-none tracking-[-0.03em]", m.text)}>
                    {m.value != null ? m.value : "—"}
                  </p>
                  <p className="text-[9px] font-bold text-slate-400 mt-1">
                    {m.label} {m.value != null ? m.unit : ""}
                  </p>
                </div>
              ))}
            </div>

            {/* Measurement history dots */}
            {measurements.length > 1 && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider shrink-0">History</span>
                <div className="flex-1 flex items-center gap-1 overflow-x-auto">
                  {measurements.slice(0, 14).map((m, i) => (
                    <div key={m.id} className="flex flex-col items-center gap-1 shrink-0">
                      <div className={cn("w-1.5 h-1.5 rounded-full", i === 0 ? "bg-emerald-500" : "bg-slate-300")} />
                      <span className="text-[7px] text-slate-400 font-medium">
                        {new Date(m.log_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }).slice(0, 6)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <PrivateProgressPhotoGallery photos={photos} />
          </div>
        )}
      </motion.div>
      )}

      {activeView === "overview" && (
      <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="client-card client-card--coral bg-white rounded-[24px] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-slate-400" />
            <h2 className="text-[15px] font-extrabold text-slate-950">Goals</h2>
            {proposals.filter(p => p.status === "accepted").length > 0 && (
              <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                {proposals.filter(p => p.status === "accepted").length} active
              </span>
            )}
          </div>
          <button onClick={() => setGoalModalOpen(true)} className="flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 active:scale-95 transition-all">
            <Plus className="w-3 h-3" /> Propose Goal
          </button>
        </div>
        {proposals.length === 0 ? <p className="text-[12px] text-slate-400 py-2">No goals proposed yet. Set a target for this client to track their progress.</p> : (
          <div className="space-y-3">
            {proposals.map((p) => {
              const statusColors: Record<string, string> = { proposed: "bg-amber-50 text-amber-700 border-amber-200", accepted: "bg-blue-50 text-blue-700 border-blue-200", rejected: "bg-red-50 text-red-700 border-red-200", completed: "bg-emerald-50 text-emerald-700 border-emerald-200" };
              const goalTypeIcons: Record<string, string> = { weight_target: "⚖️", calorie_target: "🔥", macro_target: "🎯", meal_adherence: "🥗", workout_frequency: "💪", streak_target: "🔥" };
              const targetNum = parseFloat(p.target_value) || 0;
              const currentNum = parseFloat(p.current_value || "0") || 0;
              const progressPct = targetNum > 0 ? Math.min(100, Math.round((currentNum / targetNum) * 100)) : 0;
              const deadlineDate = p.deadline ? new Date(p.deadline) : null;
              const daysRemaining = deadlineDate ? Math.max(0, Math.ceil((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;
              const isNearDeadline = daysRemaining !== null && daysRemaining <= 3 && p.status === "accepted";
              const progressColor = p.status === "completed" ? "bg-emerald-500" : progressPct >= 70 ? "bg-emerald-500" : progressPct >= 40 ? "bg-amber-400" : "bg-red-400";

              return (
                <div key={p.id} className={`p-3 rounded-2xl border ${p.status === "completed" ? "bg-emerald-50 border-emerald-200" : p.status === "rejected" ? "bg-slate-50 border-slate-200 opacity-60" : "bg-slate-50 border-slate-200"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[14px]">{goalTypeIcons[p.goal_type] ?? "🎯"}</span>
                      <span className="text-[13px] font-semibold text-slate-800 capitalize">{p.goal_type.replace(/_/g, " ")}</span>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusColors[p.status]}`}>{p.status}</span>
                  </div>

                  {(p.status === "accepted" || p.status === "completed") && targetNum > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold text-slate-600">{currentNum} / {p.target_value}</span>
                        <span className={`font-bold ${progressPct >= 70 ? "text-emerald-600" : progressPct >= 40 ? "text-amber-600" : "text-red-500"}`}>{progressPct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${progressColor}`} style={{ width: `${progressPct}%` }} />
                      </div>
                    </div>
                  )}

                  {p.status === "proposed" && (
                    <p className="text-[12px] text-slate-500 mt-1">Awaiting client response</p>
                  )}

                  <div className="flex items-center gap-2 mt-2">
                    {p.deadline && (
                      <span className={`text-[10px] font-semibold ${isNearDeadline ? "text-red-500" : "text-slate-400"}`}>
                        {deadlineDate!.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        {daysRemaining !== null && ` · ${daysRemaining}d left`}
                      </span>
                    )}
                    {p.notes && <span className="text-[10px] text-slate-400 truncate flex-1">· {p.notes}</span>}
                  </div>

                  {p.status === "accepted" && (
                    <button onClick={() => completeGoal(p.id)} className="mt-2 h-8 w-full rounded-lg bg-emerald-600 text-[11px] font-semibold text-white hover:bg-emerald-700 active:scale-95 transition-all">✓ Mark Complete</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
      )}

      {activeView === "plans" && clientId && (
        <CoachPerformanceDirectivePanel clientId={clientId} />
      )}

      {/* Program Builder Section */}
      {activeView === "plans" && (
      <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="client-card client-card--teal bg-white rounded-[24px] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-slate-400" />
            <h2 className="text-[15px] font-extrabold text-slate-950">Programs</h2>
          </div>
        </div>

        <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl mb-4">
          <button onClick={() => setProgramTab("meal")} className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-bold transition-all", programTab === "meal" ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20" : "text-slate-500")}>
            <UtensilsCrossed className="w-3.5 h-3.5" /> Meal Plans
          </button>
          <button onClick={() => setProgramTab("workout")} className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-bold transition-all", programTab === "workout" ? "bg-purple-600 text-white shadow-md shadow-purple-600/20" : "text-slate-500")}>
            <Dumbbell className="w-3.5 h-3.5" /> Workouts
          </button>
        </div>

        <button
          onClick={() => programTab === "meal" ? setMealBuilderOpen(true) : openWorkoutBuilder()}
          className={cn("w-full h-[48px] rounded-2xl text-[13px] font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2 border-2 border-dashed", programTab === "meal" ? "border-emerald-300 text-emerald-600 bg-emerald-50/50 hover:bg-emerald-50" : "border-purple-300 text-purple-600 bg-purple-50/50 hover:bg-purple-50")}
        >
          <Plus className="w-4 h-4" />
          {programTab === "meal" ? "Create Meal Plan" : "Create Workout Plan"}
        </button>

        {programs.filter((p) => p.type === (programTab === "meal" ? "meal_plan" : "workout_plan")).length === 0 ? (
          <div className="py-8 text-center">
            <div className={cn("w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center", programTab === "meal" ? "bg-emerald-50" : "bg-purple-50")}>
              {programTab === "meal" ? <UtensilsCrossed className="w-7 h-7 text-emerald-400" /> : <Dumbbell className="w-7 h-7 text-purple-400" />}
            </div>
            <p className="text-[13px] font-semibold text-slate-700">No {programTab === "meal" ? "meal" : "workout"} plans yet</p>
            <p className="text-[11px] text-slate-400 mt-1">Create one to start coaching this client</p>
          </div>
        ) : programs.filter((p) => p.type === (programTab === "meal" ? "meal_plan" : "workout_plan")).map((p) => {
          const pMeals = programMeals.filter((m) => m.program_id === p.id);
          const pExercises = programExercises.filter((e) => e.program_id === p.id);
          const isExpanded = expandedProgramId === p.id;
          const isMeal = p.type === "meal_plan";
          const completedItems = isMeal
            ? pMeals.filter((m) => (getMealStat(m.id)?.completion_count ?? 0) > 0).length
            : pExercises.filter((e) => (getExerciseStat(e.id)?.completion_count ?? 0) > 0).length;
          const totalItems = isMeal ? pMeals.length : pExercises.length;
          const completionPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
          const progressColor = completionPct >= 80 ? "bg-emerald-500" : completionPct >= 50 ? "bg-amber-400" : completionPct > 0 ? "bg-red-400" : isMeal ? "bg-emerald-500" : "bg-purple-500";
          return (
            <motion.div
              key={p.id}
              layout
              className={cn("mt-3 rounded-2xl transition-all", isMeal ? "bg-emerald-50/60 ring-1 ring-emerald-100" : "bg-purple-50/60 ring-1 ring-purple-100", isExpanded && "ring-2")}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => setExpandedProgramId(isExpanded ? null : p.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpandedProgramId(isExpanded ? null : p.id); } }}
                className="w-full p-3.5 flex items-center gap-3 text-left cursor-pointer"
              >
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", isMeal ? "bg-emerald-100" : "bg-purple-100")}>
                  {isMeal ? <UtensilsCrossed className="w-5 h-5 text-emerald-600" /> : <Dumbbell className="w-5 h-5 text-purple-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  {editingProgramId === p.id ? (
                    <div className="space-y-2 py-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editingProgramTitle}
                        onChange={(e) => setEditingProgramTitle(e.target.value)}
                        className="w-full h-[34px] px-3 rounded-lg bg-white border border-slate-200 text-[13px] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={editingProgramStartDate}
                          onChange={(e) => setEditingProgramStartDate(e.target.value)}
                          className="flex-1 h-[30px] px-2 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                        <input
                          type="date"
                          value={editingProgramEndDate}
                          onChange={(e) => setEditingProgramEndDate(e.target.value)}
                          className="flex-1 h-[30px] px-2 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            await updateProgram(p.id, { title: editingProgramTitle, start_date: editingProgramStartDate, end_date: editingProgramEndDate });
                            setEditingProgramId(null);
                          }}
                          className="flex-1 h-[30px] rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition-all"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setEditingProgramId(null); }}
                          className="flex-1 h-[30px] rounded-lg bg-slate-100 text-slate-500 text-[11px] font-bold hover:bg-slate-200 transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-[13px] font-bold text-slate-800 truncate">{p.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-500">
                          {new Date(p.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {new Date(p.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", p.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600")}>{p.status}</span>
                        {!isMeal && new Date(p.end_date) < new Date() && completionPct < 100 && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 flex items-center gap-0.5">
                            <AlertCircle className="w-2.5 h-2.5" /> expired
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className={cn("flex items-center gap-1 text-[10px] font-bold", isMeal ? "text-emerald-600" : "text-purple-600")}>
                    {isMeal ? <>{pMeals.length} meals</> : <>{pExercises.length} exercises</>}
                  </div>
                  <div className="w-16 h-1.5 rounded-full bg-white/80 overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", progressColor)} style={{ width: `${completionPct || Math.min(100, ((isMeal ? new Set(pMeals.map((m) => m.assigned_date)).size : new Set(pExercises.map((e) => e.day_number)).size) / Math.max(1, Math.ceil((new Date(p.end_date).getTime() - new Date(p.start_date).getTime()) / 86400000) + 1)) * 100)}%` }} />
                  </div>
                  {completionPct > 0 && (
                    <span className={cn("text-[9px] font-bold", completionPct >= 80 ? "text-emerald-600" : completionPct >= 50 ? "text-amber-600" : "text-red-500")}>{completionPct}%</span>
                  )}
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (editingProgramId === p.id) {
                      setEditingProgramId(null);
                    } else {
                      setEditingProgramId(p.id);
                      setEditingProgramTitle(p.title);
                      setEditingProgramStartDate(p.start_date);
                      setEditingProgramEndDate(p.end_date);
                    }
                  }}
                  className={cn("flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg px-2.5 text-[10px] font-bold transition-all", editingProgramId === p.id ? "bg-emerald-100 text-emerald-600" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50")}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
              </div>

              {isExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="px-3.5 pb-3.5">
                  {isMeal ? (
                    <div className="space-y-1.5">
                      {["breakfast", "lunch", "dinner", "snack"].map((type) => {
                        const typeMeals = pMeals.filter((m) => m.meal_type === type);
                        const typeIcon = type === "breakfast" ? Sun : type === "lunch" ? UtensilsCrossed : type === "dinner" ? Moon : Cookie;
                        const TypeIcon = typeIcon;
                        return (
                          <div key={type} className="bg-white/80 rounded-xl p-2.5">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <TypeIcon className="w-3 h-3 text-emerald-500" />
                              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{type}</span>
                              <span className="text-[9px] text-slate-400 ml-auto">{typeMeals.length} assigned</span>
                            </div>
                            {typeMeals.length === 0 ? (
                              <p className="text-[10px] text-slate-400 italic pl-1">No {type} assigned</p>
                            ) : (
                              <div className="space-y-1">
                                {typeMeals.map((pm) => {
                                  const mStat = getMealStat(pm.id);
                                  const mCompleted = mStat?.completion_count ?? 0;
                                  const mColor = mCompleted >= 3 ? "text-emerald-600 bg-emerald-50" : mCompleted >= 1 ? "text-amber-600 bg-amber-50" : "text-slate-400 bg-slate-50";
                                  return (
                                  <div key={pm.id} className="flex items-center gap-2 bg-emerald-50/50 rounded-lg px-2 py-1.5">
                                    <span className="text-[10px] text-emerald-500 font-bold w-12 shrink-0">{pm.assigned_date.slice(5)}</span>
                                    <span className="text-[11px] text-slate-700 flex-1 truncate">{mealInfos.find((m) => m.id === pm.meal_id)?.name || "Meal"}</span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${mColor}`}>
                                      {mCompleted}×
                                    </span>
                                    <button
                                      onClick={() => {
                                        setMealBuilderOpen(true);
                                        setMealPlanProgramId(p.id);
                                        setMealPlanStep("assign");
                                        setMealPlanTitle(p.title);
                                        setMealPlanStartDate(p.start_date);
                                        setMealPlanEndDate(p.end_date);
                                        setSelectedMealDate(pm.assigned_date);
                                        setSelectedMealType(pm.meal_type);
                                        (supabase as any).from("public_meal_catalog").select("id, name, calories, protein_g, carbs_g, fat_g, image_url, price, is_available, restaurant_name").eq("is_available", true).order("name").limit(200).then(({ data: meals }: { data: any[] | null }) => {
                                          setAvailableMeals((meals || []).map((m: any) => ({ id: m.id, name: m.name, calories: m.calories, protein_g: m.protein_g, carbs_g: m.carbs_g, fat_g: m.fat_g, image_url: m.image_url, price: m.price, restaurant_name: m.restaurant_name })));
                                        });
                                      }}
                                      className="text-slate-300 hover:text-emerald-500 transition-colors shrink-0"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => removeMeal(pm.id)} className="text-slate-300 hover:text-red-500 transition-colors shrink-0"><Trash2 className="w-3 h-3" /></button>
                                  </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2 pb-1">
                        <button
                          type="button"
                          onClick={() => openWorkoutBuilder(p, pExercises[0]?.day_number || 1)}
                          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white text-[11px] font-bold text-[#41506A] ring-1 ring-[#DDE5EF] transition active:scale-[0.98]"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Manage plan
                        </button>
                        <button
                          type="button"
                          onClick={() => openWorkoutBuilder(p, 1)}
                          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#E9FBF7] text-[11px] font-bold text-[#087B67] ring-1 ring-[#BCECDF] transition active:scale-[0.98]"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add exercise
                        </button>
                      </div>
                      {Object.entries(
                        pExercises.reduce<Record<number, typeof pExercises>>((acc, ex) => {
                          if (!acc[ex.day_number]) acc[ex.day_number] = [];
                          acc[ex.day_number].push(ex);
                          return acc;
                        }, {})
                      ).sort(([a], [b]) => Number(a) - Number(b)).map(([day, exercises]) => (
                        <div key={day} className="bg-white/80 rounded-xl p-2.5">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <div className="w-5 h-5 rounded-md bg-purple-100 flex items-center justify-center">
                              <span className="text-[9px] font-black text-purple-600">{day}</span>
                            </div>
                            <span className="text-[10px] font-bold text-slate-600">Day {day}</span>
                            <span className="text-[9px] text-slate-400 ml-auto">{exercises.length} exercises</span>
                          </div>
                          <div className="space-y-1">
                            {exercises.map((ex, i) => {
                              const stat = getExerciseStat(ex.id);
                              const completed = stat?.completion_count ?? 0;
                              const completionColor = completed >= 3 ? "text-emerald-600 bg-emerald-50" : completed >= 1 ? "text-amber-600 bg-amber-50" : "text-slate-400 bg-slate-50";
                              const weightHist = getExerciseWeightHistory(ex.exercise_name, 5);
                              const trend = getExerciseTrend(ex.exercise_name);
                              const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
                              const trendColor = trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-500" : "text-slate-400";
                              const catalogExercise = ex.exercise_catalog_id ? exerciseCatalogById.get(ex.exercise_catalog_id) : undefined;
                              return (
                              <div key={ex.id} className="bg-purple-50/50 rounded-lg px-2 py-1.5">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={!catalogExercise}
                                    onClick={() => {
                                      if (!catalogExercise) return;
                                      setExercisePreviewId(catalogExercise.id);
                                      setExercisePreviewOpen(true);
                                    }}
                                    className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-[#DDE5EF] disabled:cursor-default"
                                    aria-label={catalogExercise ? `Preview ${ex.exercise_name}` : undefined}
                                  >
                                    {catalogExercise ? (
                                      <ExerciseMedia exercise={catalogExercise} alt="" loading="lazy" className="h-full w-full object-contain p-1" />
                                    ) : (
                                      <Dumbbell className="m-auto h-full w-5 text-purple-400" />
                                    )}
                                    <span className="absolute left-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#07152F] px-1 text-[8px] font-black text-white">{i + 1}</span>
                                  </button>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-[11px] font-bold text-slate-700">{ex.exercise_name}</p>
                                    <p className="mt-1 text-[9px] font-semibold text-slate-500">{ex.sets} sets · {ex.reps} reps · {ex.rest_seconds ?? 60}s rest</p>
                                    <span className={`mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold ${completionColor}`}>
                                      {completed}x done
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => {
                                      openWorkoutBuilder(p, ex.day_number);
                                      setEditingExerciseId(ex.id);
                                      setSelectedExerciseId(ex.exercise_catalog_id);
                                      setSelectedCatalogExercise(catalogExercise ?? null);
                                      setExerciseName(ex.exercise_name);
                                      setExerciseSets(ex.sets);
                                      setExerciseReps(ex.reps);
                                      setExerciseRest(ex.rest_seconds ?? 60);
                                      setExerciseNotes(ex.notes ?? "");
                                    }}
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-400 ring-1 ring-slate-200 transition-colors hover:text-purple-500"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => removeExercise(ex.id)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-400 ring-1 ring-red-100 transition-colors hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                                {weightHist.length > 0 && (
                                  <div className="flex items-center gap-1.5 mt-1 pl-5">
                                    <TrendIcon className={cn("w-3 h-3", trendColor)} />
                                    <div className="flex gap-1 flex-1 overflow-hidden">
                                      {weightHist.slice().reverse().map((w, wi) => (
                                        <span key={wi} className="text-[8px] font-mono text-slate-400 bg-white/60 px-1 py-0.5 rounded">
                                          {w.weight_kg ?? 0}kg
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </motion.div>
      )}

      {/* Workout Adherence Card */}
      {activeView === "progress" && (
        <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="client-card client-card--violet bg-white rounded-[24px] p-5 mt-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-500" />
              <h2 className="text-[15px] font-extrabold text-slate-950">Workout Adherence</h2>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={cn("text-[11px] font-bold", overallWeeklyPct >= 70 ? "text-emerald-600" : overallWeeklyPct >= 40 ? "text-amber-600" : "text-red-500")}>{overallWeeklyPct}% this week</span>
            </div>
          </div>

          {workoutAlerts.length > 0 && (
            <div className="space-y-1.5 mb-4">
              {workoutAlerts.map((alert, i) => (
                <div key={i} className={cn("flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold", alert.severity === "error" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700")}>
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {alert.message}
                </div>
              ))}
            </div>
          )}

          {trainingEnhancementsEnabled && workoutExerciseEvents.length > 0 && (
            <div dir={isRTL ? "rtl" : "ltr"} className="mb-4 space-y-2 rounded-xl bg-[#F6F8FB] p-3 ring-1 ring-slate-200">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{trainingCopy.sessionChanges}</p>
              {workoutExerciseEvents.slice(0, 4).map((event) => (
                <div key={event.id} className="flex items-start gap-2 rounded-lg bg-white px-2.5 py-2 ring-1 ring-slate-100">
                  <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-black", event.event_type === "skipped" ? "bg-[#FFF0F2] text-[#FB6B7A]" : "bg-[#F3F1FF] text-[#7C83F6]")}>{event.event_type === "skipped" ? "S" : "R"}</span>
                  <div className="min-w-0"><p className="truncate text-[10px] font-extrabold text-slate-800">{event.original_exercise_name}{event.replacement_exercise_name ? ` → ${event.replacement_exercise_name}` : ""}</p>{event.reason && <p className="mt-0.5 line-clamp-2 text-[9px] font-medium text-slate-500">{event.reason}</p>}</div>
                </div>
              ))}
            </div>
          )}

          {trainingEnhancementsEnabled && targetAdherencePct != null && (
            <div dir={isRTL ? "rtl" : "ltr"} className="mb-4 flex items-center justify-between rounded-xl bg-[#F6F8FB] px-3 py-2.5 ring-1 ring-slate-200">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{trainingCopy.prescriptionAccuracy}</p>
                <p className="mt-0.5 text-[10px] font-semibold text-slate-500">{trainingCopy.basedOnSets(targetSetCount)}</p>
              </div>
              <span className={cn("text-[18px] font-black", targetAdherencePct >= 80 ? "text-[#22C7A1]" : targetAdherencePct >= 60 ? "text-amber-500" : "text-[#FB6B7A]")}>{targetAdherencePct}%</span>
            </div>
          )}

          {trainingEnhancementsEnabled && workoutAnalytics.completedSets > 0 && (
            <div dir={isRTL ? "rtl" : "ltr"} className="mb-4 grid grid-cols-2 gap-2">
              {[
                [workoutAnalytics.totalVolumeKg.toLocaleString(isRTL ? "ar-QA" : "en-US"), trainingCopy.volumeKg, "text-[#22C7A1]"],
                [workoutAnalytics.averageRpe ?? "--", trainingCopy.averageRpe, "text-[#FB6B7A]"],
                [workoutAnalytics.estimatedOneRepMaxKg ?? "--", trainingCopy.bestOneRepMax, "text-[#7C83F6]"],
                [workoutAnalytics.restAdherencePct != null ? `${workoutAnalytics.restAdherencePct}%` : "--", trainingCopy.restAccuracy, "text-[#38BDF8]"],
              ].map(([value, label, color]) => (
                <div key={String(label)} className="rounded-xl bg-[#F6F8FB] px-3 py-2.5 ring-1 ring-slate-200">
                  <p className={cn("text-[17px] font-black", String(color))}>{value}</p>
                  <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          )}

          {trainingEnhancementsEnabled && weeklyMuscleVolume.length > 0 && (
            <div dir={isRTL ? "rtl" : "ltr"} className="mb-4 rounded-[20px] bg-white p-3 ring-1 ring-[#E5EAF1]">
              <div className="mb-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#7C83F6]">{trainingCopy.muscleMap}</p>
                <p className="mt-1 text-[10px] font-semibold text-[#94A3B8]">{trainingCopy.muscleMapDescription}</p>
              </div>
              <MuscleLoadMap volumes={weeklyMuscleVolume} compact />
            </div>
          )}

          {adherenceLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
            </div>
          ) : weekAdherence.every((d) => d.sessionsCompleted === 0) ? (
            <div className="py-6 text-center">
              <Dumbbell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-[12px] text-slate-400 font-medium">No workout sessions recorded yet</p>
              <p className="text-[10px] text-slate-300 mt-1">Sessions will appear once the client starts a guided workout</p>
            </div>
          ) : (
            <>
              <div className="flex items-end gap-1.5 h-28 mb-2">
                {weekAdherence.map((day) => {
                  const hasActivity = day.sessionsCompleted > 0;
                  const barHeight = hasActivity ? Math.max(20, Math.min(100, (day.exercisesCompleted / Math.max(day.totalExercises, 1)) * 100)) : 8;
                  const isToday = day.date === new Date().toISOString().split("T")[0];
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                      <div className="relative w-full flex items-end justify-center" style={{ height: "80px" }}>
                        <div
                          className={cn("w-full max-w-[28px] rounded-lg transition-all", hasActivity ? (isToday ? "bg-purple-500" : "bg-purple-300") : "bg-slate-100")}
                          style={{ height: `${barHeight}%` }}
                        />
                      </div>
                      <span className={cn("text-[9px] font-bold", isToday ? "text-purple-600" : "text-slate-400")}>{day.dayLabel}</span>
                      {hasActivity && <span className="text-[8px] text-slate-400">{day.exercisesCompleted}ex</span>}
                    </div>
                  );
                })}
              </div>

              {(() => {
                const workoutExercises = programExercises.length > 0
                  ? [...new Set(programExercises.map((e) => e.exercise_name))]
                  : [];
                if (workoutExercises.length === 0) return null;
                return (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Progressive Overload</p>
                    <div className="space-y-1.5">
                      {workoutExercises.slice(0, 6).map((exName) => {
                        const history = getExerciseWeightHistory(exName, 3);
                        const trend = getExerciseTrend(exName);
                        const latestWeight = history.length > 0 ? history[0].weight_kg : null;
                        const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
                        const trendColor = trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-500" : "text-slate-400";
                        return (
                          <div key={exName} className="flex items-center gap-2 px-2.5 py-2 bg-slate-50 rounded-xl">
                            <Dumbbell className="w-3 h-3 text-purple-400 shrink-0" />
                            <span className="text-[11px] font-semibold text-slate-700 flex-1 truncate">{exName}</span>
                            {latestWeight !== null && (
                              <span className="text-[11px] font-mono text-slate-500">{latestWeight}kg</span>
                            )}
                            <TrendIcon className={cn("w-3.5 h-3.5", trendColor)} />
                            {history.length > 1 && (
                              <span className="text-[9px] text-slate-400">{history.length} sessions</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </motion.div>
      )}

      {/* Edit Targets Modal */}
      <EditClientTargetsModal
        clientId={clientId || ""}
        clientName={profile?.full_name || "Client"}
        currentCalories={profile?.daily_calorie_target || null}
        currentProtein={profile?.protein_target_g || null}
        currentCarbs={profile?.carbs_target_g || null}
        currentFat={profile?.fat_target_g || null}
        open={targetsModalOpen}
        onClose={() => setTargetsModalOpen(false)}
        onSaved={() => fetchClientData()}
      />

      {/* Meal Plan Builder Modal */}
      {mealBuilderOpen && (
        <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-slate-900/35 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-md bg-white rounded-t-[28px] sm:rounded-[28px] shadow-2xl max-h-[92dvh] sm:max-h-[85vh] flex flex-col pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div>
                <h2 className="text-[17px] font-extrabold text-slate-950">
                  {mealPlanStep === "create" ? "New Meal Plan" : mealPlanTitle}
                </h2>
                <p className="text-[11px] text-slate-400">
                  {mealPlanStep === "create" ? "Set up your client's nutrition program" : <>{programMeals.filter((m) => m.program_id === mealPlanProgramId).length} meals assigned {clientSub && !clientSub.isUnlimited && <span className="text-amber-500 font-bold">· {Math.max(0, clientSub.remainingMeals - programMeals.length)} of {clientSub.totalMeals} remaining</span>}</>}
                </p>
              </div>
              <button aria-label="Close meal plan builder" onClick={() => { setMealBuilderOpen(false); setMealPlanStep("create"); setMealPlanProgramId(null); setMealSearch(""); }} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"><X className="w-4 h-4 text-slate-500" /></button>
            </div>

            {mealPlanStep === "create" ? (
              <div className="px-5 pb-5 space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Plan Name</label>
                  <input type="text" value={mealPlanTitle} onChange={(e) => setMealPlanTitle(e.target.value)} placeholder="e.g. 2-Week Weight Loss" className="w-full h-[48px] px-5 rounded-2xl bg-slate-50 border border-slate-200 text-[14px] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Start</label>
                    <input type="date" value={mealPlanStartDate} onChange={(e) => setMealPlanStartDate(e.target.value)} className="w-full h-[48px] px-4 rounded-2xl bg-slate-50 border border-slate-200 text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">End</label>
                    <input type="date" value={mealPlanEndDate} onChange={(e) => setMealPlanEndDate(e.target.value)} className="w-full h-[48px] px-4 rounded-2xl bg-slate-50 border border-slate-200 text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all" />
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (!mealPlanTitle.trim() || !mealPlanStartDate || !mealPlanEndDate) return;
                    setCreatingProgram(true);
                    const result = await createProgram({ title: mealPlanTitle.trim(), type: "meal_plan", start_date: mealPlanStartDate, end_date: mealPlanEndDate });
                    if (result.success && result.data) {
                      setMealPlanProgramId(result.data.id);
                      const { data: meals } = await (supabase as any).from("public_meal_catalog").select("id, name, calories, protein_g, carbs_g, fat_g, image_url, price, is_available, restaurant_name").eq("is_available", true).order("name").limit(200);
                      setAvailableMeals((meals as any[] || []).map((m: any) => ({ id: m.id, name: m.name, calories: m.calories, protein_g: m.protein_g, carbs_g: m.carbs_g, fat_g: m.fat_g, image_url: m.image_url, price: m.price, restaurant_name: m.restaurant_name })));
                      setMealPlanStep("assign");
                    } else if (!result.success && result.error) {
                      toast.error(result.error.message);
                    }
                    setCreatingProgram(false);
                  }}
                  disabled={!mealPlanTitle.trim() || !mealPlanStartDate || !mealPlanEndDate || creatingProgram}
                  className="w-full h-[52px] rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[14px] font-bold shadow-lg shadow-emerald-600/20 disabled:opacity-40 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {creatingProgram ? <Loader2 className="w-5 h-5 animate-spin" /> : <><UtensilsCrossed className="w-4 h-4" /> Browse Meal Catalog</>}
                </button>
              </div>
            ) : (
              <>
                {(() => {
                  const currentMeals = programMeals.filter((m) => m.program_id === mealPlanProgramId);
                  const totals = currentMeals.reduce((acc, pm) => {
                    const m = availableMeals.find((x) => x.id === pm.meal_id);
                    return { cal: acc.cal + (m?.calories || 0), p: acc.p + (m?.protein_g || 0), c: acc.c + (m?.carbs_g || 0), f: acc.f + (m?.fat_g || 0) };
                  }, { cal: 0, p: 0, c: 0, f: 0 });
                  const [sy, sm, sd] = mealPlanStartDate.split("-").map(Number);
                  const [ey, em, ed] = mealPlanEndDate.split("-").map(Number);
                  const pStart = new Date(sy, sm - 1, sd);
                  const pEnd = new Date(ey, em - 1, ed);
                  const planDates: string[] = [];
                  for (let i = 0; i < 14; i++) {
                    const d = new Date(pStart);
                    d.setDate(d.getDate() + i);
                    if (d > pEnd) break;
                    planDates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
                  }
                  const activeDate = selectedMealDate || planDates[0] || "";

                  const mealTypes = [
                    { key: "breakfast" as const, label: "Breakfast", icon: Sun, accent: "amber" as const },
                    { key: "lunch" as const, label: "Lunch", icon: UtensilsCrossed, accent: "emerald" as const },
                    { key: "dinner" as const, label: "Dinner", icon: Moon, accent: "indigo" as const },
                    { key: "snack" as const, label: "Snack", icon: Cookie, accent: "pink" as const },
                  ];

                  const accentClasses: Record<string, { bg: string; border: string; text: string; iconBg: string; iconText: string; ring: string }> = {
                    amber: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", iconBg: "bg-amber-100", iconText: "text-amber-600", ring: "ring-amber-200" },
                    emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", iconBg: "bg-emerald-100", iconText: "text-emerald-600", ring: "ring-emerald-200" },
                    indigo: { bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-700", iconBg: "bg-indigo-100", iconText: "text-indigo-600", ring: "ring-indigo-200" },
                    pink: { bg: "bg-pink-50", border: "border-pink-200", text: "text-pink-700", iconBg: "bg-pink-100", iconText: "text-pink-600", ring: "ring-pink-200" },
                  };

                  return (
                    <>
                      <div className="px-5 pb-2">
                        {clientSub && !clientSub.isUnlimited && programMeals.length >= clientSub.remainingMeals && (
                          <div className="mb-2 p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[11px] font-bold text-amber-700">Meal Limit Reached</p>
                              <p className="text-[10px] text-amber-600 mt-0.5">
                                This client has used all {clientSub.totalMeals} meals in their plan. Remove existing assignments before adding more.
                              </p>
                            </div>
                          </div>
                        )}
                        {clientSub && !clientSub.isUnlimited && programMeals.length >= clientSub.remainingMeals - 3 && programMeals.length < clientSub.remainingMeals && (
                          <div className="mb-2 p-2.5 rounded-2xl bg-amber-50/60 border border-amber-100 flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-amber-600">
                              {clientSub.remainingMeals - programMeals.length} of {clientSub.remainingMeals} meals remaining
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-[36px] rounded-xl bg-emerald-50 flex items-center justify-center gap-1.5">
                            <Flame className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-[11px] font-bold text-emerald-700">{totals.cal} kcal</span>
                          </div>
                          <div className="h-[36px] px-2.5 rounded-xl bg-blue-50 flex items-center gap-1">
                            <span className="text-[10px] font-bold text-blue-600">P {totals.p}g</span>
                          </div>
                          <div className="h-[36px] px-2.5 rounded-xl bg-amber-50 flex items-center gap-1">
                            <span className="text-[10px] font-bold text-amber-600">C {totals.c}g</span>
                          </div>
                          <div className="h-[36px] px-2.5 rounded-xl bg-rose-50 flex items-center gap-1">
                            <span className="text-[10px] font-bold text-rose-600">F {totals.f}g</span>
                          </div>
                          <div className="h-[36px] px-3 rounded-xl bg-slate-50 flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-slate-500">{currentMeals.length} total</span>
                          </div>
                        </div>
                      </div>

                      <div className="px-5 pb-3">
                        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                          {planDates.map((date) => {
                            const dayLabel = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
                            const dayMeals = currentMeals.filter((pm) => pm.assigned_date === date);
                            const isActive = date === activeDate;
                            return (
                              <button
                                key={date}
                                onClick={() => { setSelectedMealDate(date); setAssigningSlot(null); setMealSearch(""); }}
                                className={cn(
                                  "flex flex-col items-center px-3 py-2 rounded-2xl shrink-0 transition-all active:scale-95 relative",
                                  isActive ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                                )}
                              >
                                <span className="text-[9px] font-bold uppercase">{dayLabel.split(" ")[0]}</span>
                                <span className="text-[13px] font-bold">{dayLabel.split(" ")[1]}</span>
                                {dayMeals.length > 0 && (
                                  <div className={cn("w-1.5 h-1.5 rounded-full mt-1", isActive ? "bg-white" : "bg-emerald-400")} />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2">
                        {mealTypes.map((mt) => {
                          const ac = accentClasses[mt.accent];
                          const assigned = programMeals.find((pm) => pm.program_id === mealPlanProgramId && pm.assigned_date === activeDate && pm.meal_type === mt.key);
                          const mealInfo = assigned ? availableMeals.find((m) => m.id === assigned.meal_id) : null;
                          const isPickerOpen = assigningSlot?.date === activeDate && assigningSlot?.type === mt.key;
                          const MIcon = mt.icon;

                          return (
                            <div key={mt.key} className="space-y-1.5">
                              <div className={cn("rounded-2xl p-3 transition-all", assigned ? `${ac.bg} ring-1 ${ac.ring}` : "bg-white border border-dashed border-slate-200")}>
                                <div className="flex items-center gap-3">
                                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", assigned ? ac.iconBg : "bg-slate-50")}>
                                    <MIcon className={cn("w-5 h-5", assigned ? ac.iconText : "text-slate-300")} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    {assigned && mealInfo ? (
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[13px] font-bold text-slate-800 truncate">{mealInfo.name}</p>
                                          <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] font-bold text-emerald-600">{mealInfo.calories} kcal</span>
                                            <span className="text-[9px] text-slate-400">P {mealInfo.protein_g}g</span>
                                            <span className="text-[9px] text-slate-400">C {mealInfo.carbs_g}g</span>
                                            <span className="text-[9px] text-slate-400">F {mealInfo.fat_g}g</span>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            onClick={() => { setAssigningSlot({ date: activeDate, type: mt.key }); setMealSearch(""); }}
                                            className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:border-emerald-300 transition-all"
                                          >
                                            <Pencil className="w-3 h-3" />
                                          </button>
                                          <button
                                            onClick={() => assigned && removeMeal(assigned.id)}
                                            className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-300 transition-all"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          if (clientSub && !clientSub.isUnlimited && programMeals.length >= clientSub.remainingMeals) {
                                            toast.error(`This client has reached their plan limit of ${clientSub.totalMeals} meals.`);
                                            return;
                                          }
                                          setAssigningSlot({ date: activeDate, type: mt.key }); setMealSearch("");
                                        }}
                                        className="w-full text-left"
                                      >
                                        <p className="text-[13px] font-semibold text-slate-800">{mt.label}</p>
                                        <p className="text-[11px] text-slate-400">
                                          {clientSub && !clientSub.isUnlimited && programMeals.length >= clientSub.remainingMeals ? "Plan limit reached" : "Tap to add a meal"}
                                        </p>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {isPickerOpen && (
                                <div className="bg-slate-50 rounded-2xl p-3 space-y-2">
                                  <div className="relative">
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                      type="text"
                                      value={mealSearch}
                                      onChange={(e) => setMealSearch(e.target.value)}
                                      placeholder={`Search ${mt.label.toLowerCase()} meals...`}
                                      className="w-full h-[40px] pl-10 pr-4 rounded-xl bg-white border border-slate-200 text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                      autoFocus
                                    />
                                  </div>
                                  <div className="max-h-[200px] overflow-y-auto space-y-1.5">
                                    {availableMeals.length === 0 ? (
                                      <div className="py-6 text-center">
                                        <UtensilsCrossed className="w-6 h-6 text-slate-200 mx-auto mb-2" />
                                        <p className="text-[11px] text-slate-400">No meals available</p>
                                      </div>
                                    ) : (
                                      availableMeals
                                        .filter((m) => !mealSearch || m.name.toLowerCase().includes(mealSearch.toLowerCase()))
                                        .map((m) => (
                                          <button
                                            key={m.id}
                                        onClick={async () => {
                                          if (!mealPlanProgramId) return;
                                          if (assigned) {
                                            await updateMeal(assigned.id, m.id);
                                          } else {
                                            if (clientSub && !clientSub.isUnlimited && programMeals.length >= clientSub.remainingMeals) {
                                              toast.error(`This client has reached their plan limit of ${clientSub.totalMeals} meals. Remove an existing assignment first.`);
                                              return;
                                            }
                                            await assignMeal(mealPlanProgramId, m.id, activeDate, mt.key);
                                          }
                                          setAssigningSlot(null);
                                          setMealSearch("");
                                        }}
                                            className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-white hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-all active:scale-[0.98] text-left"
                                          >
                                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center shrink-0 overflow-hidden">
                                              {m.image_url ? <img src={m.image_url} alt="" className="w-full h-full object-cover" /> : <UtensilsCrossed className="w-4 h-4 text-emerald-500" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <p className="text-[12px] font-semibold text-slate-800 truncate">{m.name}</p>
                                              <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="text-[9px] font-bold text-emerald-600">{m.calories} kcal</span>
                                                {m.restaurant_name && <span className="text-[8px] text-slate-400">{m.restaurant_name}</span>}
                                              </div>
                                            </div>
                                            <Plus className="w-4 h-4 text-slate-300 shrink-0" />
                                          </button>
                                        ))
                                    )}
                                  </div>
                                  <button
                                    onClick={() => { setAssigningSlot(null); setMealSearch(""); }}
                                    className="w-full h-[36px] rounded-xl bg-white border border-slate-200 text-[11px] font-semibold text-slate-500 hover:bg-slate-50 transition-all"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <button onClick={() => { setMealBuilderOpen(false); setMealPlanStep("create"); setMealPlanProgramId(null); setMealSearch(""); setAssigningSlot(null); setSelectedMealDate(""); }} className="w-full h-[48px] rounded-2xl bg-slate-100 text-slate-600 text-[13px] font-bold hover:bg-slate-200 active:scale-[0.98] transition-all mt-2 mx-5">
                        Done
                      </button>
                    </>
                  );
                })()}
              </>
            )}
          </motion.div>
        </div>
      )}

      {/* Workout Plan Builder Modal */}
      {workoutBuilderOpen && (
        <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-slate-900/35 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-md bg-white rounded-t-[28px] sm:rounded-[28px] shadow-2xl max-h-[92dvh] sm:max-h-[85vh] flex flex-col pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div>
                <h2 className="text-[17px] font-extrabold text-slate-950">
                  {workoutStep === "create" ? "New Workout Plan" : workoutPlanTitle}
                </h2>
                <p className="text-[11px] text-slate-400">
                  {workoutStep === "create" ? "Build a training program" : "Add exercises for each day"}
                </p>
              </div>
              <button aria-label="Close workout plan builder" onClick={() => { setWorkoutBuilderOpen(false); setWorkoutStep("create"); setWorkoutProgramId(null); resetExerciseForm(); }} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"><X className="w-4 h-4 text-slate-500" /></button>
            </div>

            {workoutStep === "create" ? (
              <div dir={isRTL ? "rtl" : "ltr"} className="px-5 pb-5 space-y-4">
                {trainingEnhancementsEnabled && workoutTemplates.length > 0 && (
                  <div className="rounded-2xl bg-[#F3F1FF] p-3 ring-1 ring-[#DCD8FF]">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#656BD8]">{trainingCopy.startFromTemplate}</label>
                    <div className="mt-2 flex gap-2">
                      <select value={selectedWorkoutTemplateId} onChange={(event) => setSelectedWorkoutTemplateId(event.target.value)} className="h-11 min-w-0 flex-1 rounded-xl border border-[#DCD8FF] bg-white px-3 text-[11px] font-bold text-slate-900">
                        <option value="">{trainingCopy.chooseTemplate}</option>
                        {workoutTemplates.map((template) => <option key={template.id} value={template.id}>{template.title} · {template.duration_weeks} {trainingCopy.weeks}</option>)}
                      </select>
                      <button type="button" disabled={!selectedWorkoutTemplateId || !workoutPlanStartDate || creatingProgram} onClick={async () => {
                        setCreatingProgram(true);
                        try {
                          const program = await createProgramFromTemplate(selectedWorkoutTemplateId, workoutPlanStartDate);
                          setWorkoutProgramId(program.id);
                          setWorkoutPlanTitle(program.title);
                          setWorkoutPlanEndDate(program.end_date);
                          setWorkoutStep("assign");
                        } catch (error) { toast.error(error instanceof Error ? error.message : trainingCopy.templateError); }
                        finally { setCreatingProgram(false); }
                      }} className="h-11 rounded-xl bg-[#7C83F6] px-4 text-[11px] font-extrabold text-white disabled:opacity-40">{trainingCopy.use}</button>
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Plan Name</label>
                  <input type="text" value={workoutPlanTitle} onChange={(e) => setWorkoutPlanTitle(e.target.value)} placeholder="e.g. 4-Week Strength" className="w-full h-[48px] px-5 rounded-2xl bg-slate-50 border border-slate-200 text-[14px] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Start</label>
                    <input type="date" value={workoutPlanStartDate} onChange={(e) => setWorkoutPlanStartDate(e.target.value)} className="w-full h-[48px] px-4 rounded-2xl bg-slate-50 border border-slate-200 text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">End</label>
                    <input type="date" value={workoutPlanEndDate} onChange={(e) => setWorkoutPlanEndDate(e.target.value)} className="w-full h-[48px] px-4 rounded-2xl bg-slate-50 border border-slate-200 text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all" />
                  </div>
                </div>
                {trainingEnhancementsEnabled && <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <label className="text-[9px] font-bold uppercase text-slate-400">{trainingCopy.schedule}
                    <select value={workoutScheduleMode} onChange={(event) => setWorkoutScheduleMode(event.target.value as "fixed" | "flexible")} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-[10px] font-bold normal-case text-slate-900"><option value="flexible">{trainingCopy.flexible}</option><option value="fixed">{trainingCopy.fixed}</option></select>
                  </label>
                  <label className="text-[9px] font-bold uppercase text-slate-400">{trainingCopy.daysPerWeek}
                    <input type="number" min={1} max={7} value={workoutDaysPerWeek} onChange={(event) => setWorkoutDaysPerWeek(Number(event.target.value))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white text-center text-[11px] font-bold text-slate-900" />
                  </label>
                  <label className="text-[9px] font-bold uppercase text-slate-400">{trainingCopy.phases}
                    <input type="number" min={1} max={12} value={workoutPhaseCount} onChange={(event) => setWorkoutPhaseCount(Number(event.target.value))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white text-center text-[11px] font-bold text-slate-900" />
                  </label>
                </div>}
                <button
                  onClick={async () => {
                    if (!workoutPlanTitle.trim() || !workoutPlanStartDate || !workoutPlanEndDate) return;
                    setCreatingProgram(true);
                    const result = await createProgram({
                      title: workoutPlanTitle.trim(),
                      type: "workout_plan",
                      start_date: workoutPlanStartDate,
                      end_date: workoutPlanEndDate,
                      ...(trainingEnhancementsEnabled ? {
                        schedule_mode: workoutScheduleMode,
                        days_per_week: workoutDaysPerWeek,
                        phase_count: workoutPhaseCount,
                      } : {}),
                    });
                    if (result.success && result.data) {
                      setWorkoutProgramId(result.data.id);
                      setWorkoutStep("assign");
                    } else if (!result.success && result.error) {
                      toast.error(result.error.message);
                    }
                    setCreatingProgram(false);
                  }}
                  disabled={!workoutPlanTitle.trim() || !workoutPlanStartDate || !workoutPlanEndDate || creatingProgram}
                  className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#07152F] text-[14px] font-bold text-white shadow-[0_12px_24px_rgba(7,21,47,0.18)] transition-all active:scale-[0.98] disabled:opacity-40"
                >
                  {creatingProgram ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Dumbbell className="w-4 h-4" /> Create Plan</>}
                </button>
              </div>
            ) : (
              <>
                <div className="px-5 pb-3">
                  <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                      const dayExercises = programExercises.filter((e) => e.program_id === workoutProgramId && e.day_number === d);
                      return (
                        <button
                          key={d}
                          onClick={() => setSelectedWorkoutDay(d)}
                          className={cn("flex-shrink-0 w-[52px] h-[52px] rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all", selectedWorkoutDay === d ? "bg-[#DDF8F1] text-[#087B67] ring-1 ring-[#A9E8D9]" : "bg-slate-100 text-slate-500")}
                        >
                          <span className="text-[9px] font-bold uppercase">Day</span>
                          <span className="text-[16px] font-extrabold leading-none">{d}</span>
                          {dayExercises.length > 0 && <div className={cn("w-1 h-1 rounded-full", selectedWorkoutDay === d ? "bg-[#0FBF9F]" : "bg-slate-400")} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 pb-5">
                  {(() => {
                    const dayExercises = programExercises
                      .filter((e) => e.program_id === workoutProgramId && e.day_number === selectedWorkoutDay)
                      .sort((a, b) => a.order_index - b.order_index);
                    const dayDefinition = programWorkoutDays.find((day) => day.program_id === workoutProgramId && day.day_number === selectedWorkoutDay);
                    return (
                      <div className="space-y-2.5">
                        {trainingEnhancementsEnabled && workoutProgramId && (
                          <div className="grid grid-cols-[1fr_92px] gap-2 rounded-2xl bg-[#F6F8FB] p-3 ring-1 ring-slate-200">
                            <label className="text-[9px] font-bold uppercase text-slate-400">{trainingCopy.dayPurpose}
                              <select value={dayDefinition?.day_type ?? "workout"} onChange={(event) => void upsertWorkoutDay(workoutProgramId, selectedWorkoutDay, { day_type: event.target.value as "workout" | "rest" | "recovery", title: event.target.value === "rest" ? trainingCopy.rest : event.target.value === "recovery" ? trainingCopy.recovery : `${trainingCopy.workout} ${selectedWorkoutDay}`, phase_number: dayDefinition?.phase_number ?? 1 })} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold normal-case text-slate-900"><option value="workout">{trainingCopy.workout}</option><option value="rest">{trainingCopy.rest}</option><option value="recovery">{trainingCopy.recovery}</option></select>
                            </label>
                            <label className="text-[9px] font-bold uppercase text-slate-400">{trainingCopy.phase}
                              <input type="number" min={1} max={workoutPhaseCount} value={dayDefinition?.phase_number ?? 1} onChange={(event) => void upsertWorkoutDay(workoutProgramId, selectedWorkoutDay, { day_type: dayDefinition?.day_type ?? "workout", title: dayDefinition?.title ?? `Training day ${selectedWorkoutDay}`, phase_number: Number(event.target.value) })} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white text-center text-[11px] font-bold text-slate-900" />
                            </label>
                          </div>
                        )}
                        {dayExercises.length === 0 && (
                          <div className="py-8 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 mx-auto mb-3 flex items-center justify-center">
                              <Dumbbell className="w-6 h-6 text-emerald-400" />
                            </div>
                            <p className="text-[12px] text-slate-400">No exercises for Day {selectedWorkoutDay}</p>
                            <p className="text-[10px] text-slate-300">Add one below</p>
                          </div>
                        )}
                        {dayExercises.map((ex, i) => {
                          const catalogExercise = ex.exercise_catalog_id
                            ? exerciseCatalogById.get(ex.exercise_catalog_id)
                            : undefined;

                          return (
                            <motion.article
                              key={ex.id}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={cn(
                                "grid grid-cols-[64px_minmax(0,1fr)] gap-3 rounded-2xl border bg-white p-3 shadow-[0_8px_22px_rgba(15,23,42,0.05)]",
                                editingExerciseId === ex.id ? "border-emerald-400 ring-2 ring-emerald-100" : "border-slate-200",
                              )}
                            >
                              <button
                                type="button"
                                disabled={!catalogExercise}
                                onClick={() => {
                                  if (!catalogExercise) return;
                                  setExercisePreviewId(catalogExercise.id);
                                  setExercisePreviewOpen(true);
                                }}
                                aria-label={catalogExercise ? `Preview ${ex.exercise_name}` : undefined}
                                className="relative h-16 w-16 overflow-hidden rounded-xl bg-emerald-50 disabled:cursor-default"
                              >
                                {catalogExercise ? (
                                  <ExerciseMedia exercise={catalogExercise} alt="" className="h-full w-full object-contain p-1" />
                                ) : (
                                  <span className="flex h-full w-full items-center justify-center text-emerald-600">
                                    <Dumbbell className="h-6 w-6" />
                                  </span>
                                )}
                                <span className="absolute left-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[9px] font-black text-slate-700 shadow-sm">
                                  {i + 1}
                                </span>
                              </button>

                              <div className="min-w-0">
                                <p className="truncate text-[13px] font-extrabold text-slate-900">{ex.exercise_name}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                  <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">{ex.sets} sets</span>
                                  <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">{ex.reps} reps</span>
                                  <span className="text-[10px] font-semibold text-slate-400">{ex.rest_seconds ?? 60}s rest</span>
                                  {trainingEnhancementsEnabled && ex.superset_group && (
                                    <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-extrabold text-violet-700">Superset {ex.superset_group}</span>
                                  )}
                                  {trainingEnhancementsEnabled && ex.set_type && ex.set_type !== "normal" && (
                                    <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-extrabold capitalize text-rose-600">{ex.set_type}</span>
                                  )}
                                </div>
                                {normalizeProgressionRule(ex.progression_rule).enabled && (
                                  <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-violet-50 px-2 py-1 text-[9px] font-bold text-violet-700">
                                    <Zap className="h-3 w-3" />
                                    <span className="truncate">{progressionRuleSummary(ex.progression_rule)}</span>
                                  </div>
                                )}
                                {ex.notes && <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500">{ex.notes}</p>}
                                <div className="mt-2 flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingExerciseId(ex.id);
                                      setSelectedExerciseId(ex.exercise_catalog_id);
                                      setSelectedCatalogExercise(catalogExercise ?? null);
                                      setExerciseName(ex.exercise_name);
                                      setExerciseSets(ex.sets);
                                      setExerciseReps(ex.reps);
                                      setExerciseRest(ex.rest_seconds ?? 60);
                                      setExerciseSetType(ex.set_type ?? "normal");
                                      setExerciseSupersetGroup(ex.superset_group ?? "");
                                      setExercisePrescriptionUnit(ex.prescription_unit ?? "reps");
                                      setExerciseWeightRounding(ex.weight_rounding_kg ?? 0.5);
                                      setExerciseNotes(ex.notes ?? "");
                                      const rule = normalizeProgressionRule(ex.progression_rule);
                                      setProgressionEnabled(rule.enabled);
                                      setProgressionStrategy(rule.strategy);
                                      setProgressionRepMin(rule.rep_min);
                                      setProgressionRepMax(rule.rep_max);
                                      setProgressionLoadIncrement(rule.load_increment_kg);
                                      setProgressionRepIncrement(rule.rep_increment);
                                      setProgressionSetIncrement(rule.set_increment);
                                      setProgressionMaxSets(rule.max_sets);
                                      setProgressionTargetRir(rule.target_rir);
                                      setProgressionRestDecrement(rule.rest_decrement_seconds);
                                      setProgressionMinRest(rule.min_rest_seconds);
                                      setProgressionRpeCeiling(rule.rpe_ceiling);
                                      setProgressionFailureLimit(rule.failure_sessions_before_deload);
                                      setProgressionDeloadPercent(rule.deload_percent);
                                    }}
                                    className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-100 text-[11px] font-bold text-slate-700 transition active:scale-[0.98]"
                                  >
                                    <Pencil className="h-3.5 w-3.5" /> Edit
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={`Remove ${ex.exercise_name}`}
                                    onClick={() => removeExercise(ex.id)}
                                    className="flex h-9 w-10 items-center justify-center rounded-xl bg-red-50 text-red-500 transition active:scale-[0.98]"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            </motion.article>
                          );
                        })}

                        <div className="mt-4 p-4 rounded-2xl bg-slate-50 ring-1 ring-slate-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{editingExerciseId ? "Edit Exercise" : "Add Exercise"}</p>
                            {editingExerciseId && (
                              <button
                                onClick={() => {
                                  resetExerciseForm();
                                }}
                                className="text-[10px] font-semibold text-slate-400 hover:text-slate-600"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setExerciseCatalogOpen(true)}
                            className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-[0_6px_18px_rgba(15,23,42,0.04)] ring-1 ring-slate-200 transition active:scale-[0.99]"
                          >
                            {selectedCatalogExercise ? (
                              <ExerciseMedia
                                exercise={selectedCatalogExercise}
                                alt=""
                                className="h-11 w-11 shrink-0 rounded-xl bg-emerald-50 object-contain p-1"
                              />
                            ) : (
                              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                                <Search className="h-5 w-5" />
                              </span>
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-emerald-600">
                                Exercise library
                              </span>
                              <span className="mt-1 block truncate text-[13px] font-bold text-slate-800">
                                {selectedCatalogExercise?.name
                                  ? formatExerciseLabel(selectedCatalogExercise.name)
                                  : selectedExerciseId
                                    ? exerciseName
                                    : `Choose from ${exerciseCatalog.length.toLocaleString("en-US")} exercises`}
                              </span>
                            </span>
                            <ChevronDown className="h-4 w-4 shrink-0 -rotate-90 text-slate-400" />
                          </button>
                          <div>
                            <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-400">Or use a custom name</label>
                            <input
                              type="text"
                              value={exerciseName}
                              onChange={(event) => {
                                setExerciseName(event.target.value);
                                if (selectedCatalogExercise && event.target.value !== formatExerciseLabel(selectedCatalogExercise.name)) {
                                  setSelectedExerciseId(null);
                                  setSelectedCatalogExercise(null);
                                }
                              }}
                              placeholder="Exercise name (e.g. Bench Press)"
                              className="h-[44px] w-full rounded-xl border border-slate-200 bg-white px-4 text-[13px] text-slate-900 placeholder:text-slate-300 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Sets</label>
                              <input type="number" min={1} value={exerciseSets} onChange={(e) => setExerciseSets(Number(e.target.value))} className="w-full h-[40px] px-3 rounded-xl bg-white border border-slate-200 text-[13px] text-slate-900 text-center font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/20" />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Reps</label>
                              <input type="text" value={exerciseReps} onChange={(e) => setExerciseReps(e.target.value)} className="w-full h-[40px] px-3 rounded-xl bg-white border border-slate-200 text-[13px] text-slate-900 text-center font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/20" />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Rest (s)</label>
                              <input type="number" min={0} step={15} value={exerciseRest} onChange={(e) => setExerciseRest(Number(e.target.value))} className="w-full h-[40px] px-3 rounded-xl bg-white border border-slate-200 text-[13px] text-slate-900 text-center font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/20" />
                            </div>
                          </div>
                          {trainingEnhancementsEnabled && <div dir={isRTL ? "rtl" : "ltr"} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <div>
                                <p className="text-[11px] font-extrabold text-slate-900">{trainingCopy.setStructure}</p>
                                <p className="text-[9px] font-semibold text-slate-500">{trainingCopy.setStructureDescription}</p>
                              </div>
                              <Dumbbell className="h-4 w-4 text-violet-600" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <label className="space-y-1 text-[9px] font-bold uppercase text-slate-400">
                                {trainingCopy.setType}
                                <select
                                  value={exerciseSetType}
                                  onChange={(event) => setExerciseSetType(event.target.value as WorkoutSetType)}
                                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case text-slate-900 outline-none focus:border-violet-400"
                                >
                                  <option value="normal">{trainingCopy.setTypes.normal}</option>
                                  <option value="dropset">{trainingCopy.setTypes.dropset}</option>
                                  <option value="myo">{trainingCopy.setTypes.myo}</option>
                                  <option value="partial">{trainingCopy.setTypes.partial}</option>
                                  <option value="forced">{trainingCopy.setTypes.forced}</option>
                                  <option value="tut">{trainingCopy.setTypes.tut}</option>
                                  <option value="isometric">{trainingCopy.setTypes.isometric}</option>
                                  <option value="jump">{trainingCopy.setTypes.jump}</option>
                                </select>
                              </label>
                              <label className="space-y-1 text-[9px] font-bold uppercase text-slate-400">
                                {trainingCopy.superset}
                                <select
                                  value={exerciseSupersetGroup}
                                  onChange={(event) => setExerciseSupersetGroup(event.target.value)}
                                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case text-slate-900 outline-none focus:border-violet-400"
                                >
                                  <option value="">{trainingCopy.none}</option>
                                  {['A', 'B', 'C', 'D'].map((group) => <option key={group} value={group}>{trainingCopy.group} {group}</option>)}
                                </select>
                              </label>
                              <label className="space-y-1 text-[9px] font-bold uppercase text-slate-400">
                                {trainingCopy.measureBy}
                                <select
                                  value={exercisePrescriptionUnit}
                                  onChange={(event) => setExercisePrescriptionUnit(event.target.value as WorkoutPrescriptionUnit)}
                                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case text-slate-900 outline-none focus:border-violet-400"
                                >
                                  <option value="reps">{trainingCopy.measures.reps}</option>
                                  <option value="seconds">{trainingCopy.measures.seconds}</option>
                                  <option value="minutes">{trainingCopy.measures.minutes}</option>
                                  <option value="meters">{trainingCopy.measures.meters}</option>
                                  <option value="kilometers">{trainingCopy.measures.kilometers}</option>
                                </select>
                              </label>
                              <label className="space-y-1 text-[9px] font-bold uppercase text-slate-400">
                                {trainingCopy.weightRounding}
                                <select
                                  value={exerciseWeightRounding}
                                  onChange={(event) => setExerciseWeightRounding(Number(event.target.value))}
                                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case text-slate-900 outline-none focus:border-violet-400"
                                >
                                  {[0.25, 0.5, 1, 1.25, 2, 2.5, 5].map((value) => <option key={value} value={value}>{value} kg</option>)}
                                </select>
                              </label>
                            </div>
                          </div>}
                          <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-violet-600 ring-1 ring-violet-200">
                                  <Zap className="h-4 w-4" />
                                </span>
                                <div>
                                  <p className="text-[11px] font-extrabold text-slate-900">Auto progression</p>
                                  <p className="text-[9px] font-semibold text-slate-500">Set the rule for the next session</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={progressionEnabled}
                                onClick={() => setProgressionEnabled((enabled) => !enabled)}
                                className={cn("relative h-7 w-12 rounded-full transition-colors", progressionEnabled ? "bg-violet-600" : "bg-slate-300")}
                              >
                                <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all", progressionEnabled ? "left-6" : "left-1")} />
                              </button>
                            </div>

                            {progressionEnabled && (
                              <div className="mt-3 space-y-3 border-t border-violet-200 pt-3">
                                <div className="grid grid-cols-3 gap-1 rounded-xl bg-white p-1 ring-1 ring-violet-100">
                                  {([
                                    ["double_progression", "Double"],
                                    ["linear_load", "Linear"],
                                    ["reps_only", "Reps"],
                                    ...(trainingEnhancementsEnabled ? [
                                      ["sets_only", "Sets"],
                                      ["rir_based", "RIR"],
                                      ["density", "Density"],
                                    ] : []),
                                  ] as Array<[ProgressionStrategy, string]>).map(([value, label]) => (
                                    <button
                                      key={value}
                                      type="button"
                                      onClick={() => setProgressionStrategy(value)}
                                      className={cn("h-9 rounded-lg text-[10px] font-extrabold transition", progressionStrategy === value ? "bg-[#07152F] text-white" : "text-slate-500")}
                                    >
                                      {label}
                                    </button>
                                  ))}
                                </div>

                                <p className="rounded-xl bg-white px-3 py-2 text-[10px] font-semibold leading-4 text-slate-600 ring-1 ring-violet-100">
                                  {progressionStrategy === "double_progression" && "Increase load after every set reaches the top of the rep range within the RPE limit."}
                                  {progressionStrategy === "linear_load" && "Increase load after all prescribed sets are completed within the RPE limit."}
                                  {progressionStrategy === "reps_only" && "Increase repetitions while keeping the current load unchanged."}
                                  {progressionStrategy === "sets_only" && trainingCopy.setsOnlyDescription}
                                  {progressionStrategy === "rir_based" && trainingCopy.rirDescription}
                                  {progressionStrategy === "density" && trainingCopy.densityDescription}
                                </p>

                                <div className="grid grid-cols-2 gap-2">
                                  <ProgressionField label="Min reps" value={progressionRepMin} min={1} onChange={setProgressionRepMin} />
                                  <ProgressionField label="Top reps" value={progressionRepMax} min={progressionRepMin} onChange={setProgressionRepMax} />
                                  {progressionStrategy === "reps_only" ? (
                                    <ProgressionField label="Add reps" value={progressionRepIncrement} min={1} step={1} onChange={setProgressionRepIncrement} />
                                  ) : (
                                    <ProgressionField label="Add weight (kg)" value={progressionLoadIncrement} min={0} step={0.5} onChange={setProgressionLoadIncrement} />
                                  )}
                                  {trainingEnhancementsEnabled && progressionStrategy === "sets_only" && <>
                                    <ProgressionField label={trainingCopy.addSets} value={progressionSetIncrement} min={1} max={3} step={1} onChange={setProgressionSetIncrement} />
                                    <ProgressionField label={trainingCopy.maximumSets} value={progressionMaxSets} min={exerciseSets} max={12} step={1} onChange={setProgressionMaxSets} />
                                  </>}
                                  {trainingEnhancementsEnabled && progressionStrategy === "rir_based" && <ProgressionField label={trainingCopy.targetRir} value={progressionTargetRir} min={0} max={5} step={0.5} onChange={setProgressionTargetRir} />}
                                  {trainingEnhancementsEnabled && progressionStrategy === "density" && <>
                                    <ProgressionField label={trainingCopy.reduceRest} value={progressionRestDecrement} min={5} max={60} step={5} onChange={setProgressionRestDecrement} suffix={trainingCopy.secondsShort} />
                                    <ProgressionField label={trainingCopy.minimumRest} value={progressionMinRest} min={0} max={600} step={5} onChange={setProgressionMinRest} suffix={trainingCopy.secondsShort} />
                                  </>}
                                  <ProgressionField label="Max RPE" value={progressionRpeCeiling} min={6} max={10} step={0.5} onChange={setProgressionRpeCeiling} />
                                  <ProgressionField label="Deload after" value={progressionFailureLimit} min={1} max={6} step={1} onChange={setProgressionFailureLimit} suffix="sessions" />
                                  <ProgressionField label="Deload" value={progressionDeloadPercent} min={5} max={30} step={5} onChange={setProgressionDeloadPercent} suffix="%" />
                                </div>
                              </div>
                            )}
                          </div>
                          <div>
                            <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-400">Coach instructions</label>
                            <textarea
                              value={exerciseNotes}
                              onChange={(event) => setExerciseNotes(event.target.value)}
                              rows={3}
                              placeholder="Technique cues, tempo, or client-specific notes"
                              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12px] leading-5 text-slate-900 placeholder:text-slate-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                            />
                          </div>
                          <button
                            onClick={async () => {
                              if (!workoutProgramId || !exerciseName.trim()) return;
                              const progressionRule = normalizeProgressionRule({
                                enabled: progressionEnabled,
                                strategy: progressionStrategy,
                                rep_min: progressionRepMin,
                                rep_max: progressionRepMax,
                                load_increment_kg: progressionLoadIncrement,
                                rep_increment: progressionRepIncrement,
                                ...(trainingEnhancementsEnabled ? {
                                  set_increment: progressionSetIncrement,
                                  max_sets: progressionMaxSets,
                                  target_rir: progressionTargetRir,
                                  rest_decrement_seconds: progressionRestDecrement,
                                  min_rest_seconds: progressionMinRest,
                                } : {}),
                                rpe_ceiling: progressionRpeCeiling,
                                failure_sessions_before_deload: progressionFailureLimit,
                                deload_percent: progressionDeloadPercent,
                              });
                              if (editingExerciseId) {
                                await updateExercise(editingExerciseId, {
                                  exercise_catalog_id: selectedExerciseId,
                                  exercise_name: exerciseName.trim(),
                                  sets: exerciseSets,
                                  reps: exerciseReps,
                                  rest_seconds: exerciseRest,
                                  notes: exerciseNotes.trim(),
                                  progression_rule: progressionRule,
                                  ...(trainingEnhancementsEnabled ? {
                                    set_type: exerciseSetType,
                                    superset_group: exerciseSupersetGroup || null,
                                    prescription_unit: exercisePrescriptionUnit,
                                    weight_rounding_kg: exerciseWeightRounding,
                                  } : {}),
                                });
                                setEditingExerciseId(null);
                              } else {
                                await assignExercise(workoutProgramId, {
                                  exercise_catalog_id: selectedExerciseId,
                                  exercise_name: exerciseName.trim(),
                                  sets: exerciseSets,
                                  reps: exerciseReps,
                                  rest_seconds: exerciseRest,
                                  notes: exerciseNotes.trim(),
                                  day_number: selectedWorkoutDay,
                                  order_index: programExercises.filter((e) => e.program_id === workoutProgramId && e.day_number === selectedWorkoutDay).length,
                                  progression_rule: progressionRule,
                                  ...(trainingEnhancementsEnabled ? {
                                    set_type: exerciseSetType,
                                    superset_group: exerciseSupersetGroup || null,
                                    prescription_unit: exercisePrescriptionUnit,
                                    weight_rounding_kg: exerciseWeightRounding,
                                  } : {}),
                                });
                              }
                              resetExerciseForm();
                            }}
                            disabled={!exerciseName.trim()}
                            className="flex h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#07152F] text-[13px] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40"
                          >
                            {editingExerciseId ? <><Pencil className="w-4 h-4" /> Update Exercise</> : <><Plus className="w-4 h-4" /> Add to Day {selectedWorkoutDay}</>}
                          </button>
                        </div>

                        <div className={cn("mt-2 grid gap-2", trainingEnhancementsEnabled ? "grid-cols-2" : "grid-cols-1")}>
                          {trainingEnhancementsEnabled && <button type="button" disabled={!workoutProgramId} onClick={async () => { if (!workoutProgramId) return; try { await saveWorkoutTemplate(workoutProgramId); toast.success(trainingCopy.templateSaved); } catch (error) { toast.error(error instanceof Error ? error.message : trainingCopy.templateSaveError); } }} className="h-[48px] rounded-2xl bg-[#F3F1FF] text-[11px] font-extrabold text-[#656BD8] ring-1 ring-[#DCD8FF] disabled:opacity-40">{trainingCopy.saveTemplate}</button>}
                          <button onClick={() => { setWorkoutBuilderOpen(false); setWorkoutStep("create"); setWorkoutProgramId(null); resetExerciseForm(); }} className="h-[48px] rounded-2xl bg-slate-100 text-[13px] font-bold text-slate-600 transition-all active:scale-[0.98] hover:bg-slate-200">Done</button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}

      {/* Goal Proposal Modal */}
      {goalModalOpen && (
        <div className="fixed inset-0 z-[1200] bg-[#08162f]/60 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="w-full max-w-md bg-white rounded-t-[28px] sm:rounded-[28px] p-6 pb-[calc(24px+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[16px] font-extrabold text-slate-950">Propose a Goal</h2>
                <p className="text-[11px] text-slate-500">Set a target for this client</p>
              </div>
              <button aria-label="Close goal proposal" onClick={() => setGoalModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <GoalProposalForm onPropose={async (data) => { await proposeGoal(data); setGoalModalOpen(false); }} />
          </motion.div>
        </div>
      )}

      {/* Export Report Modal */}
      {reportModalOpen && profile && clientId && (
        <div className="fixed inset-0 z-[1200] bg-[#08162f]/60 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="w-full max-w-md bg-white rounded-t-[28px] sm:rounded-[28px] p-6 pb-[calc(24px+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[16px] font-extrabold text-slate-950">Export Progress Report</h2>
                <p className="text-[11px] text-slate-500">Generate a comprehensive PDF for {profile.full_name || "client"}</p>
              </div>
              <button aria-label="Close report generator" onClick={() => setReportModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Start Date</label>
                  <input type="date" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)} className="w-full h-[44px] px-4 rounded-full bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 mb-1 block">End Date</label>
                  <input type="date" value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)} className="w-full h-[44px] px-4 rounded-full bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 text-center">
                <p className="text-[12px] text-slate-500">
                  {reportStartDate && reportEndDate ? `${Math.ceil((new Date(reportEndDate).getTime() - new Date(reportStartDate).getTime()) / (1000 * 60 * 60 * 24))} days selected` : "Select a date range to generate"}
                </p>
              </div>
              <button
                onClick={async () => {
                  if (!reportStartDate || !reportEndDate) return;
                  const result = await generateReport(clientId, coachId || "", reportStartDate, reportEndDate);
                  if (result.success) {
                    setReportModalOpen(false);
                  } else {
                    toast.error(result.error?.message || "Failed to generate report. Make sure the edge function is deployed.");
                  }
                }}
                disabled={!reportStartDate || !reportEndDate || generating}
                className="w-full h-[44px] rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[13px] font-bold shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/30 disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                {generating ? "Generating..." : "Generate Report"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <ExerciseCatalogSheet
        open={exerciseCatalogOpen}
        onOpenChange={setExerciseCatalogOpen}
        selectedId={selectedExerciseId}
        title="Choose an exercise"
        onSelect={(exercise) => {
          setSelectedExerciseId(exercise.id);
          setSelectedCatalogExercise(exercise);
          setExerciseName(formatExerciseLabel(exercise.name));
        }}
      />
      <ExerciseCatalogSheet
        open={exercisePreviewOpen}
        onOpenChange={setExercisePreviewOpen}
        title="Exercise details"
        allowedExerciseIds={exercisePreviewId ? [exercisePreviewId] : []}
        initialExerciseId={exercisePreviewId}
      />
    </div>
  );
}
