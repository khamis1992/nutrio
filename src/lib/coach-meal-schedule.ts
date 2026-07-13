import { supabase } from "@/integrations/supabase/client";

type CoachMealStatus = "followed" | "replaced";

type MealMacro = {
  id: string;
  name: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

export type CoachMealSuggestionContext = {
  programMealId: string;
  coachProgramId: string;
  suggestedMealId: string;
  suggestedMealName: string;
  status: CoachMealStatus;
  macroDelta: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
};

type FindCoachMealSuggestionParams = {
  userId: string;
  scheduledDate: string;
  mealType: string;
  selectedMealId: string;
};

const numberValue = (value: number | null | undefined) => Number(value ?? 0);

const calculateMacroDelta = (selected?: MealMacro, suggested?: MealMacro) => ({
  calories: numberValue(selected?.calories) - numberValue(suggested?.calories),
  protein_g: numberValue(selected?.protein_g) - numberValue(suggested?.protein_g),
  carbs_g: numberValue(selected?.carbs_g) - numberValue(suggested?.carbs_g),
  fat_g: numberValue(selected?.fat_g) - numberValue(suggested?.fat_g),
});

export async function findCoachMealSuggestion({
  userId,
  scheduledDate,
  mealType,
  selectedMealId,
}: FindCoachMealSuggestionParams): Promise<CoachMealSuggestionContext | null> {
  const { data: programs, error: programsError } = await supabase
    .from("coach_programs")
    .select("id")
    .eq("client_id", userId)
    .eq("type", "meal_plan")
    .eq("status", "active")
    .lte("start_date", scheduledDate)
    .gte("end_date", scheduledDate);

  if (programsError) throw programsError;

  const programIds = programs?.map((program) => program.id) ?? [];
  if (!programIds.length) return null;

  const { data: suggestions, error: suggestionsError } = await supabase
    .from("program_meals")
    .select("id, program_id, meal_id")
    .in("program_id", programIds)
    .eq("assigned_date", scheduledDate)
    .eq("meal_type", mealType)
    .not("meal_id", "is", null)
    .limit(1);

  if (suggestionsError) throw suggestionsError;

  const suggestion = suggestions?.find((item) => item.meal_id);
  if (!suggestion?.meal_id) return null;

  const mealIds = [...new Set([selectedMealId, suggestion.meal_id])];
  const { data: meals, error: mealsError } = await supabase
    .from("meals")
    .select("id, name, calories, protein_g, carbs_g, fat_g")
    .in("id", mealIds);

  if (mealsError) throw mealsError;

  const selectedMeal = meals?.find((item) => item.id === selectedMealId) as MealMacro | undefined;
  const suggestedMeal = meals?.find((item) => item.id === suggestion.meal_id) as MealMacro | undefined;

  return {
    programMealId: suggestion.id,
    coachProgramId: suggestion.program_id,
    suggestedMealId: suggestion.meal_id,
    suggestedMealName: suggestedMeal?.name ?? "Coach meal",
    status: selectedMealId === suggestion.meal_id ? "followed" : "replaced",
    macroDelta: calculateMacroDelta(selectedMeal, suggestedMeal),
  };
}

export function getCoachMealScheduleFields(context: CoachMealSuggestionContext | null) {
  if (!context) return {};

  return {
    schedule_source: context.status === "followed"
      ? ("coach_program" as const)
      : ("coach_replacement" as const),
    coach_program_id: context.coachProgramId,
    program_meal_id: context.programMealId,
    coach_suggested_meal_id: context.suggestedMealId,
    coach_replacement_status: context.status,
    coach_replacement_delta: context.macroDelta,
  };
}
