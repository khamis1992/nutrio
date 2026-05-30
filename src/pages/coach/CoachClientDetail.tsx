import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, CalendarCheck, Target, TrendingDown, TrendingUp, Minus,
  Flame, Loader2, UtensilsCrossed, Clock, ChefHat, AlertCircle, Pencil,
  Lock, Plus, Check, X, Ruler, Camera, Dumbbell, Flag, FileDown,
  ChevronDown, ChevronUp, Search, Trash2, Sun, Moon, Cookie, Zap,
  GripVertical, Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EditClientTargetsModal } from "@/components/coach/EditClientTargetsModal";
import { useCoachNotes } from "@/hooks/useCoachNotes";
import { useBodyMeasurements } from "@/hooks/useBodyMeasurements";
import { useGoalProposals } from "@/hooks/useGoalProposals";
import { useCoachPrograms } from "@/hooks/useCoachPrograms";
import { useClientCompletionStats } from "@/hooks/useClientCompletionStats";
import { useWorkoutAdherence } from "@/hooks/useWorkoutAdherence";
import { useCoachReport } from "@/hooks/useCoachReport";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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

const fadeInUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 24 } },
};

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  const coachId = user?.id;
  const { notes, loading: notesLoading, addNote, updateNote, deleteNote } = useCoachNotes(coachId, clientId);
  const { measurements, photos, loading: measurementsLoading, uploadPhoto } = useBodyMeasurements(clientId);
  const { proposals, proposeGoal, acceptGoal, rejectGoal, completeGoal } = useGoalProposals(coachId, clientId);
  const { programs, programMeals, programExercises, mealInfos, createProgram, updateProgram, assignMeal, updateMeal, removeMeal, assignExercise, updateExercise, removeExercise } = useCoachPrograms(coachId, clientId, true);
  const { getExerciseStat, getMealStat } = useClientCompletionStats(clientId);
  const { weekAdherence, alerts: workoutAlerts, overallWeeklyPct, loading: adherenceLoading, getExerciseWeightHistory, getExerciseTrend } = useWorkoutAdherence(clientId);
  const { generating, generateReport } = useCoachReport();
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
  // Meal plan builder state
  const [mealPlanTitle, setMealPlanTitle] = useState("");
  const [mealPlanStartDate, setMealPlanStartDate] = useState("");
  const [mealPlanEndDate, setMealPlanEndDate] = useState("");
  const [mealPlanProgramId, setMealPlanProgramId] = useState<string | null>(null);
  const [mealPlanStep, setMealPlanStep] = useState<"create" | "assign">("create");
  const [selectedMealDate, setSelectedMealDate] = useState("");
  const [selectedMealType, setSelectedMealType] = useState("lunch");
  const [selectedMealId, setSelectedMealId] = useState("");
  const [availableMeals, setAvailableMeals] = useState<{ id: string; name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; image_url: string | null; price: number; restaurant_name?: string }[]>([]);
  // Workout builder state
  const [workoutPlanTitle, setWorkoutPlanTitle] = useState("");
  const [workoutPlanStartDate, setWorkoutPlanStartDate] = useState("");
  const [workoutPlanEndDate, setWorkoutPlanEndDate] = useState("");
  const [workoutProgramId, setWorkoutProgramId] = useState<string | null>(null);
  const [workoutStep, setWorkoutStep] = useState<"create" | "assign">("create");
  const [exerciseName, setExerciseName] = useState("");
  const [exerciseSets, setExerciseSets] = useState(3);
  const [exerciseReps, setExerciseReps] = useState("10");
  const [exerciseRest, setExerciseRest] = useState(60);
  const [exerciseDayNumber, setExerciseDayNumber] = useState(1);
  const [exerciseOrderIndex, setExerciseOrderIndex] = useState(0);
  const [photoInputRef] = useState<React.RefObject<HTMLInputElement>>({ current: null });
  const fileInputRef = { current: null };
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
        setWeights(weightData.map(w => ({ log_date: w.log_date, weight_kg: w.weight_kg })));
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

  const lastWeight = weights.length > 0 ? weights[weights.length - 1].weight_kg : null;
  const weightIcon = weightTrend === null ? null : weightTrend < 0 ? TrendingDown : weightTrend > 0 ? TrendingUp : Minus;
  const weightColor = weightTrend === null ? "text-slate-400" : weightTrend < 0 ? "text-emerald-500" : weightTrend > 0 ? "text-red-500" : "text-slate-400";

  const adherenceColor = overallAdherence >= 80 ? "text-emerald-600" : overallAdherence >= 50 ? "text-amber-600" : "text-red-500";

  return (
    <div className="space-y-5">
      {/* Back button + Header */}
      <div className="flex items-center gap-3">
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
          className="flex items-center gap-1.5 h-[34px] px-3 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600 hover:bg-slate-200 active:scale-95 transition-all ml-auto"
        >
          <FileDown className="w-3.5 h-3.5" />
          Export Report
        </button>
      )}

      {/* Macro Compliance Ring */}
      {profile.daily_calorie_target && (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
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
      {adherenceDays.length > 0 && (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
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
      {weights.length > 0 && (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
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
              {weightIcon && <weightIcon className={cn("w-4 h-4", weightColor)} />}
              <span className={cn("text-[12px] font-semibold", weightColor)}>
                7-day change: {weightTrend > 0 ? "+" : ""}{weightTrend} kg
              </span>
            </div>
          )}
        </motion.div>
      )}

      {/* Upcoming Meals */}
      {meals.length > 0 && (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
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
      {meals.length === 0 && (
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
        </motion.div>
      )}

      {/* Private Notes Section */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
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

      {/* Body Measurements Section */}
      <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="bg-white rounded-[24px] shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80 overflow-hidden">
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
          <div className="px-5 py-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
              <Ruler className="w-7 h-7 text-slate-300" />
            </div>
            <p className="text-[13px] font-semibold text-slate-500">No measurements recorded</p>
            <p className="text-[11px] text-slate-400 mt-1">Measurements will appear once the client logs their first entry</p>
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
                      {weightIcon && <weightIcon className={cn("w-3 h-3", weightColor)} />}
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

            {/* Progress photos */}
            {photos.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Progress Photos</span>
                  <span className="text-[10px] font-semibold text-slate-400">{photos.length}</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {photos.slice(0, 8).map((p, i) => (
                    <div key={p.id} className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 ring-1 ring-slate-100">
                      <img src={p.url} alt="" className="w-full h-full object-cover" />
                      {i === 0 && (
                        <div className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>

      <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80">
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

      {/* Program Builder Section */}
      <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80">
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
          onClick={() => programTab === "meal" ? setMealBuilderOpen(true) : setWorkoutBuilderOpen(true)}
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
                  className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all", editingProgramId === p.id ? "bg-emerald-100 text-emerald-600" : "text-slate-300 hover:text-slate-500 hover:bg-slate-100")}
                >
                  <Pencil className="w-3.5 h-3.5" />
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
                                        supabase.from("meals").select("id, name, calories, protein_g, carbs_g, fat_g, image_url, price, is_available, restaurants:restaurant_id(name)").eq("is_available", true).order("name").limit(200).then(({ data: meals }) => {
                                          setAvailableMeals((meals as any[] || []).map((m: any) => ({ id: m.id, name: m.name, calories: m.calories, protein_g: m.protein_g, carbs_g: m.carbs_g, fat_g: m.fat_g, image_url: m.image_url, price: m.price, restaurant_name: m.restaurants?.name })));
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
                              return (
                              <div key={ex.id} className="bg-purple-50/50 rounded-lg px-2 py-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-black text-purple-400 w-3 shrink-0">{i + 1}</span>
                                  <span className="text-[11px] text-slate-700 flex-1 truncate">{ex.exercise_name}</span>
                                  <span className="text-[10px] text-slate-500 font-mono shrink-0">{ex.sets}×{ex.reps}</span>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${completionColor}`}>
                                    {completed}× done
                                  </span>
                                  <button
                                    onClick={() => {
                                      setWorkoutBuilderOpen(true);
                                      setWorkoutProgramId(p.id);
                                      setWorkoutStep("assign");
                                      setWorkoutPlanTitle(p.title);
                                      setWorkoutPlanStartDate(p.start_date);
                                      setWorkoutPlanEndDate(p.end_date);
                                      setSelectedWorkoutDay(ex.day_number);
                                      setEditingExerciseId(ex.id);
                                      setExerciseName(ex.exercise_name);
                                      setExerciseSets(ex.sets);
                                      setExerciseReps(ex.reps);
                                      setExerciseRest(ex.rest_seconds);
                                    }}
                                    className="text-slate-300 hover:text-purple-500 transition-colors shrink-0"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => removeExercise(ex.id)} className="text-slate-300 hover:text-red-500 transition-colors shrink-0"><Trash2 className="w-3 h-3" /></button>
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

      {/* Workout Adherence Card */}
      {programTab === "workout" && (
        <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80 mt-4">
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
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-md bg-white rounded-[28px] shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div>
                <h2 className="text-[17px] font-extrabold text-slate-950">
                  {mealPlanStep === "create" ? "New Meal Plan" : mealPlanTitle}
                </h2>
                <p className="text-[11px] text-slate-400">
                  {mealPlanStep === "create" ? "Set up your client's nutrition program" : <>{programMeals.filter((m) => m.program_id === mealPlanProgramId).length} meals assigned {clientSub && !clientSub.isUnlimited && <span className="text-amber-500 font-bold">· {Math.max(0, clientSub.remainingMeals - programMeals.length)} of {clientSub.totalMeals} remaining</span>}</>}
                </p>
              </div>
              <button onClick={() => { setMealBuilderOpen(false); setMealPlanStep("create"); setMealPlanProgramId(null); setMealSearch(""); }} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"><X className="w-4 h-4 text-slate-500" /></button>
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
                      const { data: meals } = await supabase.from("meals").select("id, name, calories, protein_g, carbs_g, fat_g, image_url, price, is_available, restaurants:restaurant_id(name)").eq("is_available", true).order("name").limit(200);
                      setAvailableMeals((meals as any[] || []).map((m: any) => ({ id: m.id, name: m.name, calories: m.calories, protein_g: m.protein_g, carbs_g: m.carbs_g, fat_g: m.fat_g, image_url: m.image_url, price: m.price, restaurant_name: m.restaurants?.name })));
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
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-md bg-white rounded-[28px] shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div>
                <h2 className="text-[17px] font-extrabold text-slate-950">
                  {workoutStep === "create" ? "New Workout Plan" : workoutPlanTitle}
                </h2>
                <p className="text-[11px] text-slate-400">
                  {workoutStep === "create" ? "Build a training program" : "Add exercises for each day"}
                </p>
              </div>
              <button onClick={() => { setWorkoutBuilderOpen(false); setWorkoutStep("create"); setWorkoutProgramId(null); setEditingExerciseId(null); }} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"><X className="w-4 h-4 text-slate-500" /></button>
            </div>

            {workoutStep === "create" ? (
              <div className="px-5 pb-5 space-y-4">
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
                <button
                  onClick={async () => {
                    if (!workoutPlanTitle.trim() || !workoutPlanStartDate || !workoutPlanEndDate) return;
                    setCreatingProgram(true);
                    const result = await createProgram({ title: workoutPlanTitle.trim(), type: "workout_plan", start_date: workoutPlanStartDate, end_date: workoutPlanEndDate });
                    if (result.success && result.data) {
                      setWorkoutProgramId(result.data.id);
                      setWorkoutStep("assign");
                    } else if (!result.success && result.error) {
                      toast.error(result.error.message);
                    }
                    setCreatingProgram(false);
                  }}
                  disabled={!workoutPlanTitle.trim() || !workoutPlanStartDate || !workoutPlanEndDate || creatingProgram}
                  className="w-full h-[52px] rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[14px] font-bold shadow-lg shadow-purple-600/20 disabled:opacity-40 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
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
                          className={cn("flex-shrink-0 w-[52px] h-[52px] rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all", selectedWorkoutDay === d ? "bg-purple-600 text-white shadow-md shadow-purple-600/20" : "bg-slate-100 text-slate-500")}
                        >
                          <span className="text-[9px] font-bold uppercase">Day</span>
                          <span className="text-[16px] font-extrabold leading-none">{d}</span>
                          {dayExercises.length > 0 && <div className={cn("w-1 h-1 rounded-full", selectedWorkoutDay === d ? "bg-white" : "bg-purple-400")} />}
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
                    return (
                      <div className="space-y-2.5">
                        {dayExercises.length === 0 && (
                          <div className="py-8 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-purple-50 mx-auto mb-3 flex items-center justify-center">
                              <Dumbbell className="w-6 h-6 text-purple-300" />
                            </div>
                            <p className="text-[12px] text-slate-400">No exercises for Day {selectedWorkoutDay}</p>
                            <p className="text-[10px] text-slate-300">Add one below</p>
                          </div>
                        )}
                        {dayExercises.map((ex, i) => (
                          <motion.div key={ex.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className={cn("flex items-center gap-3 p-3 rounded-2xl ring-1", editingExerciseId === ex.id ? "bg-purple-100 ring-purple-300" : "bg-purple-50/60 ring-purple-100")}>
                            <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-black text-purple-600">{i + 1}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-bold text-slate-800">{ex.exercise_name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-semibold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded-md">{ex.sets} sets</span>
                                <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded-md">{ex.reps} reps</span>
                                <span className="text-[10px] text-slate-400">{ex.rest_seconds}s rest</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => {
                                  setEditingExerciseId(ex.id);
                                  setExerciseName(ex.exercise_name);
                                  setExerciseSets(ex.sets);
                                  setExerciseReps(ex.reps);
                                  setExerciseRest(ex.rest_seconds);
                                }}
                                className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-slate-300 hover:text-purple-600 hover:bg-purple-50 transition-all shrink-0"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => removeExercise(ex.id)} className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all shrink-0">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </motion.div>
                        ))}

                        <div className="mt-4 p-4 rounded-2xl bg-slate-50 ring-1 ring-slate-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{editingExerciseId ? "Edit Exercise" : "Add Exercise"}</p>
                            {editingExerciseId && (
                              <button
                                onClick={() => {
                                  setEditingExerciseId(null);
                                  setExerciseName("");
                                  setExerciseSets(3);
                                  setExerciseReps("10");
                                  setExerciseRest(60);
                                }}
                                className="text-[10px] font-semibold text-slate-400 hover:text-slate-600"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                          <input type="text" value={exerciseName} onChange={(e) => setExerciseName(e.target.value)} placeholder="Exercise name (e.g. Bench Press)" className="w-full h-[44px] px-4 rounded-xl bg-white border border-slate-200 text-[13px] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500" />
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
                          <button
                            onClick={async () => {
                              if (!workoutProgramId || !exerciseName.trim()) return;
                              if (editingExerciseId) {
                                await updateExercise(editingExerciseId, {
                                  exercise_name: exerciseName.trim(),
                                  sets: exerciseSets,
                                  reps: exerciseReps,
                                  rest_seconds: exerciseRest,
                                });
                                setEditingExerciseId(null);
                              } else {
                                await assignExercise(workoutProgramId, {
                                  exercise_name: exerciseName.trim(),
                                  sets: exerciseSets,
                                  reps: exerciseReps,
                                  rest_seconds: exerciseRest,
                                  day_number: selectedWorkoutDay,
                                  order_index: programExercises.filter((e) => e.program_id === workoutProgramId && e.day_number === selectedWorkoutDay).length,
                                });
                              }
                              setExerciseName("");
                              setExerciseSets(3);
                              setExerciseReps("10");
                              setExerciseRest(60);
                            }}
                            disabled={!exerciseName.trim()}
                            className="w-full h-[44px] rounded-xl bg-purple-600 text-white text-[13px] font-bold hover:bg-purple-700 disabled:opacity-40 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                          >
                            {editingExerciseId ? <><Pencil className="w-4 h-4" /> Update Exercise</> : <><Plus className="w-4 h-4" /> Add to Day {selectedWorkoutDay}</>}
                          </button>
                        </div>

                        <button onClick={() => { setWorkoutBuilderOpen(false); setWorkoutStep("create"); setWorkoutProgramId(null); setEditingExerciseId(null); }} className="w-full h-[48px] rounded-2xl bg-slate-100 text-slate-600 text-[13px] font-bold hover:bg-slate-200 active:scale-[0.98] transition-all mt-2">
                          Done
                        </button>
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
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="w-full max-w-md bg-white rounded-[24px] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[16px] font-extrabold text-slate-950">Propose a Goal</h2>
                <p className="text-[11px] text-slate-500">Set a target for this client</p>
              </div>
              <button onClick={() => setGoalModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <GoalProposalForm onPropose={async (data) => { await proposeGoal(data); setGoalModalOpen(false); }} />
          </motion.div>
        </div>
      )}

      {/* Export Report Modal */}
      {reportModalOpen && profile && clientId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 pb-24">
          <motion.div initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="w-full max-w-md bg-white rounded-[24px] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[16px] font-extrabold text-slate-950">Export Progress Report</h2>
                <p className="text-[11px] text-slate-500">Generate a comprehensive PDF for {profile.full_name || "client"}</p>
              </div>
              <button onClick={() => setReportModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><X className="w-4 h-4 text-slate-500" /></button>
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
    </div>
  );
}
