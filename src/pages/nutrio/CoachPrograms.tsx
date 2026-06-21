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

  const { programs, programMeals, programExercises, loading: programsLoading, replaceMeal } =
    useCoachPrograms(coachId, clientId);
  const {
    isExerciseCompleted,
    isMealCompleted,
    toggleExercise,
    toggleMeal,
    loading: completionsLoading,
  } = useProgramCompletions(clientId);

  const [activeTab, setActiveTab] = useState<"meal" | "workout">("meal");
  const [scheduledMeals, setScheduledMeals] = useState<Set<string>>(new Set());
  const [scheduleTarget, setScheduleTarget] = useState<{ id: string; mealId: string; date: string; type: string } | null>(null);

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
    for (const m of allMeals) map[m.id] = m;
    return map;
  }, [allMeals]);

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
      });
      if (error) throw error;
      setScheduledMeals((prev) => new Set(prev).add(scheduleTarget.id));
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7FAF8]">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7FAF8] pb-24">
      <div className="sticky top-0 z-20 bg-[#F7FAF8]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[78px] max-w-[430px] items-center justify-between gap-3 px-4 pt-[env(safe-area-inset-top)]">
          <button
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 shadow-[0_8px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-100 active:scale-95 transition-transform"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2} />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-emerald-600">Coach</p>
            <h1 className="truncate text-[22px] font-black leading-tight text-slate-950">
              My Programs
            </h1>
          </div>
          <button
            onClick={() => navigate("/workout-history")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 shadow-[0_8px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-100 active:scale-95 transition-transform"
            aria-label="Workout history"
          >
            <Clock className="h-5 w-5" />
          </button>
        </div>
      </div>

      {programs.length === 0 ? (
        <div className="mx-auto max-w-[430px] px-4 py-4">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="rounded-[32px] bg-white px-6 py-12 text-center shadow-[0_18px_40px_rgba(15,23,42,0.06)] ring-1 ring-slate-100"
          >
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <ChefHat className="h-8 w-8" />
            </div>
            <h3 className="mb-2 text-[18px] font-black text-slate-950">
              No programs yet
            </h3>
            <p className="text-[13px] font-semibold leading-relaxed text-slate-500">
              Your coach will create meal and workout programs for you.
            </p>
          </motion.div>
        </div>
      ) : (
        <div className="mx-auto max-w-[430px] space-y-4 px-4 py-4">
          <section className="rounded-[32px] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-emerald-600">Active plan</p>
                <h2 className="mt-1 text-[26px] font-black leading-tight text-slate-950">
                  {programs.length} program{programs.length !== 1 ? "s" : ""}
                </h2>
                <p className="mt-2 text-[13px] font-semibold leading-relaxed text-slate-500">
                  Follow your coach's meals and workouts from one place.
                </p>
              </div>
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <ChefHat className="h-7 w-7" />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-emerald-50 px-4 py-3">
                <p className="text-[22px] font-black leading-none text-slate-950">{mealPrograms.length}</p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">Meal plans</p>
              </div>
              <div className="rounded-2xl bg-violet-50 px-4 py-3">
                <p className="text-[22px] font-black leading-none text-slate-950">{workoutPrograms.length}</p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-violet-700">Workouts</p>
              </div>
            </div>
          </section>

          <div className="sticky top-[78px] z-10 flex rounded-full bg-white p-1 shadow-[0_10px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
            <button
              onClick={() => setActiveTab("meal")}
              className={`flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-full px-3 text-[13px] font-black transition-all ${
                activeTab === "meal"
                  ? "bg-emerald-600 text-white shadow-[0_10px_18px_rgba(16,185,129,0.2)]"
                  : "text-slate-500"
              }`}
            >
              <UtensilsCrossed className="h-4 w-4" />
              Meals
            </button>
            <button
              onClick={() => setActiveTab("workout")}
              className={`flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-full px-3 text-[13px] font-black transition-all ${
                activeTab === "workout"
                  ? "bg-violet-600 text-white shadow-[0_10px_18px_rgba(124,58,237,0.2)]"
                  : "text-slate-500"
              }`}
            >
              <Dumbbell className="h-4 w-4" />
              Workouts
            </button>
          </div>

          {activeTab === "meal" &&
            mealPrograms.map((program) => {
              const days = [
                ...new Set(
                  programMeals
                    .filter((m) => m.program_id === program.id)
                    .map((m) => m.assigned_date)
                ),
              ].sort();
              const totalMeals = programMeals.filter(
                (m) => m.program_id === program.id
              ).length;
              const completedMeals = programMeals.filter(
                (m) =>
                  m.program_id === program.id && isMealCompleted(m.id)
              ).length;
              const mealProgress =
                totalMeals > 0
                  ? Math.round((completedMeals / totalMeals) * 100)
                  : 0;
              return (
                <motion.div
                  key={program.id}
                  variants={fadeInUp}
                  initial="hidden"
                  animate="visible"
                  className="rounded-[30px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.055)] ring-1 ring-slate-100"
                >
                  <div className="mb-4 flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                      <UtensilsCrossed className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[18px] font-black leading-tight text-slate-950">
                        {program.title}
                      </h3>
                      <p className="mt-1 text-[11px] font-bold text-slate-400">
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
                    <div className="shrink-0 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-black text-emerald-700">
                      {completedMeals}/{totalMeals}
                    </div>
                  </div>
                  <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${mealProgress}%` }}
                    />
                  </div>
                  <div className="space-y-2.5">
                    {days.slice(0, 7).map((date) => {
                      const dayMeals = programMeals.filter(
                        (m) =>
                          m.program_id === program.id &&
                          m.assigned_date === date
                      );
                      return (
                        <div
                          key={date}
                          className="rounded-[24px] bg-slate-50 p-3"
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-[12px] font-black text-slate-700">
                              {new Date(date).toLocaleDateString("en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })}
                            </p>
                            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-400">
                              {dayMeals.length} meal
                              {dayMeals.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {dayMeals.map((meal) => {
                              const done = isMealCompleted(meal.id);
                              const scheduled = scheduledMeals.has(meal.id);
                              const mealData = mealsById[meal.meal_id];
                              return (
                                <div
                                  key={meal.id}
                                  className="flex min-h-[48px] items-center gap-2 rounded-2xl bg-white px-2.5 py-2 text-[12px]"
                                >
                                  <button
                                    onClick={() => toggleMeal(meal.id)}
                                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all ${
                                      done
                                        ? "bg-emerald-500 text-white"
                                        : "bg-slate-100 text-transparent ring-1 ring-slate-200 hover:ring-emerald-300"
                                    }`}
                                    aria-label="Toggle meal completion"
                                  >
                                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                  </button>
                                  <div className="min-w-0 flex-1">
                                    <span
                                      className={`${
                                        done
                                          ? "text-slate-400 line-through"
                                          : "text-slate-700"
                                      } block truncate font-black`}
                                    >
                                      {mealData?.name || meal.meal_type}
                                    </span>
                                    {mealData && (
                                      <span className="text-[10px] font-bold text-slate-400">
                                        {mealData.calories} cal · {mealData.protein_g}P
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    onClick={() =>
                                      setScheduleTarget({ id: meal.id, mealId: meal.meal_id, date: meal.assigned_date, type: meal.meal_type })
                                    }
                                    disabled={scheduled}
                                    className={`flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-[10px] font-black transition-all ${
                                      scheduled
                                        ? "bg-emerald-100 text-emerald-600"
                                        : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 active:scale-95"
                                    }`}
                                  >
                                    <CalendarPlus className="h-3 w-3" />
                                    {scheduled ? "Added" : "Schedule"}
                                  </button>
                                  <button
                                    onClick={() => setReplaceTarget(meal)}
                                    className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 text-[10px] font-black text-amber-600 transition-all hover:bg-amber-100 active:scale-95"
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
                  </div>
                </motion.div>
              );
            })}

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
                  className="rounded-[30px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.055)] ring-1 ring-slate-100"
                >
                  <div className="mb-4 flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                      <Dumbbell className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[18px] font-black leading-tight text-slate-950">
                        {program.title}
                      </h3>
                      <p className="mt-1 text-[11px] font-bold text-slate-400">
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
                    <div className="shrink-0 rounded-full bg-violet-50 px-3 py-1.5 text-[11px] font-black text-violet-700">
                      {completedExercises}/{totalExercises}
                    </div>
                  </div>
                  <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        workoutProgress >= 80
                          ? "bg-emerald-500"
                          : workoutProgress >= 40
                          ? "bg-amber-400"
                          : "bg-purple-500"
                      }`}
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
                          className="rounded-[24px] bg-slate-50 p-3"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-[12px] font-black text-slate-700">
                              Day {dayNum}
                              <span className="ml-1 text-[10px] font-bold text-slate-400">
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
                                  className="flex h-8 items-center gap-1 rounded-full bg-violet-600 px-3 text-[10px] font-black text-white shadow-[0_8px_16px_rgba(124,58,237,0.18)] transition-transform active:scale-95"
                                >
                                  <Play className="h-3 w-3" />
                                  Start
                                </button>
                              )}
                              {dayCompleted === dayExercises.length &&
                                dayExercises.length > 0 && (
                                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-600">
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
                                  className="flex min-h-[46px] items-center gap-2 rounded-2xl bg-white px-2.5 py-2 text-[12px]"
                                >
                                  <button
                                    onClick={() =>
                                      toggleExercise(exercise.id)
                                    }
                                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all ${
                                      done
                                        ? "bg-violet-500 text-white"
                                        : "bg-slate-100 text-transparent ring-1 ring-slate-200 hover:ring-violet-300"
                                    }`}
                                    aria-label="Toggle exercise completion"
                                  >
                                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                  </button>
                                  <div className="min-w-0 flex-1">
                                    <span
                                      className={`block truncate font-black ${
                                        done
                                          ? "text-slate-400 line-through"
                                          : "text-slate-700"
                                      }`}
                                    >
                                      {exercise.exercise_name}
                                    </span>
                                    <span
                                      className={`text-[10px] font-bold ${
                                        done ? "text-slate-300" : "text-slate-400"
                                      }`}
                                    >
                                      {exercise.sets}x{exercise.reps}
                                      {exercise.notes ? ` · ${exercise.notes}` : ""}
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
        </div>
      )}

      {replaceTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 pb-[env(safe-area-inset-bottom)]" onClick={() => setReplaceTarget(null)}>
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[82vh] w-full max-w-[430px] flex-col rounded-t-[34px] bg-white shadow-[0_-18px_44px_rgba(15,23,42,0.18)]"
          >
            <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-slate-200" />
            <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-5">
              <div>
                <h2 className="text-[20px] font-black text-slate-950">Replace Meal</h2>
                {replaceCurrentMeal && (
                  <p className="mt-1 text-[12px] font-semibold text-slate-400">
                    Current: {replaceCurrentMeal.name} ({replaceCurrentMeal.calories} cal · {replaceCurrentMeal.protein_g}P)
                  </p>
                )}
              </div>
              <button onClick={() => setReplaceTarget(null)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100">
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>
            <div className="px-4 pb-2">
              <div className="flex items-center gap-1.5 rounded-2xl bg-amber-50 px-3 py-2.5 text-[11px] font-black text-amber-700">
                <Shuffle className="h-3.5 w-3.5" /> Closest nutrition matches first
              </div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-8">
              {replaceSimilar.map(({ meal, distance }) => {
                const pct = Math.max(0, Math.round((1 - distance / 2) * 100));
                const isGood = pct >= 80;
                const isOk = pct >= 60;
                const badgeColor = isGood ? "bg-emerald-100 text-emerald-700" : isOk ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600";
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
                    className="flex w-full items-center gap-3 rounded-[22px] bg-slate-50 p-3 text-left transition-transform hover:bg-slate-100 active:scale-[0.98]"
                  >
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white">
                      {meal.image_url ? (
                        <img src={meal.image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <UtensilsCrossed className="h-5 w-5 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-black text-slate-800">{meal.name}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {macroDiff.map((m) => {
                          const diff = m.after - m.current;
                          const diffSign = diff > 0 ? "+" : "";
                          const diffColor =
                            Math.abs(diff) <= 5
                              ? "text-slate-400"
                              : diff > 0
                              ? "text-amber-500"
                              : "text-emerald-600";
                          return (
                            <span key={m.label} className="text-[9px] font-bold text-slate-500">
                              {m.label}:
                              <span className={diffColor}>{m.after}</span>
                              <span className={diffColor}> ({diffSign}{diff})</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black ${badgeColor}`}>
                        {pct}% match
                      </span>
                    </div>
                  </button>
                );
              })}
              {replaceSimilar.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-[13px] font-semibold text-slate-400">No alternative meals available</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {scheduleTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 pb-[env(safe-area-inset-bottom)]" onClick={() => setScheduleTarget(null)}>
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-[430px] flex-col rounded-t-[34px] bg-white shadow-[0_-18px_44px_rgba(15,23,42,0.18)]"
          >
            <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-slate-200" />
            <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-5">
              <div>
                <h2 className="text-[20px] font-black text-slate-950">Select Delivery Time</h2>
                <p className="mt-1 text-[12px] font-semibold text-slate-400">
                  {scheduleTarget.type} ·{" "}
                  {new Date(scheduleTarget.date).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
              <button onClick={() => setScheduleTarget(null)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100">
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>
            <div className="space-y-2 px-4 pb-8">
              {["7:00 AM", "8:00 AM", "9:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "5:00 PM", "6:00 PM", "7:00 PM"].map((slot) => (
                <button
                  key={slot}
                  onClick={() => handleScheduleMeal(slot)}
                  className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl bg-slate-50 px-4 text-left transition-transform hover:bg-slate-100 active:scale-[0.98]"
                >
                  <Clock className="h-4 w-4 text-emerald-500" />
                  <span className="text-[15px] font-black text-slate-800">{slot}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
