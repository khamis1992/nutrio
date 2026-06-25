import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BodyMeasurement {
  id: string;
  user_id: string;
  weight_kg: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  body_fat_percent: number | null;
  muscle_mass_percent: number | null;
  notes: string | null;
  log_date: string;
}

export interface ProgressPhoto {
  id: string;
  url: string;
  log_date: string;
}

export function useBodyMeasurements(clientId: string | undefined) {
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [latestMeasurement, setLatestMeasurement] = useState<BodyMeasurement | null>(null);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchMeasurements = useCallback(async () => {
    if (!clientId) {
      setMeasurements([]);
      setLatestMeasurement(null);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("body_measurements")
        .select("id, user_id, weight_kg, waist_cm, hip_cm, body_fat_percent, muscle_mass_percent, notes, log_date")
        .eq("user_id", clientId)
        .order("log_date", { ascending: false })
        .limit(30);

      if (error) throw error;
      const measurementsData = data || [];
      setMeasurements(measurementsData as BodyMeasurement[]);
      setLatestMeasurement(measurementsData[0] as BodyMeasurement | null);
    } catch (error) {
      console.error("Error fetching body measurements:", error);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  const fetchPhotos = useCallback(async () => {
    if (!clientId) return;
    try {
      const { data } = await supabase.storage
        .from("coach-photos")
        .list(`${clientId}`, { limit: 20, sortBy: { column: "created_at", order: "desc" } });

      if (data?.length) {
        const photoList: ProgressPhoto[] = data.map((file) => ({
          id: file.id,
          url: supabase.storage.from("coach-photos").getPublicUrl(`${clientId}/${file.name}`).data.publicUrl,
          log_date: file.created_at || new Date().toISOString(),
        }));
        setPhotos(photoList);
      }
    } catch (err) {
      console.error("Error fetching progress photos:", err);
    }
  }, [clientId]);

  const addMeasurement = useCallback(async (measurement: {
    log_date: string;
    weight_kg?: number | null;
    waist_cm?: number | null;
    hip_cm?: number | null;
    body_fat_percent?: number | null;
    muscle_mass_percent?: number | null;
    notes?: string | null;
  }) => {
    if (!clientId) return;
    try {
      const { error } = await supabase
        .from("body_measurements")
        .upsert({
          user_id: clientId,
          log_date: measurement.log_date,
          weight_kg: measurement.weight_kg ?? null,
          waist_cm: measurement.waist_cm ?? null,
          hip_cm: measurement.hip_cm ?? null,
          body_fat_percent: measurement.body_fat_percent ?? null,
          muscle_mass_percent: measurement.muscle_mass_percent ?? null,
          notes: measurement.notes ?? null,
        }, { onConflict: "user_id,log_date" });
      if (error) throw error;
      if (measurement.weight_kg && measurement.weight_kg > 0) {
        await supabase
          .from("profiles")
          .upsert({ user_id: clientId, current_weight_kg: measurement.weight_kg }, { onConflict: "user_id" });
      }
      await fetchMeasurements();
    } catch (error) {
      console.error("Error adding body measurement:", error);
    }
  }, [clientId, fetchMeasurements]);

  const deleteMeasurement = useCallback(async (id: string) => {
    if (!clientId) return;
    try {
      const { error } = await supabase
        .from("body_measurements")
        .delete()
        .eq("id", id)
        .eq("user_id", clientId);
      if (error) throw error;
      await fetchMeasurements();
    } catch (error) {
      console.error("Error deleting body measurement:", error);
    }
  }, [clientId, fetchMeasurements]);

  const uploadPhoto = useCallback(
    async (file: File) => {
      if (!clientId) throw new Error("Missing client ID");
      if (file.size > 10 * 1024 * 1024) throw new Error("File must be under 10MB");
      setUploading(true);
      try {
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = `${clientId}/${timestamp}_${safeName}`;
        const { error } = await supabase.storage
          .from("coach-photos")
          .upload(filePath, file, { cacheControl: "3600", upsert: false });
        if (error) {
          if (error.message.includes("Bucket") && error.message.includes("not found")) {
            throw new Error("Storage bucket not configured. Please create the 'coach-photos' bucket.");
          }
          throw error;
        }
        await fetchPhotos();
      } catch (err) {
        console.error("Error uploading photo:", err);
        throw err;
      } finally {
        setUploading(false);
      }
    },
    [clientId]
  );

  useEffect(() => {
    fetchMeasurements();
    fetchPhotos();
  }, [fetchMeasurements, fetchPhotos]);

  return {
    measurements,
    latestMeasurement,
    photos,
    loading,
    uploading,
    addMeasurement,
    deleteMeasurement,
    uploadPhoto,
    refresh: fetchMeasurements,
  };
}
