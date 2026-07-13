import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { requestCoachWithdrawal } from "@/lib/payouts";

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

const withdrawalStatuses: WithdrawalRequest["status"][] = ["pending", "approved", "rejected", "processed"];

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
      setWithdrawals((data ?? []).map((withdrawal) => ({
        id: withdrawal.id,
        coach_id: withdrawal.coach_id,
        amount: Number(withdrawal.amount),
        bank_name: withdrawal.bank_name,
        iban: withdrawal.iban,
        account_holder: withdrawal.account_holder,
        status: withdrawalStatuses.includes(withdrawal.status as WithdrawalRequest["status"])
          ? withdrawal.status as WithdrawalRequest["status"]
          : "pending",
        admin_notes: withdrawal.admin_notes,
        processed_at: withdrawal.processed_at,
        created_at: withdrawal.created_at,
      })));
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
        const data = await requestCoachWithdrawal(
          amount,
          bankName.trim(),
          iban.trim(),
          accountHolder.trim(),
        );
        await fetchWithdrawals();
        return { success: true, error: null, data };
      } catch (err) {
        console.error("Error requesting withdrawal:", err);
        return { success: false, error: err as Error };
      } finally {
        setSubmitting(false);
      }
    },
    [coachId, fetchWithdrawals]
  );

  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  return { withdrawals, loading, submitting, requestWithdrawal, refresh: fetchWithdrawals };
}
