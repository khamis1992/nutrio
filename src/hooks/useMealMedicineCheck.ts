import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface MedicineInteraction {
  interaction_id: string;
  active_ingredient: string;
  medication_name: string;
  food_ingredient: string;
  severity: "mild" | "moderate" | "severe";
  description: string;
  recommendation: string;
}

export interface UserMedication {
  id: string;
  medication_name: string;
  active_ingredient: string;
  dosage: string | null;
  frequency: string | null;
  notes: string | null;
  created_at: string;
}

async function fetchMealInteractions(userId: string, mealId: string): Promise<MedicineInteraction[]> {
  const { data, error } = await supabase.rpc("check_meal_interactions", {
    p_user_id: userId,
    p_meal_id: mealId,
  });
  if (error) throw error;
  return data || [];
}

async function fetchUserMedications(userId: string): Promise<UserMedication[]> {
  const { data, error } = await supabase
    .from("user_medications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function addMedicationFn(params: {
  userId: string;
  medicationName: string;
  activeIngredient: string;
  dosage?: string;
  frequency?: string;
  notes?: string;
}) {
  const { error } = await supabase.from("user_medications").insert({
    user_id: params.userId,
    medication_name: params.medicationName,
    active_ingredient: params.activeIngredient,
    dosage: params.dosage || null,
    frequency: params.frequency || null,
    notes: params.notes || null,
  });
  if (error) throw error;
}

async function deleteMedicationFn(id: string) {
  const { error } = await supabase.from("user_medications").delete().eq("id", id);
  if (error) throw error;
}

export function useMealMedicineCheck(mealId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["meal_interactions", mealId, user?.id],
    queryFn: () => fetchMealInteractions(user!.id, mealId!),
    enabled: !!mealId && !!user,
    staleTime: 2 * 60 * 1000,
  });
}

export function useUserMedications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["user_medications", user?.id],
    queryFn: () => fetchUserMedications(user!.id),
    enabled: !!user,
    staleTime: 60 * 1000,
  });

  const addMutation = useMutation({
    mutationFn: addMedicationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_medications", user?.id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMedicationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_medications", user?.id] });
    },
  });

  return {
    medications: query.data || [],
    loading: query.isLoading,
    refetch: query.refetch,
    addMedication: addMutation.mutateAsync,
    deleteMedication: deleteMutation.mutateAsync,
    isAdding: addMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
