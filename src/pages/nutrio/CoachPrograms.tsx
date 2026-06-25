import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Loader2,
  UtensilsCrossed,
  Dumbbell,
  ChefHat,
  Check,
  Play,
  Clock,
  CalendarPlus,
  Shuffle,
  X,
  ArrowLeft,
  MessageCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCoachPrograms, ProgramMeal } from "@/hooks/useCoachPrograms";
import { useProgramCompletions } from "@/hooks/useProgramCompletions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type MealCatalogRow = {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  image_url: string | null;
  price: number;
  restaurants?: { name?: string | null } | null;
};

type ScheduledCoachMealContext = {
  status: "followed" | "replaced";
  timeSlot: string | null;
  selectedMealId: string;
};

const fadeInUp = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 260, damping: 24 },
  },
};

export default function CoachPrograms() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const clientId = user?.id;
  const [coachId, setCoachId] = useState<string | undefined>(undefined);
  const [coachLoading, setCoachLoading] = useState(true);

  useEffect(() => {
    if (!clientId) {
      setCoachLoading(false);
      return;
    }
    (async () => {
      try {
        const { data } = await supabase
          .from("coach_client_assignments")
          .select("coach_id")
          .eq("client_id", clientId)
          .eq("status", "active")
          .maybeSingle();
        setCoachId(data?.coach_id ?? undefined);
      } catch (err) {
        console.error("Error fetching coach assignment:", err);
      } finally {
        setCoachLoading(false);
      }
    })();
  }, [clientId]);

  const { programs, programMeals, programExercises, mealInfos, loading: programsLoading, replaceMeal } =
    useCoachPrograms(coachId, clientId);
  const {
    isExerciseCompleted,
    isMealCompleted,
    toggleExercise,
    toggleMeal,
    loading: completionsLoading,
  } = useProgramCompletions(clientId);

  const [activeTab, setActiveTab] = useState<"meal" | "workout">("meal");
  const [selectedMealDate, setSelectedMealDate] = useState<string | null>(null);
  const [selectedMealDateByProgram, setSelectedMealDateByProgram] = useState<Record<string, string>>({});
  const [scheduledMeals, setScheduledMeals] = useState<Set<string>>(new Set());
  const [scheduledMealTimes, setScheduledMealTimes] = useState<Record<string, string>>({});
  const [scheduledMealContexts, setScheduledMealContexts] = useState<Record<string, ScheduledCoachMealContext>>({});
  const [scheduleTarget, setScheduleTarget] = useState<{ id: string; programId: string; mealId: string; date: string; type: string } | null>(null);

  const [allMeals, setAllMeals] = useState<Array<{
    id: string;
    name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    image_url: string | null;
    price: number;
    restaurant_name?: string;
  }>>([]);
  const [replaceTarget, setReplaceTarget] = useState<ProgramMeal | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("meals")
        .select("id, name, calories, protein_g, carbs_g, fat_g, image_url, price, restaurants:restaurant_id(name)")
        .eq("is_available", true)
        .order("name")
        .limit(200);
      if (data) {
        setAllMeals(
          (data as MealCatalogRow[]).map((m) => ({
            id: m.id,
            name: m.name,
            calories: m.calories,
            protein_g: m.protein_g,
            carbs_g: m.carbs_g,
            fat_g: m.fat_g,
            image_url: m.image_url,
            price: m.price,
            restaurant_name: m.restaurants?.name ?? undefined,
          }))
        );
      }
    })();
  }, []);

  const mealsById = useMemo(() => {
    const map: Record<string, (typeof allMeals)[0]> = {};
    for (const m of mealInfos) map[m.id] = m;
    for (const m of allMeals) map[m.id] = m;
    return map;
  }, [allMeals, mealInfos]);

  const getSimilarMeals = (currentMealId: string) => {
    const current = mealsById[currentMealId];
    if (!current) return [];
    const macros = allMeals.map((m) => [m.calories, m.protein_g, m.carbs_g, m.fat_g]);
    const allValues = [0, 1, 2, 3].map((i) => Math.max(...macros.map((r) => r[i]), 1));
    const normalize = (vals: number[]) => vals.map((v, i) => v / allValues[i]);
    const [nc, np, ncb, nf] = normalize([
      current.calories,
      current.protein_g,
      current.carbs_g,
      current.fat_g,
    ]);
    return allMeals
      .filter((m) => m.id !== currentMealId)
      .map((m) => {
        const [mc, mp, mcb, mf] = normalize([m.calories, m.protein_g, m.carbs_g, m.fat_g]);
        const dist = Math.sqrt(
          Math.pow(nc - mc, 2) +
            Math.pow(np - mp, 2) +
            Math.pow(ncb - mcb, 2) +
            Math.pow(nf - mf, 2)
        );
        return { meal: m, distance: Math.round(dist * 1000) / 1000 };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 8);
  };

  useEffect(() => {
    if (!user?.id || programMeals.length === 0) {
      setScheduledMeals(new Set());
      setScheduledMealTimes({});
      setScheduledMealContexts({});
      return;
    }

    const dates = programMeals.map((meal) => meal.assigned_date).sort();
    supabase
      .from("meal_schedules")
      .select("meal_id, scheduled_date, meal_type, delivery_time_slot, program_meal_id, coach_replacement_status")
      .eq("user_id", user.id)
      .gte("scheduled_date", dates[0])
      .lte("scheduled_date", dates[dates.length - 1])
      .then(({ data, error }) => {
        if (error) {
          console.error("Error loading scheduled coach meals:", error);
          return;
        }

        const scheduledIds = new Set<string>();
        const times: Record<string, string> = {};
        const contexts: Record<string, ScheduledCoachMealContext> = {};

        for (const meal of programMeals) {
          const schedule = data?.find((item) =>
            item.program_meal_id === meal.id ||
            (
              item.meal_id === meal.meal_id &&
              item.scheduled_date === meal.assigned_date &&
              item.meal_type === meal.meal_type
            )
          );
          if (schedule) {
            scheduledIds.add(meal.id);
            if (schedule.delivery_time_slot) times[meal.id] = schedule.delivery_time_slot;
            contexts[meal.id] = {
              status: schedule.coach_replacement_status === "replaced" || schedule.meal_id !== meal.meal_id ? "replaced" : "followed",
              timeSlot: schedule.delivery_time_slot,
              selectedMealId: schedule.meal_id,
            };
          }
        }

        setScheduledMeals(scheduledIds);
        setScheduledMealTimes(times);
        setScheduledMealContexts(contexts);
      });
  }, [programMeals, user?.id]);

  const handleScheduleMeal = async (timeSlot: string) => {
    if (!user?.id || !scheduleTarget) return;
    try {
      const { error } = await supabase.from("meal_schedules").insert({
        user_id: user.id,
        meal_id: scheduleTarget.mealId,
        scheduled_date: scheduleTarget.date,
        meal_type: scheduleTarget.type,
        is_completed: false,
        order_status: "pending",
        delivery_time_slot: timeSlot,
        schedule_source: "coach_program",
        coach_program_id: scheduleTarget.programId,
        program_meal_id: scheduleTarget.id,
        coach_suggested_meal_id: scheduleTarget.mealId,
        coach_replacement_status: "followed",
        coach_replacement_delta: {
          calories: 0,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
        },
      });
      if (error) throw error;
      setScheduledMeals((prev) => new Set(prev).add(scheduleTarget.id));
      setScheduledMealTimes((prev) => ({ ...prev, [scheduleTarget.id]: timeSlot }));
      setScheduledMealContexts((prev) => ({
        ...prev,
        [scheduleTarget.id]: {
          status: "followed",
          timeSlot,
          selectedMealId: scheduleTarget.mealId,
        },
      }));
      toast.success("Meal added to your schedule");
    } catch (err) {
      console.error("Error scheduling meal:", err);
      toast.error("Failed to schedule meal");
    } finally {
      setScheduleTarget(null);
    }
  };

  const handleReplaceMeal = async (newMealId: string) => {
    if (!replaceTarget) return;
    try {
      await replaceMeal(replaceTarget.id, replaceTarget, newMealId);
      setScheduledMeals((prev) => {
        const next = new Set(prev);
        next.delete(replaceTarget.id);
        return next;
      });
      setScheduledMealTimes((prev) => {
        const next = { ...prev };
        delete next[replaceTarget.id];
        return next;
      });
      setScheduledMealContexts((prev) => {
        const next = { ...prev };
        delete next[replaceTarget.id];
        return next;
      });
      setReplaceTarget(null);
      toast.success("Meal replaced");
    } catch (err) {
      console.error("Error replacing meal:", err);
      toast.error("Failed to replace meal");
    }
  };

  const replaceCurrentMeal = replaceTarget ? mealsById[replaceTarget.meal_id] : undefined;
  const replaceSimilar = replaceTarget ? getSimilarMeals(replaceTarget.meal_id) : [];

  const loading = coachLoading || programsLoading || completionsLoading;

  const mealPrograms = programs.filter((p) => p.type === "meal_plan");
  const workoutPrograms = programs.filter((p) => p.type === "workout_plan");
  const totalMeals = programMeals.length;
  const completedMealsCount = programMeals.filter((meal) => isMealCompleted(meal.id)).length;
  const totalExercises = programExercises.length;
  const completedExercisesCount = programExercises.filter((exercise) => isExerciseCompleted(exercise.id)).length;
  const overallItems = totalMeals + totalExercises;
  const completedItems = completedMealsCount + completedExercisesCount;
  const overallProgress = overallItems > 0 ? Math.round((completedItems / overallItems) * 100) : 0;
  const nextMeal = [...programMeals]
    .filter((meal) => !isMealCompleted(meal.id))
    .sort((a, b) => a.assigned_date.localeCompare(b.assigned_date))[0];
  const nextMealInfo = nextMeal ? mealsById[nextMeal.meal_id] : undefined;
  const nextWorkoutDay = [...new Set(programExercises.filter((exercise) => !isExerciseCompleted(exercise.id)).map((exercise) => exercise.day_number))]
    .sort((a, b) => a - b)[0];
  const activeTitle = programs[0]?.title || "Coach programs";
  const mealCalendarDates = [
    ...new Set(programMeals.map((meal) => meal.assigned_date)),
  ].sort();
  const activeMealDate = selectedMealDate && mealCalendarDates.includes(selectedMealDate)
    ? selectedMealDate
    : mealCalendarDates[0];
  const selectedDateMeals = activeMealDate
    ? programMeals.filter((meal) => meal.assigned_date === activeMealDate)
    : [];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F8FB]">
        <Loader2 className="h-8 w-8 animate-spin text-[#020617]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F8FB] pb-24 text-[#020617]">
      <div className="sticky top-0 z-20 border-b border-white/70 bg-[#F6F8FB]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[78px] max-w-[430px] items-center justify-between gap-3 px-4 pt-[env(safe-area-inset-top)]">
          <button
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#020617] shadow-[0_8px_22px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1] transition-transform active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2} />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#64748B]">Coach</p>
            <h1 className="truncate text-[22px] font-black leading-tight text-[#020617]">My Programs</h1>
          </div>
          <button
            onClick={() => navigate("/coach-messages")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#020617] shadow-[0_8px_22px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1] transition-transform active:scale-95"
            aria-label="Message coach"
          >
            <MessageCircle className="h-5 w-5" />
          </button>
        </div>
      </div>

      {programs.length === 0 ? (
        <div className="mx-auto max-w-[430px] px-4 py-4">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="overflow-hidden rounded-[30px] bg-white text-center shadow-[0_18px_40px_rgba(2,6,23,0.07)] ring-1 ring-[#E5EAF1]"
          >
            <div className="bg-[#020617] px-6 pb-8 pt-7 text-white">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-white/10 text-white ring-1 ring-white/15">
                <ChefHat className="h-8 w-8" />
              </div>
              <h3 className="text-[22px] font-black">No active program</h3>
              <p className="mt-2 text-[13px] font-semibold leading-6 text-white/70">
                Your coach programs will appear here when a meal or workout plan is assigned.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 p-4">
              <button
                onClick={() => navigate("/coaches")}
                className="min-h-[52px] rounded-[18px] bg-[#020617] px-4 text-[13px] font-black text-white transition active:scale-[0.98]"
              >
                Find coach
              </button>
              <button
                onClick={() => navigate("/dashboard")}
                className="min-h-[52px] rounded-[18px] bg-[#F6F8FB] px-4 text-[13px] font-black text-[#020617] ring-1 ring-[#E5EAF1] transition active:scale-[0.98]"
              >
                Dashboard
              </button>
            </div>
          </motion.div>
        </div>
      ) : (
        <div className="mx-auto max-w-[430px] space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-white p-4 shadow-[0_14px_34px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[#EFFFFA] text-[#22C7A1] ring-1 ring-[#22C7A1]/20">
                  <ChefHat className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#22C7A1]">Active coaching</p>
                  <h2 className="mt-1 line-clamp-2 text-[22px] font-black leading-tight text-[#020617]">{activeTitle}</h2>
                  <p className="mt-1.5 text-[12px] font-semibold leading-5 text-[#64748B]">
                    Meals, workouts, and coach support in one place.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate("/coach-messages")}
                className="flex h-11 shrink-0 items-center gap-2 rounded-[16px] bg-[#020617] px-3 text-[11px] font-black text-white transition active:scale-95"
                aria-label="Message coach"
              >
                <MessageCircle className="h-4 w-4" />
                Chat
              </button>
            </div>
            <div className="mt-4 rounded-[22px] bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">Overall progress</span>
                <span className="text-[13px] font-black text-[#020617]">{overallProgress}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[#E5EAF1]">
                <div className="h-full rounded-full bg-[#22C7A1] transition-all duration-500" style={{ width: `${overallProgress}%` }} />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-[18px] bg-[#EFFFFA] px-3 py-3 text-center ring-1 ring-[#22C7A1]/20">
                <p className="text-[22px] font-black leading-none text-[#020617]">{programs.length}</p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#22C7A1]">Programs</p>
              </div>
              <div className="rounded-[18px] bg-[#F3F4FF] px-3 py-3 text-center ring-1 ring-[#7C83F6]/20">
                <p className="text-[22px] font-black leading-none text-[#020617]">{completedMealsCount}/{totalMeals}</p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#7C83F6]">Meals</p>
              </div>
              <div className="rounded-[18px] bg-[#FFF0F2] px-3 py-3 text-center ring-1 ring-[#FB6B7A]/20">
                <p className="text-[22px] font-black leading-none text-[#020617]">{completedExercisesCount}/{totalExercises}</p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#FB6B7A]">Training</p>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => navigate("/coach-messages")}
              className="min-h-[76px] rounded-[22px] bg-white p-3 text-center shadow-[0_10px_24px_rgba(2,6,23,0.05)] ring-1 ring-[#E5EAF1] transition active:scale-[0.98]"
            >
              <MessageCircle className="mx-auto h-5 w-5 text-[#38BDF8]" />
              <p className="mt-2 text-[11px] font-black text-[#020617]">Message</p>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#94A3B8]">Coach</p>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("meal")}
              className="min-h-[76px] rounded-[22px] bg-white p-3 text-center shadow-[0_10px_24px_rgba(2,6,23,0.05)] ring-1 ring-[#E5EAF1] transition active:scale-[0.98]"
            >
              <UtensilsCrossed className="mx-auto h-5 w-5 text-[#22C7A1]" />
              <p className="mt-2 text-[11px] font-black text-[#020617]">Meals</p>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#94A3B8]">{mealPrograms.length} plans</p>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("workout")}
              className="min-h-[76px] rounded-[22px] bg-white p-3 text-center shadow-[0_10px_24px_rgba(2,6,23,0.05)] ring-1 ring-[#E5EAF1] transition active:scale-[0.98]"
            >
              <Dumbbell className="mx-auto h-5 w-5 text-[#7C83F6]" />
              <p className="mt-2 text-[11px] font-black text-[#020617]">Workout</p>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#94A3B8]">{workoutPrograms.length} plans</p>
            </button>
          </section>

          {(nextMeal || nextWorkoutDay) && (
            <section className="grid grid-cols-2 gap-2">
              {nextMeal && (
                <button
                  onClick={() => setActiveTab("meal")}
                  className="col-span-2 rounded-[26px] bg-white p-3 text-left shadow-[0_12px_28px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1] transition active:scale-[0.98]"
                >
                  <div className="flex gap-3">
                    <div className="h-[104px] w-[104px] shrink-0 overflow-hidden rounded-[22px] bg-[#F6F8FB] ring-1 ring-[#E5EAF1]">
                      {nextMealInfo?.image_url ? (
                        <img src={nextMealInfo.image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[#22C7A1]">
                          <UtensilsCrossed className="h-7 w-7" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 py-1">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EFFFFA] text-[#22C7A1] ring-1 ring-[#22C7A1]/20">
                          <UtensilsCrossed className="h-4 w-4" />
                        </span>
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">Next meal</p>
                      </div>
                      <p className="mt-2 line-clamp-2 text-[16px] font-black leading-tight text-[#020617]">
                        {nextMealInfo?.name || nextMeal.meal_type}
                      </p>
                      {nextMealInfo && (
                        <div className="mt-3 grid grid-cols-4 gap-1.5">
                          <div className="rounded-[14px] bg-[#FFF7ED] px-2 py-2 text-center ring-1 ring-[#FDBA74]/35">
                            <p className="text-[13px] font-black leading-none text-[#020617]">{nextMealInfo.calories}</p>
                            <p className="mt-1 text-[8px] font-black uppercase text-[#F97316]">cal</p>
                          </div>
                          <div className="rounded-[14px] bg-[#F3F4FF] px-2 py-2 text-center ring-1 ring-[#7C83F6]/20">
                            <p className="text-[13px] font-black leading-none text-[#020617]">{nextMealInfo.protein_g}g</p>
                            <p className="mt-1 text-[8px] font-black uppercase text-[#7C83F6]">protein</p>
                          </div>
                          <div className="rounded-[14px] bg-[#EFF9FF] px-2 py-2 text-center ring-1 ring-[#38BDF8]/20">
                            <p className="text-[13px] font-black leading-none text-[#020617]">{nextMealInfo.carbs_g}g</p>
                            <p className="mt-1 text-[8px] font-black uppercase text-[#38BDF8]">carbs</p>
                          </div>
                          <div className="rounded-[14px] bg-[#FFF0F2] px-2 py-2 text-center ring-1 ring-[#FB6B7A]/20">
                            <p className="text-[13px] font-black leading-none text-[#020617]">{nextMealInfo.fat_g}g</p>
                            <p className="mt-1 text-[8px] font-black uppercase text-[#FB6B7A]">fat</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              )}
              {nextWorkoutDay && (
                <button
                  onClick={() => setActiveTab("workout")}
                  className="min-h-[96px] rounded-[24px] bg-white p-4 text-left shadow-[0_12px_28px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1] transition active:scale-[0.98]"
                >
                  <Dumbbell className="h-4 w-4 text-[#7C83F6]" />
                  <p className="mt-3 text-[10px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">Next workout</p>
                  <p className="mt-1 text-[13px] font-black leading-tight text-[#020617]">Day {nextWorkoutDay}</p>
                </button>
              )}
            </section>
          )}

          <div className="sticky top-[78px] z-10 flex rounded-[22px] bg-white p-1 shadow-[0_10px_24px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
            <button
              onClick={() => setActiveTab("meal")}
              className={`flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-[18px] px-3 text-[13px] font-black transition-all ${
                activeTab === "meal"
                  ? "bg-[#22C7A1] text-white shadow-[0_10px_18px_rgba(34,199,161,0.18)]"
                  : "text-[#64748B]"
              }`}
            >
              <UtensilsCrossed className="h-4 w-4" />
              Meals
            </button>
            <button
              onClick={() => setActiveTab("workout")}
              className={`flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-[18px] px-3 text-[13px] font-black transition-all ${
                activeTab === "workout"
                  ? "bg-[#7C83F6] text-white shadow-[0_10px_18px_rgba(124,131,246,0.2)]"
                  : "text-[#64748B]"
              }`}
            >
              <Dumbbell className="h-4 w-4" />
              Workouts
            </button>
          </div>

          {activeTab === "meal" && mealPrograms.length > 0 && (
            <motion.section
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className="rounded-[28px] bg-white p-4 shadow-[0_14px_34px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#22C7A1]">Meal calendar</p>
                  <h3 className="mt-1 text-[18px] font-black text-[#020617]">
                    {activeMealDate
                      ? new Date(activeMealDate).toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "short",
                          day: "numeric",
                        })
                      : "No dates"}
                  </h3>
                </div>
                <span className="rounded-full bg-[#F6F8FB] px-3 py-1.5 text-[11px] font-black text-[#020617] ring-1 ring-[#E5EAF1]">
                  {selectedDateMeals.length} meal{selectedDateMeals.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
                {mealCalendarDates.map((date) => {
                  const isSelected = date === activeMealDate;
                  const dayMeals = programMeals.filter((meal) => meal.assigned_date === date);
                  const doneCount = dayMeals.filter((meal) => isMealCompleted(meal.id)).length;
                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => setSelectedMealDate(date)}
                      className={`flex min-h-[72px] min-w-[68px] flex-col items-center justify-center rounded-[18px] px-2 text-center transition active:scale-[0.98] ${
                        isSelected
                          ? "bg-[#020617] text-white shadow-[0_10px_20px_rgba(2,6,23,0.14)]"
                          : "bg-[#F6F8FB] text-[#020617] ring-1 ring-[#E5EAF1]"
                      }`}
                    >
                      <span className={`text-[10px] font-black uppercase ${isSelected ? "text-white/60" : "text-[#94A3B8]"}`}>
                        {new Date(date).toLocaleDateString("en-US", { weekday: "short" })}
                      </span>
                      <span className="mt-1 text-[20px] font-black leading-none">
                        {new Date(date).toLocaleDateString("en-US", { day: "numeric" })}
                      </span>
                      <span className={`mt-1 text-[9px] font-black ${isSelected ? "text-[#22C7A1]" : "text-[#64748B]"}`}>
                        {doneCount}/{dayMeals.length}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-3">
                {mealPrograms.map((program) => {
                  const programDayMeals = activeMealDate
                    ? programMeals.filter(
                        (meal) =>
                          meal.program_id === program.id &&
                          meal.assigned_date === activeMealDate
                      )
                    : [];
                  if (programDayMeals.length === 0) return null;
                  const programTotalMeals = programMeals.filter((meal) => meal.program_id === program.id).length;
                  const programCompletedMeals = programMeals.filter(
                    (meal) => meal.program_id === program.id && isMealCompleted(meal.id)
                  ).length;
                  return (
                    <div key={program.id} className="rounded-[24px] bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-black text-[#020617]">{program.title}</p>
                          <p className="mt-0.5 text-[10px] font-bold text-[#94A3B8]">
                            {programCompletedMeals}/{programTotalMeals} complete
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-[#64748B] ring-1 ring-[#E5EAF1]">
                          {programDayMeals.length}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {programDayMeals.map((meal) => {
                          const done = isMealCompleted(meal.id);
                          const scheduled = scheduledMeals.has(meal.id);
                          const scheduledTime = scheduledMealTimes[meal.id];
                          const scheduledContext = scheduledMealContexts[meal.id];
                          const wasReplaced = scheduledContext?.status === "replaced";
                          const mealData = mealsById[meal.meal_id];
                          return (
                            <div
                              key={meal.id}
                              className="flex min-h-[58px] items-center gap-2 rounded-[20px] bg-white px-2.5 py-2 text-[12px] shadow-[0_8px_20px_rgba(2,6,23,0.04)] ring-1 ring-[#E5EAF1]"
                            >
                              <button
                                onClick={() => toggleMeal(meal.id)}
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all ${
                                  done
                                    ? "bg-[#22C7A1] text-white"
                                    : "bg-[#F6F8FB] text-transparent ring-1 ring-[#E5EAF1] hover:ring-[#020617]/30"
                                }`}
                                aria-label="Toggle meal completion"
                              >
                                <Check className="h-3.5 w-3.5" strokeWidth={3} />
                              </button>
                              <div className="min-w-0 flex-1">
                                <span
                                  className={`${
                                    done
                                      ? "text-[#94A3B8] line-through"
                                      : "text-[#020617]"
                                  } block truncate font-black`}
                                >
                                  {mealData?.name || meal.meal_type}
                                </span>
                                {mealData && (
                                  <div className="space-y-0.5">
                                    <span className="block text-[10px] font-bold text-[#94A3B8]">
                                      {mealData.calories} cal - {mealData.protein_g}P
                                    </span>
                                    {scheduledTime ? (
                                      <span className={`block text-[10px] font-black ${wasReplaced ? "text-[#F97316]" : "text-[#38BDF8]"}`}>
                                        Delivery {scheduledTime}
                                      </span>
                                    ) : null}
                                    {wasReplaced ? (
                                      <span className="block text-[10px] font-black text-[#F97316]">
                                        Client chose a different meal
                                      </span>
                                    ) : null}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() =>
                                  setScheduleTarget({ id: meal.id, programId: meal.program_id, mealId: meal.meal_id, date: meal.assigned_date, type: meal.meal_type })
                                }
                                disabled={scheduled}
                                className={`flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-[10px] font-black transition-all ${
                                  wasReplaced
                                    ? "bg-[#FFF7ED] text-[#F97316] ring-1 ring-[#F97316]/20"
                                    : scheduled
                                      ? "bg-[#EFFFFA] text-[#22C7A1] ring-1 ring-[#22C7A1]/20"
                                    : "bg-[#EFF9FF] text-[#38BDF8] ring-1 ring-[#38BDF8]/20 active:scale-95"
                                }`}
                              >
                                <CalendarPlus className="h-3 w-3" />
                                {wasReplaced ? "Replaced" : scheduled ? "Added" : "Schedule"}
                              </button>
                              <button
                                onClick={() => setReplaceTarget(meal)}
                                className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-[#FFF0F2] px-2.5 text-[10px] font-black text-[#FB6B7A] ring-1 ring-[#FB6B7A]/20 transition-all active:scale-95"
                              >
                                <Shuffle className="h-3 w-3" />
                                Replace
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {selectedDateMeals.length === 0 && (
                  <div className="rounded-[20px] bg-[#F6F8FB] px-4 py-6 text-center ring-1 ring-[#E5EAF1]">
                    <p className="text-[13px] font-bold text-[#94A3B8]">No meals for this day</p>
                  </div>
                )}
              </div>
            </motion.section>
          )}

          {activeTab === "meal" && mealPrograms.length === 0 && (
            <section className="rounded-[28px] bg-white p-6 text-center shadow-[0_14px_34px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#F6F8FB] text-[#020617] ring-1 ring-[#E5EAF1]">
                <UtensilsCrossed className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-[18px] font-black text-[#020617]">No meal plan yet</h3>
              <p className="mt-2 text-[13px] font-semibold leading-6 text-[#64748B]">
                When your coach assigns meals, they will appear here with schedule and replacement actions.
              </p>
            </section>
          )}

          {activeTab === "workout" &&
            workoutPrograms.map((program) => {
              const days = [
                ...new Set(
                  programExercises
                    .filter((e) => e.program_id === program.id)
                    .map((e) => e.day_number)
                ),
              ].sort((a, b) => a - b);
              const totalExercises = programExercises.filter(
                (e) => e.program_id === program.id
              ).length;
              const completedExercises = programExercises.filter(
                (e) =>
                  e.program_id === program.id &&
                  isExerciseCompleted(e.id)
              ).length;
              const workoutProgress =
                totalExercises > 0
                  ? Math.round((completedExercises / totalExercises) * 100)
                  : 0;
              return (
                <motion.div
                  key={program.id}
                  variants={fadeInUp}
                  initial="hidden"
                  animate="visible"
                  className="rounded-[28px] bg-white p-4 shadow-[0_14px_34px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]"
                >
                  <div className="mb-4 flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[#F3F4FF] text-[#7C83F6] ring-1 ring-[#7C83F6]/20">
                      <Dumbbell className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[18px] font-black leading-tight text-[#020617]">
                        {program.title}
                      </h3>
                      <p className="mt-1 text-[11px] font-bold text-[#94A3B8]">
                        {new Date(program.start_date).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" }
                        )}{" "}
                        -{" "}
                        {new Date(program.end_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="shrink-0 rounded-full bg-[#F6F8FB] px-3 py-1.5 text-[11px] font-black text-[#020617] ring-1 ring-[#E5EAF1]">
                      {completedExercises}/{totalExercises}
                    </div>
                  </div>
                  <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-[#E5EAF1]">
                    <div
                      className="h-full rounded-full bg-[#7C83F6] transition-all duration-500"
                      style={{ width: `${workoutProgress}%` }}
                    />
                  </div>
                  <div className="space-y-2.5">
                    {days.map((dayNum) => {
                      const dayExercises = programExercises.filter(
                        (e) =>
                          e.program_id === program.id &&
                          e.day_number === dayNum
                      );
                      const dayCompleted = dayExercises.filter((e) =>
                        isExerciseCompleted(e.id)
                      ).length;
                      return (
                        <div
                          key={dayNum}
                          className="rounded-[24px] bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-[12px] font-black text-[#020617]">
                              Day {dayNum}
                              <span className="ml-1 text-[10px] font-bold text-[#94A3B8]">
                                {dayExercises.length} exercise{dayExercises.length !== 1 ? "s" : ""}
                              </span>
                            </p>
                            <div className="flex shrink-0 items-center gap-1.5">
                              {dayExercises.length > 0 && (
                                <button
                                  onClick={() =>
                                    navigate(
                                      `/coach-programs/workout/${program.id}/day/${dayNum}`
                                    )
                                  }
                                  className="flex h-8 items-center gap-1 rounded-full bg-[#7C83F6] px-3 text-[10px] font-black text-white shadow-[0_8px_16px_rgba(124,131,246,0.2)] transition-transform active:scale-95"
                                >
                                  <Play className="h-3 w-3" />
                                  Start
                                </button>
                              )}
                              {dayCompleted === dayExercises.length &&
                                dayExercises.length > 0 && (
                                  <span className="rounded-full bg-[#EFFFFA] px-2 py-1 text-[10px] font-black text-[#22C7A1] ring-1 ring-[#22C7A1]/20">
                                    Done
                                  </span>
                                )}
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            {dayExercises.map((exercise) => {
                              const done = isExerciseCompleted(exercise.id);
                              return (
                                <div
                                  key={exercise.id}
                                  className="flex min-h-[54px] items-center gap-2 rounded-[20px] bg-white px-2.5 py-2 text-[12px] shadow-[0_8px_20px_rgba(2,6,23,0.04)] ring-1 ring-[#E5EAF1]"
                                >
                                  <button
                                    onClick={() =>
                                      toggleExercise(exercise.id)
                                    }
                                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all ${
                                      done
                                        ? "bg-[#7C83F6] text-white"
                                        : "bg-[#F6F8FB] text-transparent ring-1 ring-[#E5EAF1] hover:ring-[#020617]/30"
                                    }`}
                                    aria-label="Toggle exercise completion"
                                  >
                                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                  </button>
                                  <div className="min-w-0 flex-1">
                                    <span
                                      className={`block truncate font-black ${
                                        done
                                           ? "text-[#94A3B8] line-through"
                                           : "text-[#020617]"
                                      }`}
                                    >
                                      {exercise.exercise_name}
                                    </span>
                                    <span
                                      className={`text-[10px] font-bold ${
                                        done ? "text-[#CBD5E1]" : "text-[#94A3B8]"
                                      }`}
                                    >
                                      {exercise.sets}x{exercise.reps}
                                      {exercise.notes ? ` - ${exercise.notes}` : ""}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}

          {activeTab === "workout" && workoutPrograms.length === 0 && (
            <section className="rounded-[28px] bg-white p-6 text-center shadow-[0_14px_34px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#F6F8FB] text-[#020617] ring-1 ring-[#E5EAF1]">
                <Dumbbell className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-[18px] font-black text-[#020617]">No workout plan yet</h3>
              <p className="mt-2 text-[13px] font-semibold leading-6 text-[#64748B]">
                Your coach can add workout days here, then you can start each guided session.
              </p>
            </section>
          )}
        </div>
      )}

      {replaceTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#020617]/45 pb-[env(safe-area-inset-bottom)]" onClick={() => setReplaceTarget(null)}>
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[82vh] w-full max-w-[430px] flex-col rounded-t-[32px] bg-white shadow-[0_-18px_44px_rgba(2,6,23,0.22)]"
          >
            <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-[#CBD5E1]" />
            <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-5">
              <div>
                <h2 className="text-[20px] font-black text-[#020617]">Replace Meal</h2>
                {replaceCurrentMeal && (
                  <p className="mt-1 text-[12px] font-semibold text-[#64748B]">
                    Current: {replaceCurrentMeal.name} ({replaceCurrentMeal.calories} cal - {replaceCurrentMeal.protein_g}P)
                  </p>
                )}
              </div>
              <button onClick={() => setReplaceTarget(null)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F6F8FB] ring-1 ring-[#E5EAF1]">
                <X className="h-4 w-4 text-[#64748B]" />
              </button>
            </div>
            <div className="px-4 pb-2">
              <div className="flex items-center gap-1.5 rounded-[18px] bg-[#F6F8FB] px-3 py-2.5 text-[11px] font-black text-[#020617] ring-1 ring-[#E5EAF1]">
                <Shuffle className="h-3.5 w-3.5" /> Closest nutrition matches first
              </div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-8">
              {replaceSimilar.map(({ meal, distance }) => {
                const pct = Math.max(0, Math.round((1 - distance / 2) * 100));
                const isGood = pct >= 80;
                const isOk = pct >= 60;
                const badgeColor = isGood ? "bg-[#EFFFFA] text-[#22C7A1] ring-[#22C7A1]/20" : isOk ? "bg-[#FFF7ED] text-[#F97316] ring-[#FDBA74]/35" : "bg-[#F6F8FB] text-[#64748B] ring-[#E5EAF1]";
                const macroDiff = replaceCurrentMeal
                  ? [
                      { label: "Cal", current: replaceCurrentMeal.calories, after: meal.calories },
                      { label: "P", current: replaceCurrentMeal.protein_g, after: meal.protein_g },
                      { label: "C", current: replaceCurrentMeal.carbs_g, after: meal.carbs_g },
                      { label: "F", current: replaceCurrentMeal.fat_g, after: meal.fat_g },
                    ]
                  : [];
                return (
                  <button
                    key={meal.id}
                    onClick={() => handleReplaceMeal(meal.id)}
                    className="flex w-full items-center gap-3 rounded-[22px] bg-[#F6F8FB] p-3 text-left ring-1 ring-[#E5EAF1] transition-transform active:scale-[0.98]"
                  >
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[18px] bg-white ring-1 ring-[#E5EAF1]">
                      {meal.image_url ? (
                        <img src={meal.image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <UtensilsCrossed className="h-5 w-5 text-[#94A3B8]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-black text-[#020617]">{meal.name}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {macroDiff.map((m) => {
                          const diff = m.after - m.current;
                          const diffSign = diff > 0 ? "+" : "";
                          const diffColor =
                            Math.abs(diff) <= 5
                              ? "text-[#94A3B8]"
                              : diff > 0
                              ? "text-[#F97316]"
                              : "text-[#22C7A1]";
                          return (
                            <span key={m.label} className="text-[9px] font-bold text-[#64748B]">
                              {m.label}:
                              <span className={diffColor}>{m.after}</span>
                              <span className={diffColor}> ({diffSign}{diff})</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black ring-1 ${badgeColor}`}>
                        {pct}% match
                      </span>
                    </div>
                  </button>
                );
              })}
              {replaceSimilar.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-[13px] font-semibold text-[#94A3B8]">No alternative meals available</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {scheduleTarget && (
        <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-[#020617]/45 pb-[env(safe-area-inset-bottom)]" onClick={() => setScheduleTarget(null)}>
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[calc(100dvh-48px)] w-full max-w-[430px] flex-col rounded-t-[32px] bg-white shadow-[0_-18px_44px_rgba(2,6,23,0.22)]"
          >
            <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-[#CBD5E1]" />
            <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-5">
              <div>
                <h2 className="text-[16px] font-black text-[#020617]">Select time</h2>
                <p className="mt-1 text-[13px] font-semibold text-[#64748B]">
                  {scheduleTarget.type} -{" "}
                  {new Date(scheduleTarget.date).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
              <button onClick={() => setScheduleTarget(null)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F6F8FB] ring-1 ring-[#E5EAF1]" aria-label="Close time picker">
                <Clock className="h-5 w-5 text-[#020617]" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+18px)] pt-1">
              {["7:00 AM", "8:00 AM", "9:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "5:00 PM", "6:00 PM", "7:00 PM"].map((slot) => (
                <button
                  key={slot}
                  onClick={() => handleScheduleMeal(slot)}
                  className="flex min-h-[44px] items-center justify-center rounded-[14px] bg-[#F6F8FB] px-2 text-center text-[14px] font-black text-[#020617] ring-1 ring-[#E5EAF1] transition-transform active:scale-[0.98]"
                >
                  {slot}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
