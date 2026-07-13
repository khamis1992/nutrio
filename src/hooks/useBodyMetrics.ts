import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BodyMetrics {
  id: string;
  user_id: string;
  recorded_at: string;
  weight_kg: number;
  waist_cm?: number;
  body_fat_percent?: number;
  muscle_mass_percent?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface BodyMetricsInput {
  weight_kg: number;
  waist_cm?: number;
  body_fat_percent?: number;
  muscle_mass_percent?: number;
  notes?: string;
  recorded_at?: string;
}

// Fetch body metrics for a user
export function useBodyMetrics(userId: string | undefined) {
  return useQuery({
    queryKey: ["body-metrics", userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from("body_measurements")
        .select("id, user_id, log_date, weight_kg, waist_cm, body_fat_percent, muscle_mass_percent, notes, created_at")
        .eq("user_id", userId)
        .order("log_date", { ascending: false });

      if (error) {
        console.error("Error fetching body metrics:", error);
        throw error;
      }

      return (data || []).map(toBodyMetrics);
    },
    enabled: !!userId,
  });
}

// Fetch body metrics history with limit
export function useBodyMetricsHistory(userId: string | undefined, weeks: number = 12) {
  return useQuery({
    queryKey: ["body-metrics-history", userId, weeks],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from("body_measurements")
        .select("id, user_id, log_date, weight_kg, waist_cm, body_fat_percent, muscle_mass_percent, notes, created_at")
        .eq("user_id", userId)
        .order("log_date", { ascending: false })
        .limit(weeks);

      if (error) {
        console.error("Error fetching body metrics history:", error);
        throw error;
      }

      return (data || []).map(toBodyMetrics);
    },
    enabled: !!userId,
  });
}

// Get latest body metrics
export function useLatestBodyMetrics(userId: string | undefined) {
  return useQuery({
    queryKey: ["body-metrics-latest", userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from("body_measurements")
        .select("id, user_id, log_date, weight_kg, waist_cm, body_fat_percent, muscle_mass_percent, notes, created_at")
        .eq("user_id", userId)
        .order("log_date", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // No data found
          return null;
        }
        console.error("Error fetching latest body metrics:", error);
        throw error;
      }

      return toBodyMetrics(data);
    },
    enabled: !!userId,
  });
}

// Log body metrics
export function useLogBodyMetrics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      data,
    }: {
      userId: string;
      data: BodyMetricsInput;
    }) => {
      const logDate = data.recorded_at || new Date().toISOString().split("T")[0];
      const { error } = await supabase.from("body_measurements").upsert(
        {
          user_id: userId,
          log_date: logDate,
          weight_kg: data.weight_kg,
          waist_cm: data.waist_cm,
          body_fat_percent: data.body_fat_percent,
          muscle_mass_percent: data.muscle_mass_percent,
          notes: data.notes,
        },
        {
          onConflict: "user_id,log_date",
        }
      );

      if (error) {
        console.error("Error logging body metrics:", error);
        throw error;
      }

      await supabase
        .from("profiles")
        .upsert({ user_id: userId, current_weight_kg: data.weight_kg }, { onConflict: "user_id" });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["body-metrics", variables.userId],
      });
      queryClient.invalidateQueries({
        queryKey: ["body-metrics-latest", variables.userId],
      });
      queryClient.invalidateQueries({
        queryKey: ["body-metrics-history", variables.userId],
      });
      toast.success("Body metrics logged successfully!");
    },
    onError: (error) => {
      console.error("Mutation error:", error);
      toast.error("Failed to log body metrics. Please try again.");
    },
  });
}

// Update body metrics
export function useUpdateBodyMetrics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<BodyMetricsInput>;
    }) => {
      const { error } = await supabase
        .from("body_measurements")
        .update({
          log_date: data.recorded_at,
          weight_kg: data.weight_kg,
          waist_cm: data.waist_cm,
          body_fat_percent: data.body_fat_percent,
          muscle_mass_percent: data.muscle_mass_percent,
          notes: data.notes,
        })
        .eq("id", id);

      if (error) {
        console.error("Error updating body metrics:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["body-metrics"] });
      toast.success("Body metrics updated successfully!");
    },
    onError: (error) => {
      console.error("Update error:", error);
      toast.error("Failed to update body metrics.");
    },
  });
}

// Delete body metrics
export function useDeleteBodyMetrics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("body_measurements")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error deleting body metrics:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["body-metrics"] });
      toast.success("Body metrics deleted successfully!");
    },
    onError: (error) => {
      console.error("Delete error:", error);
      toast.error("Failed to delete body metrics.");
    },
  });
}

// Calculate weight change between two dates
export function useWeightChange(userId: string | undefined) {
  return useQuery({
    queryKey: ["weight-change", userId],
    queryFn: async () => {
      if (!userId) return null;
      
      // Get first and latest measurements
      const { data: latest, error: latestError } = await supabase
        .from("body_measurements")
        .select("weight_kg, log_date")
        .eq("user_id", userId)
        .order("log_date", { ascending: false })
        .limit(1)
        .single();

      if (latestError || !latest || latest.weight_kg === null) return null;

      const { data: first, error: firstError } = await supabase
        .from("body_measurements")
        .select("weight_kg, log_date")
        .eq("user_id", userId)
        .order("log_date", { ascending: true })
        .limit(1)
        .single();

      if (firstError || !first || first.weight_kg === null) return null;

      const change = latest.weight_kg - first.weight_kg;
      const weeks = Math.max(
        1,
        Math.ceil(
          (new Date(latest.log_date).getTime() - new Date(first.log_date).getTime()) /
            (1000 * 60 * 60 * 24 * 7)
        )
      );

      return {
        total_change_kg: change,
        weeks,
        change_per_week: change / weeks,
        start_weight: first.weight_kg,
        current_weight: latest.weight_kg,
        percentage_change: (change / first.weight_kg) * 100,
      };
    },
    enabled: !!userId,
  });
}

function toBodyMetrics(row: {
  id: string;
  user_id: string;
  log_date: string;
  weight_kg: number | null;
  waist_cm: number | null;
  body_fat_percent: number | null;
  muscle_mass_percent: number | null;
  notes: string | null;
  created_at: string | null;
}): BodyMetrics {
  return {
    id: row.id,
    user_id: row.user_id,
    recorded_at: row.log_date,
    weight_kg: row.weight_kg || 0,
    waist_cm: row.waist_cm ?? undefined,
    body_fat_percent: row.body_fat_percent ?? undefined,
    muscle_mass_percent: row.muscle_mass_percent ?? undefined,
    notes: row.notes ?? undefined,
    created_at: row.created_at || row.log_date,
    updated_at: row.created_at || row.log_date,
  };
}
