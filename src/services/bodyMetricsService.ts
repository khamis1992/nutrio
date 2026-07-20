import { supabase } from "@/integrations/supabase/client";
import type { BodyMetrics, BodyMetricsInput, BodyMeasurementRow } from "@/types/retention";

const BODY_MEASUREMENT_SELECT =
  "id, user_id, log_date, weight_kg, waist_cm, body_fat_percent, muscle_mass_percent, notes, created_at";

export function toBodyMetrics(row: BodyMeasurementRow): BodyMetrics {
  return {
    id: row.id,
    user_id: row.user_id,
    recorded_at: row.log_date,
    weight_kg: row.weight_kg ?? 0,
    waist_cm: row.waist_cm ?? undefined,
    body_fat_percent: row.body_fat_percent ?? undefined,
    muscle_mass_percent: row.muscle_mass_percent ?? undefined,
    notes: row.notes ?? undefined,
    created_at: row.created_at ?? row.log_date,
    updated_at: row.created_at ?? row.log_date,
  };
}

export async function fetchBodyMetrics(userId: string, limit?: number): Promise<BodyMetrics[]> {
  let query = supabase
    .from("body_measurements")
    .select(BODY_MEASUREMENT_SELECT)
    .eq("user_id", userId)
    .order("log_date", { ascending: false });

  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((row) => toBodyMetrics(row as BodyMeasurementRow));
}

export async function fetchLatestBodyMetrics(userId: string): Promise<BodyMetrics | null> {
  const { data, error } = await supabase
    .from("body_measurements")
    .select(BODY_MEASUREMENT_SELECT)
    .eq("user_id", userId)
    .order("log_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? toBodyMetrics(data as BodyMeasurementRow) : null;
}

export async function logBodyMetrics(userId: string, input: BodyMetricsInput): Promise<void> {
  const logDate = input.recorded_at || new Date().toISOString().slice(0, 10);

  const { error } = await supabase.from("body_measurements").upsert(
    {
      user_id: userId,
      log_date: logDate,
      weight_kg: input.weight_kg,
      waist_cm: input.waist_cm,
      body_fat_percent: input.body_fat_percent,
      muscle_mass_percent: input.muscle_mass_percent,
      notes: input.notes,
    },
    { onConflict: "user_id,log_date" },
  );

  if (error) throw error;

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ user_id: userId, current_weight_kg: input.weight_kg }, { onConflict: "user_id" });

  if (profileError) throw profileError;
}
