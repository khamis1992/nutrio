import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface FamilyMember {
  id: string;
  main_user_id: string;
  name: string;
  gender: string | null;
  birth_year: number | null;
  dietary_preferences: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface FamilyMemberInput {
  name: string;
  gender?: string;
  birth_year?: number;
  dietary_preferences?: string[];
}

export const useFamilyMembers = () => {
  const { user } = useAuth();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    if (!user) {
      setMembers([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("family_members")
        .select("*")
        .eq("main_user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMembers(data || []);
    } catch (err) {
      console.error("Error fetching family members:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const addMember = async (input: FamilyMemberInput): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase.from("family_members").insert({
        main_user_id: user.id,
        name: input.name,
        gender: input.gender || null,
        birth_year: input.birth_year || null,
        dietary_preferences: input.dietary_preferences || null,
      });

      if (error) throw error;
      toast.success("Family member added successfully");
      await fetchMembers();
      return true;
    } catch (err) {
      console.error("Error adding family member:", err);
      toast.error("Failed to add family member");
      return false;
    }
  };

  const removeMember = async (memberId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("family_members")
        .delete()
        .eq("id", memberId)
        .eq("main_user_id", user?.id);

      if (error) throw error;
      toast.success("Family member removed");
      await fetchMembers();
      return true;
    } catch (err) {
      console.error("Error removing family member:", err);
      toast.error("Failed to remove family member");
      return false;
    }
  };

  const updateMember = async (
    memberId: string,
    updates: Partial<FamilyMemberInput>
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("family_members")
        .update(updates)
        .eq("id", memberId)
        .eq("main_user_id", user?.id);

      if (error) throw error;
      toast.success("Family member updated");
      await fetchMembers();
      return true;
    } catch (err) {
      console.error("Error updating family member:", err);
      toast.error("Failed to update family member");
      return false;
    }
  };

  return {
    members,
    loading,
    addMember,
    removeMember,
    updateMember,
    refetch: fetchMembers,
  };
};
