import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface GoalProposal {
  id: string;
  coach_id: string;
  client_id: string;
  goal_type: string;
  target_value: string;
  current_value: string | null;
  deadline: string | null;
  status: "proposed" | "accepted" | "rejected" | "completed";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useGoalProposals(coachId: string | undefined, clientId: string | undefined) {
  const [proposals, setProposals] = useState<GoalProposal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProposals = useCallback(async () => {
    if (!coachId || !clientId) {
      setProposals([]);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("goal_proposals")
        .select("*")
        .eq("coach_id", coachId)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProposals(data || []);
    } catch (err) {
      console.error("Error fetching goal proposals:", err);
    } finally {
      setLoading(false);
    }
  }, [coachId, clientId]);

  const proposeGoal = useCallback(
    async (goal: {
      goal_type: string;
      target_value: string;
      deadline?: string | null;
      notes?: string | null;
    }) => {
      if (!coachId || !clientId) return { success: false, error: new Error("Missing data") };
      try {
        const { data, error } = await supabase
          .from("goal_proposals")
          .insert({
            coach_id: coachId,
            client_id: clientId,
            goal_type: goal.goal_type,
            target_value: goal.target_value,
            deadline: goal.deadline || null,
            notes: goal.notes || null,
          })
          .select()
          .single();

        if (error) throw error;
        setProposals((prev) => [data, ...prev]);
        return { success: true, error: null, data };
      } catch (err) {
        console.error("Error proposing goal:", err);
        return { success: false, error: err as Error };
      }
    },
    [coachId, clientId]
  );

  const acceptGoal = useCallback(async (proposalId: string) => {
    try {
      const { error } = await supabase
        .from("goal_proposals")
        .update({ status: "accepted", updated_at: new Date().toISOString() })
        .eq("id", proposalId)
        .eq("client_id", clientId);

      if (error) throw error;
      setProposals((prev) => prev.map((p) => (p.id === proposalId ? { ...p, status: "accepted" as const } : p)));
    } catch (err) {
      console.error("Error accepting goal:", err);
    }
  }, [clientId]);

  const rejectGoal = useCallback(async (proposalId: string) => {
    try {
      const { error } = await supabase
        .from("goal_proposals")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("id", proposalId)
        .eq("client_id", clientId);

      if (error) throw error;
      setProposals((prev) => prev.map((p) => (p.id === proposalId ? { ...p, status: "rejected" as const } : p)));
    } catch (err) {
      console.error("Error rejecting goal:", err);
    }
  }, [clientId]);

  const completeGoal = useCallback(async (proposalId: string) => {
    try {
      const { error } = await supabase
        .from("goal_proposals")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", proposalId)
        .eq("coach_id", coachId);

      if (error) throw error;
      setProposals((prev) => prev.map((p) => (p.id === proposalId ? { ...p, status: "completed" as const } : p)));
    } catch (err) {
      console.error("Error completing goal:", err);
    }
  }, [coachId]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  return { proposals, loading, proposeGoal, acceptGoal, rejectGoal, completeGoal, refresh: fetchProposals };
}
