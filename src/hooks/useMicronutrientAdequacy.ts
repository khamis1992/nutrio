import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";

import { supabase } from "@/integrations/supabase/client";

export type MicronutrientAdequacyRange = "day" | "week";

export interface MicronutrientAdequacyRow {
  consumed: number | null;
  direction: "minimum" | "maximum";
  label_ar: string;
  label_en: string;
  measured_entries: number;
  missing_entries: number;
  nutrient_code: "fiber_g" | "sodium_mg" | "sugar_g";
  percentage: number | null;
  status: "missing" | "low" | "on_track" | "over_limit";
  target: number;
  unit: "g" | "mg";
}

export function buildMicronutrientRange(
  endDate: Date,
  range: MicronutrientAdequacyRange,
) {
  const end = format(endDate, "yyyy-MM-dd");
  const start = format(range === "week" ? subDays(endDate, 6) : endDate, "yyyy-MM-dd");
  return { start, end };
}

export function useMicronutrientAdequacy(
  userId: string | undefined,
  endDate: Date,
  range: MicronutrientAdequacyRange,
) {
  const dates = buildMicronutrientRange(endDate, range);

  return useQuery({
    queryKey: ["micronutrient-adequacy", userId, dates.start, dates.end],
    enabled: Boolean(userId),
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_user_micronutrient_adequacy",
        {
          p_start_date: dates.start,
          p_end_date: dates.end,
        },
      );

      if (error) throw error;
      return (data ?? []) as MicronutrientAdequacyRow[];
    },
  });
}
