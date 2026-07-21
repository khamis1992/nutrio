import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export interface CorporateBenefit {
  eligible?: boolean;
  membership_id?: string;
  organization_id?: string;
  organization_name?: string;
  status?: "eligible" | "active";
  eligible_from?: string;
  eligible_until?: string | null;
  monthly_meal_allowance?: number;
  allowance_used?: number;
  remaining_allowance?: number;
  allowance_period_start?: string;
  sponsor_aggregate_consent?: boolean;
}

type Rpc = <T>(name: string, args?: Record<string, unknown>) => Promise<{ data: T | null; error: { message?: string } | null }>;
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc;

export function useCorporateBenefit(enabled = true) {
  const queryClient = useQueryClient();
  const queryKey = ["my-corporate-benefit"] as const;
  const query = useQuery({
    queryKey,
    enabled,
    queryFn: async () => {
      const { data, error } = await rpc<CorporateBenefit>("get_my_corporate_benefit");
      if (error) throw new Error(error.message || "Could not load benefit");
      return data ?? { eligible: false };
    },
  });
  const accept = useMutation({
    mutationFn: async ({ membershipId, aggregateConsent }: { membershipId: string; aggregateConsent: boolean }) => {
      const { data, error } = await rpc<boolean>("accept_my_corporate_benefit", {
        p_membership_id: membershipId,
        p_sponsor_aggregate_consent: aggregateConsent,
      });
      if (error || !data) throw new Error(error?.message || "Could not activate benefit");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  return { ...query, accept };
}
