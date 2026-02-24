import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface BodyMeasurement {
  id: string;
  log_date: string;
  weight_kg: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  chest_cm: number | null;
  body_fat_percent: number | null;
  muscle_mass_percent: number | null;
  notes: string | null;
}

export function useBodyMeasurements(userId: string | undefined) {
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [latestMeasurement, setLatestMeasurement] = useState<BodyMeasurement | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMeasurements = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);

      const { data, error } = await (supabase as any)
        .from("body_measurements")
        .select("id, log_date, weight_kg, waist_cm, hip_cm, chest_cm, body_fat_percent, muscle_mass_percent, notes")
        .eq("user_id", userId)
        .order("log_date", { ascending: false })
        .limit(10);

      if (error) throw error;

      const measurementsData = data || [];
      setMeasurements(measurementsData);
      setLatestMeasurement(measurementsData[0] || null);
    } catch (error) {
      console.error("Error fetching body measurements:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const addMeasurement = useCallback(async (measurement: {
    log_date: string;
    weight_kg?: number | null;
    waist_cm?: number | null;
    hip_cm?: number | null;
    chest_cm?: number | null;
    body_fat_percent?: number | null;
    muscle_mass_percent?: number | null;
    notes?: string | null;
  }) => {
    if (!userId) return;

    try {
      const { error } = await (supabase as any)
        .from("body_measurements")
        .insert({
          user_id: userId,
          log_date: measurement.log_date,
          weight_kg: measurement.weight_kg ?? null,
          waist_cm: measurement.waist_cm ?? null,
          hip_cm: measurement.hip_cm ?? null,
          chest_cm: measurement.chest_cm ?? null,
          body_fat_percent: measurement.body_fat_percent ?? null,
          muscle_mass_percent: measurement.muscle_mass_percent ?? null,
          notes: measurement.notes ?? null,
        });

      if (error) throw error;

      await fetchMeasurements();
    } catch (error) {
      console.error("Error adding body measurement:", error);
    }
  }, [userId, fetchMeasurements]);

  const deleteMeasurement = useCallback(async (id: string) => {
    if (!userId) return;

    try {
      const { error } = await (supabase as any)
        .from("body_measurements")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;

      await fetchMeasurements();
    } catch (error) {
      console.error("Error deleting body measurement:", error);
    }
  }, [userId, fetchMeasurements]);

  useEffect(() => {
    fetchMeasurements();
  }, [fetchMeasurements]);

  return {
    measurements,
    latestMeasurement,
    loading,
    addMeasurement,
    deleteMeasurement,
    refresh: fetchMeasurements,
  };
}
