import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export interface FamilyMember {
  id: string;
  main_user_id: string;
  name: string;
  relationship: "spouse" | "child" | "parent" | "sibling" | "other";
  gender: string | null;
  birth_year: number | null;
  date_of_birth: string | null;
  dietary_preferences: string[] | null;
  allergies: string[];
  calorie_target: number | null;
  protein_target_g: number | null;
  hydration_target_ml: number | null;
  monthly_meal_allowance: number;
  authorization_type: "adult_authorization" | "guardian_consent" | null;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface FamilyMemberInput {
  name: string;
  relationship: FamilyMember["relationship"];
  date_of_birth: string;
  gender?: string;
  dietary_preferences?: string[];
  allergies?: string[];
  calorie_target?: number;
  protein_target_g?: number;
  hydration_target_ml?: number;
  monthly_meal_allowance?: number;
  authorization_confirmed: boolean;
}

type Rpc = <T>(name: string, args?: Record<string, unknown>) => Promise<{
  data: T | null;
  error: { message?: string } | null;
}>;
const rpc = supabase.rpc as unknown as Rpc;

export const useFamilyMembers = (enabled = true) => {
  const { user } = useAuth();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    if (!user || !enabled) {
      setMembers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await rpc<unknown>("list_my_family_profiles");
      if (error) throw new Error(error.message || "Could not load family profiles");
      setMembers(Array.isArray(data) ? data as FamilyMember[] : []);
    } catch (error) {
      console.error("Error fetching family profiles:", error);
    } finally {
      setLoading(false);
    }
  }, [enabled, user]);

  useEffect(() => { void fetchMembers(); }, [fetchMembers]);

  const addMember = async (input: FamilyMemberInput): Promise<boolean> => {
    try {
      const { error } = await rpc<string>("create_my_family_profile", {
        p_name: input.name,
        p_relationship: input.relationship,
        p_date_of_birth: input.date_of_birth,
        p_gender: input.gender ?? null,
        p_dietary_preferences: input.dietary_preferences ?? [],
        p_allergies: input.allergies ?? [],
        p_calorie_target: input.calorie_target ?? null,
        p_protein_target_g: input.protein_target_g ?? null,
        p_hydration_target_ml: input.hydration_target_ml ?? null,
        p_monthly_meal_allowance: input.monthly_meal_allowance ?? 0,
        p_authorization_confirmed: input.authorization_confirmed,
      });
      if (error) throw new Error(error.message || "Could not add family profile");
      toast.success("Family profile added");
      await fetchMembers();
      return true;
    } catch (error) {
      console.error("Error adding family profile:", error);
      toast.error(error instanceof Error ? error.message : "Failed to add family profile");
      return false;
    }
  };

  const removeMember = async (memberId: string): Promise<boolean> => {
    try {
      const { data, error } = await rpc<boolean>("deactivate_my_family_profile", { p_family_member_id: memberId });
      if (error || !data) throw new Error(error?.message || "Could not remove family profile");
      toast.success("Family profile deactivated");
      await fetchMembers();
      return true;
    } catch (error) {
      console.error("Error deactivating family profile:", error);
      toast.error("Failed to deactivate family profile");
      return false;
    }
  };

  const updateMember = async (memberId: string, updates: Partial<FamilyMemberInput>): Promise<boolean> => {
    const current = members.find((member) => member.id === memberId);
    if (!current) return false;
    try {
      const { data, error } = await rpc<boolean>("update_my_family_profile", {
        p_family_member_id: memberId,
        p_name: updates.name ?? current.name,
        p_dietary_preferences: updates.dietary_preferences ?? current.dietary_preferences ?? [],
        p_allergies: updates.allergies ?? current.allergies,
        p_calorie_target: updates.calorie_target ?? current.calorie_target,
        p_protein_target_g: updates.protein_target_g ?? current.protein_target_g,
        p_hydration_target_ml: updates.hydration_target_ml ?? current.hydration_target_ml,
        p_monthly_meal_allowance: updates.monthly_meal_allowance ?? current.monthly_meal_allowance,
      });
      if (error || !data) throw new Error(error?.message || "Could not update family profile");
      toast.success("Family profile updated");
      await fetchMembers();
      return true;
    } catch (error) {
      console.error("Error updating family profile:", error);
      toast.error("Failed to update family profile");
      return false;
    }
  };

  const assignSchedule = async (scheduleId: string, memberId: string): Promise<boolean> => {
    const { data, error } = await rpc<boolean>("assign_my_schedule_to_family_member", {
      p_schedule_id: scheduleId,
      p_family_member_id: memberId,
    });
    if (error || !data) {
      toast.error(error?.message || "Meal does not fit this family profile");
      return false;
    }
    toast.success("Meal assigned to family profile");
    return true;
  };

  return { members, loading, addMember, removeMember, updateMember, assignSchedule, refetch: fetchMembers };
};
