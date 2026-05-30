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
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCoachPrograms, ProgramMeal } from "@/hooks/useCoachPrograms";
import { useProgramCompletions } from "@/hooks/useProgramCompletions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
          data.map((m: any) => ({
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
        <div className="w-10" />
        <h1 className="text-[16px] font-extrabold text-slate-950 text-center">
          My Programs
        </h1>
        <button
          onClick={() => navigate("/workout-history")}
          className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center active:scale-95 transition-transform"
        >
          <Clock className="w-4 h-4 text-slate-600" />
        </button>
      </div>

      {programs.length === 0 ? (
        <div className="p-4">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="bg-white rounded-[24px] p-12 text-center shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
          >
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <ChefHat className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-[15px] font-bold text-slate-900 mb-2">
              No programs yet
            </h3>
            <p className="text-[12px] text-slate-500">
              Your coach will create meal and workout programs for you.
            </p>
          </motion.div>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          <div className="flex bg-white rounded-2xl p-1 shadow-sm ring-1 ring-slate-100">
            <button
              onClick={() => setActiveTab("meal")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[13px] font-semibold transition-all ${
                activeTab === "meal"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-500"
              }`}
            >
              <UtensilsCrossed className="w-4 h-4" />
              Meal Plans ({mealPrograms.length})
            </button>
            <button
              onClick={() => setActiveTab("workout")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[13px] font-semibold transition-all ${
                activeTab === "workout"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-slate-500"
              }`}
            >
              <Dumbbell className="w-4 h-4" />
              Workouts ({workoutPrograms.length})
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
                  className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-[15px] font-extrabold text-slate-950">
                        {program.title}
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        {new Date(program.start_date).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" }
                        )}{" "}
                        &rarr;{" "}
                        {new Date(program.end_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="px-3 py-1.5 rounded-full bg-emerald-50 text-[11px] font-bold text-emerald-600">
                      {completedMeals}/{totalMeals} done
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 mb-3 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${mealProgress}%` }}
                    />
                  </div>
                  <div className="space-y-2">
                    {days.slice(0, 7).map((date) => {
                      const dayMeals = programMeals.filter(
                        (m) =>
                          m.program_id === program.id &&
                          m.assigned_date === date
                      );
                      return (
                        <div
                          key={date}
                          className="border border-slate-100 rounded-2xl p-3"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[11px] font-bold text-slate-500">
                              {new Date(date).toLocaleDateString("en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })}
                            </p>
                            <span className="text-[10px] text-slate-400">
                              {dayMeals.length} meal
                              {dayMeals.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="space-y-1">
                            {dayMeals.map((meal) => {
                              const done = isMealCompleted(meal.id);
                              const scheduled = scheduledMeals.has(meal.id);
                              const mealData = mealsById[meal.meal_id];
                              return (
                                <div
                                  key={meal.id}
                                  className="flex items-center gap-2 text-[12px]"
                                >
                                  <button
                                    onClick={() => toggleMeal(meal.id)}
                                    className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-all ${
                                      done
                                        ? "bg-emerald-500 text-white"
                                        : "border border-slate-300 text-transparent hover:border-emerald-400"
                                    }`}
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <span
                                      className={`${
                                        done
                                          ? "text-slate-400 line-through"
                                          : "text-slate-700"
                                      } font-medium`}
                                    >
                                      {mealData?.name || meal.meal_type}
                                    </span>
                                    {mealData && (
                                      <span className="text-[10px] text-slate-400 ml-1.5">
                                        {mealData.calories}cal &middot; {mealData.protein_g}P
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    onClick={() =>
                                      setScheduleTarget({ id: meal.id, mealId: meal.meal_id, date: meal.assigned_date, type: meal.meal_type })
                                    }
                                    disabled={scheduled}
                                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all shrink-0 ${
                                      scheduled
                                        ? "bg-emerald-100 text-emerald-600"
                                        : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 active:scale-95"
                                    }`}
                                  >
                                    <CalendarPlus className="w-3 h-3" />
                                    {scheduled ? "Added" : "Schedule"}
                                  </button>
                                  <button
                                    onClick={() => setReplaceTarget(meal)}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-600 hover:bg-amber-100 active:scale-95 transition-all shrink-0"
                                  >
                                    <Shuffle className="w-3 h-3" />
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
                  className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-[15px] font-extrabold text-slate-950">
                        {program.title}
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        {new Date(program.start_date).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" }
                        )}{" "}
                        &rarr;{" "}
                        {new Date(program.end_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="px-3 py-1.5 rounded-full bg-purple-50 text-[11px] font-bold text-purple-600">
                      {completedExercises}/{totalExercises} done
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 mb-3 overflow-hidden">
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
                  <div className="space-y-2">
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
                          className="border border-slate-100 rounded-2xl p-3"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[11px] font-bold text-slate-500">
                              Day {dayNum} ({dayExercises.length} exercise
                              {dayExercises.length !== 1 ? "s" : ""})
                            </p>
                            <div className="flex items-center gap-2">
                              {dayExercises.length > 0 && (
                                <button
                                  onClick={() =>
                                    navigate(
                                      `/coach-programs/workout/${program.id}/day/${dayNum}`
                                    )
                                  }
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-50 text-[10px] font-bold text-purple-600 hover:bg-purple-100 transition-colors"
                                >
                                  <Play className="w-3 h-3" />
                                  Start
                                </button>
                              )}
                              {dayCompleted === dayExercises.length &&
                                dayExercises.length > 0 && (
                                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                    &check; Complete
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
                                  className="flex items-center gap-2 text-[12px]"
                                >
                                  <button
                                    onClick={() =>
                                      toggleExercise(exercise.id)
                                    }
                                    className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-all ${
                                      done
                                        ? "bg-purple-500 text-white"
                                        : "border border-slate-300 text-transparent hover:border-purple-400"
                                    }`}
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <span
                                    className={`font-medium ${
                                      done
                                        ? "text-slate-400 line-through"
                                        : "text-slate-700"
                                    }`}
                                  >
                                    {exercise.exercise_name}
                                  </span>
                                  <span
                                    className={`text-[11px] ${
                                      done ? "text-slate-300" : "text-slate-400"
                                    }`}
                                  >
                                    {exercise.sets}&times;{exercise.reps}
                                  </span>
                                  {exercise.notes && (
                                    <span className="text-slate-400 text-[10px] truncate">
                                      ({exercise.notes})
                                    </span>
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
              );
            })}
        </div>
      )}

      {replaceTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center pb-24" onClick={() => setReplaceTarget(null)}>
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-t-[28px] max-h-[75vh] flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
              <div>
                <h2 className="text-[16px] font-extrabold text-slate-950">Replace Meal</h2>
                {replaceCurrentMeal && (
                  <p className="text-[11px] text-slate-400">
                    Current: {replaceCurrentMeal.name} ({replaceCurrentMeal.calories}cal &middot; {replaceCurrentMeal.protein_g}P)
                  </p>
                )}
              </div>
              <button onClick={() => setReplaceTarget(null)} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="px-4 pb-2">
              <div className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 rounded-xl text-[10px] font-semibold text-amber-700">
                <Shuffle className="w-3 h-3" /> Similar meals by nutrition profile &mdash; closest match first
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-20 space-y-2">
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
                    className="w-full bg-slate-50 rounded-2xl p-3 flex items-center gap-3 text-left active:scale-[0.98] transition-transform hover:bg-slate-100"
                  >
                    <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shrink-0 overflow-hidden">
                      {meal.image_url ? (
                        <img src={meal.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <UtensilsCrossed className="w-5 h-5 text-slate-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-slate-800 truncate">{meal.name}</p>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
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
                            <span key={m.label} className="text-[9px] text-slate-500">
                              {m.label}:
                              <span className={diffColor}>{m.after}</span>
                              <span className={diffColor}> ({diffSign}{diff})</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>
                        {pct}% match
                      </span>
                    </div>
                  </button>
                );
              })}
              {replaceSimilar.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-[13px] text-slate-400">No alternative meals available</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {scheduleTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center pb-24" onClick={() => setScheduleTarget(null)}>
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-t-[28px] flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
              <div>
                <h2 className="text-[16px] font-extrabold text-slate-950">Select Delivery Time</h2>
                <p className="text-[11px] text-slate-400">
                  {scheduleTarget.type} &middot;{" "}
                  {new Date(scheduleTarget.date).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
              <button onClick={() => setScheduleTarget(null)} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="px-4 pb-20 space-y-2">
              {["7:00 AM", "8:00 AM", "9:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "5:00 PM", "6:00 PM", "7:00 PM"].map((slot) => (
                <button
                  key={slot}
                  onClick={() => handleScheduleMeal(slot)}
                  className="w-full bg-slate-50 rounded-2xl p-3 flex items-center gap-3 text-left active:scale-[0.98] transition-transform hover:bg-slate-100"
                >
                  <Clock className="w-4 h-4 text-emerald-500" />
                  <span className="text-[14px] font-bold text-slate-800">{slot}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
