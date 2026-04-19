import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getQatarDay } from "@/lib/dateUtils";
import { withRetry } from "@/lib/retry";

export function useDashboardRolloverCredits(userId: string | undefined) {
  const [rolloverCredits, setRolloverCredits] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const loadRollovers = async () => {
      setLoading(true);
      setError(null);
      try {
        const today = getQatarDay();
        const { data } = await withRetry(async () => {
          const result = await (supabase as any)
            .from("subscription_rollovers")
            .select("rollover_credits")
            .eq("user_id", userId)
            .eq("status", "active")
            .gte("expiry_date", today);
          if (result.error) throw result.error;
          return result;
        }, { maxAttempts: 2, delayMs: 500 });

        if (cancelled) return;
        if (data) {
          const total = data
            .reduce((sum: number, r: { rollover_credits: number }) => sum + (r.rollover_credits || 0), 0);
          setRolloverCredits(total);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("rollover fetch exception:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadRollovers();
    return () => { cancelled = true; };
  }, [userId]);

  return { rolloverCredits, loading, error };
}
