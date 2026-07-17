import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface CoachProgram {
  id: string;
  coach_id: string;
  client_id: string;
  title: string;
  description: string | null;
  type: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
}

export interface ProgramMeal {
  id: string;
  program_id: string;
  meal_id: string | null;
  assigned_date: string;
  meal_type: string;
  notes: string | null;
  created_at: string;
}

export interface ProgramExercise {
  id: string;
  program_id: string;
  exercise_catalog_id: string | null;
  exercise_name: string;
  sets: number;
  reps: string;
  rest_seconds: number | null;
  notes: string | null;
  day_number: number;
  order_index: number;
  created_at: string;
}

export interface MealInfo {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  image_url: string | null;
  price: number;
  restaurant_name?: string;
}

export function useCoachPrograms(coachId: string | undefined, clientId: string | undefined, isCoach?: boolean) {
  const [programs, setPrograms] = useState<CoachProgram[]>([]);
  const [programMeals, setProgramMeals] = useState<ProgramMeal[]>([]);
  const [programExercises, setProgramExercises] = useState<ProgramExercise[]>([]);
  const [mealInfos, setMealInfos] = useState<MealInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedKey, setLoadedKey] = useState("");
  const requestKey = coachId && clientId ? `${coachId}:${clientId}` : "";

  const notifyClient = useCallback(async (title: string, message: string, data: Json = {}) => {
    if (!isCoach || !clientId) return;
    try {
      await supabase.from("notifications").insert({
        user_id: clientId,
        type: "general",
        title,
        message,
        data,
        status: "unread",
      });
    } catch (err) {
      console.error("Error sending notification:", err);
    }
  }, [isCoach, clientId]);

  const fetchPrograms = useCallback(async () => {
    if (!coachId || !clientId) {
      setPrograms([]);
      setProgramMeals([]);
      setProgramExercises([]);
      setMealInfos([]);
      setLoadedKey("");
      setLoading(false);
      return;
    }
    const activeRequestKey = `${coachId}:${clientId}`;
    try {
      setLoading(true);
      const { data } = await supabase
        .from("coach_programs")
        .select("*")
        .eq("coach_id", coachId)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      const programsArr = data || [];
      setPrograms(programsArr);

      if (programsArr.length > 0) {
        const programIds = programsArr.map((p) => p.id);
        const [{ data: meals }, { data: exercises }] = await Promise.all([
          supabase.from("program_meals").select("*").in("program_id", programIds).order("assigned_date"),
          supabase.from("program_exercises").select("*").in("program_id", programIds).order("day_number, order_index"),
        ]);
        setProgramMeals(meals || []);
        setProgramExercises(exercises || []);

        const mealIds = [...new Set(
          (meals || [])
            .map((meal) => meal.meal_id)
            .filter((mealId): mealId is string => Boolean(mealId)),
        )];
        if (mealIds.length > 0) {
          const { data: mealsData } = await supabase
            .from("public_meal_catalog" as "meals")
            .select("id, name, calories, protein_g, carbs_g, fat_g, image_url, price, restaurant_name")
            .in("id", mealIds);
          setMealInfos((mealsData as any[] || []).map((m: any) => ({
            id: m.id,
            name: m.name,
            calories: m.calories,
            protein_g: m.protein_g,
            carbs_g: m.carbs_g,
            fat_g: m.fat_g,
            image_url: m.image_url,
            price: m.price,
            restaurant_name: m.restaurant_name,
          })));
        }
      } else {
        setProgramMeals([]);
        setProgramExercises([]);
        setMealInfos([]);
      }
    } catch (err) {
      console.error("Error fetching programs:", err);
    } finally {
      setLoadedKey(activeRequestKey);
      setLoading(false);
    }
  }, [coachId, clientId]);

  const createProgram = useCallback(
    async (data: { title: string; description?: string; type: "meal_plan" | "workout_plan"; start_date: string; end_date: string }) => {
      if (!coachId || !clientId) return { success: false, error: new Error("Missing coach or client ID") };
      try {
        const { data: existing } = await supabase
          .from("coach_programs")
          .select("id, title")
          .eq("coach_id", coachId)
          .eq("client_id", clientId)
          .eq("type", data.type)
          .eq("start_date", data.start_date)
          .maybeSingle();

        if (existing) {
          const kind = data.type === "meal_plan" ? "Meal plan" : "Workout plan";
          return {
            success: false,
            error: new Error(`${kind} already exists for this client starting ${data.start_date}`),
            duplicate: true as const,
          };
        }

        const { data: program, error } = await supabase
          .from("coach_programs")
          .insert({
            coach_id: coachId,
            client_id: clientId,
            title: data.title,
            description: data.description || null,
            type: data.type,
            start_date: data.start_date,
            end_date: data.end_date,
          })
          .select()
          .single();

        if (error) throw error;
        setPrograms((prev) => [program, ...prev]);
        const kind = data.type === "meal_plan" ? "meal" : "workout";
        notifyClient(
          `New ${kind} plan: ${data.title}`,
          `Your coach created a new ${kind} plan for you`,
          { program_id: program.id, type: data.type }
        );
        return { success: true, error: null, data: program };
      } catch (err) {
        console.error("Error creating program:", err);
        return { success: false, error: err as Error };
      }
    },
    [coachId, clientId, notifyClient]
  );

  const updateProgram = useCallback(
    async (programId: string, updates: { title?: string; description?: string; start_date?: string; end_date?: string; status?: "active" | "completed" | "cancelled" }) => {
      try {
        const { data, error } = await supabase
          .from("coach_programs")
          .update(updates)
          .eq("id", programId)
          .select()
          .single();

        if (error) throw error;
        setPrograms((prev) => prev.map((p) => (p.id === programId ? { ...p, ...data } : p)));
        return { success: true, error: null, data };
      } catch (err) {
        console.error("Error updating program:", err);
        return { success: false, error: err as Error };
      }
    },
    []
  );

  const assignMeal = useCallback(
    async (programId: string, mealId: string, assignedDate: string, mealType: string, notes?: string) => {
      try {
        const { data, error } = await supabase
          .from("program_meals")
          .insert({
            program_id: programId,
            meal_id: mealId,
            assigned_date: assignedDate,
            meal_type: mealType,
            notes: notes || null,
          })
          .select()
          .single();

        if (error) throw error;
        setProgramMeals((prev) => [...prev, data]);
        notifyClient(
          `${mealType} meal added for ${assignedDate}`,
          `Your coach added a ${mealType} meal to your plan`,
          { program_id: programId, meal_id: mealId, assigned_date: assignedDate }
        );
        return data;
      } catch (err) {
        console.error("Error assigning meal:", err);
        throw err;
      }
    },
    [notifyClient]
  );

  const updateMeal = useCallback(async (programMealId: string, mealId: string) => {
    try {
      const { data, error } = await supabase
        .from("program_meals")
        .update({ meal_id: mealId })
        .eq("id", programMealId)
        .select()
        .single();

      if (error) throw error;
      setProgramMeals((prev) => prev.map((m) => (m.id === programMealId ? { ...m, ...data } : m)));
      return data;
    } catch (err) {
      console.error("Error updating meal:", err);
      throw err;
    }
  }, []);

  const removeMeal = useCallback(async (programMealId: string) => {
    try {
      const { error } = await supabase.from("program_meals").delete().eq("id", programMealId);
      if (error) throw error;
      setProgramMeals((prev) => prev.filter((m) => m.id !== programMealId));
    } catch (err) {
      console.error("Error removing meal:", err);
    }
  }, []);

  const replaceMeal = useCallback(
    async (programMealId: string, originalMeal: ProgramMeal, newMealId: string) => {
      try {
        const { error: delErr } = await supabase.from("program_meals").delete().eq("id", programMealId);
        if (delErr) throw delErr;
        const { data, error: insErr } = await supabase
          .from("program_meals")
          .insert({
            program_id: originalMeal.program_id,
            meal_id: newMealId,
            assigned_date: originalMeal.assigned_date,
            meal_type: originalMeal.meal_type,
            notes: originalMeal.notes,
          })
          .select()
          .single();
        if (insErr) throw insErr;
        setProgramMeals((prev) => prev.filter((m) => m.id !== programMealId));
        if (data) setProgramMeals((prev) => [...prev, data]);
      } catch (err) {
        console.error("Error replacing meal:", err);
        throw err;
      }
    },
    []
  );

  const assignExercise = useCallback(
    async (programId: string, exercise: { exercise_catalog_id?: string | null; exercise_name: string; sets: number; reps: string; rest_seconds?: number; notes?: string; day_number: number; order_index: number }) => {
      try {
        const { data, error } = await supabase
          .from("program_exercises")
          .insert({
            program_id: programId,
            exercise_catalog_id: exercise.exercise_catalog_id || null,
            exercise_name: exercise.exercise_name,
            sets: exercise.sets,
            reps: exercise.reps,
            rest_seconds: exercise.rest_seconds || 60,
            notes: exercise.notes || null,
            day_number: exercise.day_number,
            order_index: exercise.order_index,
          })
          .select()
          .single();

        if (error) throw error;
        setProgramExercises((prev) => [...prev, data]);
        notifyClient(
          `New exercise: ${exercise.exercise_name}`,
          `${exercise.sets}×${exercise.reps} added to Day ${exercise.day_number} of your workout`,
          { program_id: programId, exercise_name: exercise.exercise_name, day_number: exercise.day_number }
        );
        return data;
      } catch (err) {
        console.error("Error assigning exercise:", err);
        throw err;
      }
    },
    [notifyClient]
  );

  const updateExercise = useCallback(async (programExerciseId: string, updates: { exercise_catalog_id?: string | null; exercise_name?: string; sets?: number; reps?: string; rest_seconds?: number; notes?: string; day_number?: number; order_index?: number }) => {
    try {
      const { data, error } = await supabase
        .from("program_exercises")
        .update(updates)
        .eq("id", programExerciseId)
        .select()
        .single();

      if (error) throw error;
      setProgramExercises((prev) => prev.map((e) => (e.id === programExerciseId ? { ...e, ...data } : e)));
      return data;
    } catch (err) {
      console.error("Error updating exercise:", err);
      throw err;
    }
  }, []);

  const removeExercise = useCallback(async (programExerciseId: string) => {
    try {
      const { error } = await supabase.from("program_exercises").delete().eq("id", programExerciseId);
      if (error) throw error;
      setProgramExercises((prev) => prev.filter((e) => e.id !== programExerciseId));
    } catch (err) {
      console.error("Error removing exercise:", err);
    }
  }, []);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  return {
    programs,
    programMeals,
    programExercises,
    mealInfos,
    loading: loading || Boolean(requestKey && loadedKey !== requestKey),
    createProgram,
    updateProgram,
    assignMeal,
    updateMeal,
    removeMeal,
    replaceMeal,
    assignExercise,
    updateExercise,
    removeExercise,
    refresh: fetchPrograms,
  };
}
