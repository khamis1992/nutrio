import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface WithdrawalRequest {
  id: string;
  coach_id: string;
  amount: number;
  bank_name: string;
  iban: string;
  account_holder: string;
  status: "pending" | "approved" | "rejected" | "processed";
  admin_notes: string | null;
  processed_at: string | null;
  created_at: string;
}

export function useCoachWithdrawal(coachId: string | undefined) {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchWithdrawals = useCallback(async () => {
    if (!coachId) {
      setWithdrawals([]);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("coach_withdrawal_requests")
        .select("*")
        .eq("coach_id", coachId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setWithdrawals(data || []);
    } catch (err) {
      console.error("Error fetching withdrawals:", err);
    } finally {
      setLoading(false);
    }
  }, [coachId]);

  const requestWithdrawal = useCallback(
    async (amount: number, bankName: string, iban: string, accountHolder: string) => {
      if (!coachId || amount <= 0) return { success: false, error: new Error("Invalid data") };
      setSubmitting(true);
      try {
        const { data, error } = await supabase
          .from("coach_withdrawal_requests")
          .insert({
            coach_id: coachId,
            amount,
            bank_name: bankName.trim(),
            iban: iban.trim(),
            account_holder: accountHolder.trim(),
          })
          .select()
          .single();

        if (error) throw error;
        setWithdrawals((prev) => [data, ...prev]);
        return { success: true, error: null, data };
      } catch (err) {
        console.error("Error requesting withdrawal:", err);
        return { success: false, error: err as Error };
      } finally {
        setSubmitting(false);
      }
    },
    [coachId]
  );

  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  return { withdrawals, loading, submitting, requestWithdrawal, refresh: fetchWithdrawals };
}
