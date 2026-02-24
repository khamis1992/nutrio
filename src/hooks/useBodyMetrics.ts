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
        .from("user_body_metrics")
        .select("*")
        .eq("user_id", userId)
        .order("recorded_at", { ascending: false });

      if (error) {
        console.error("Error fetching body metrics:", error);
        throw error;
      }

      return data as BodyMetrics[];
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
        .from("user_body_metrics")
        .select("*")
        .eq("user_id", userId)
        .order("recorded_at", { ascending: false })
        .limit(weeks);

      if (error) {
        console.error("Error fetching body metrics history:", error);
        throw error;
      }

      return data as BodyMetrics[];
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
        .from("user_body_metrics")
        .select("*")
        .eq("user_id", userId)
        .order("recorded_at", { ascending: false })
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

      return data as BodyMetrics;
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
      const { error } = await supabase.from("user_body_metrics").upsert(
        {
          user_id: userId,
          recorded_at: data.recorded_at || new Date().toISOString().split("T")[0],
          weight_kg: data.weight_kg,
          waist_cm: data.waist_cm,
          body_fat_percent: data.body_fat_percent,
          muscle_mass_percent: data.muscle_mass_percent,
          notes: data.notes,
        },
        {
          onConflict: "user_id,recorded_at",
        }
      );

      if (error) {
        console.error("Error logging body metrics:", error);
        throw error;
      }
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
        .from("user_body_metrics")
        .update(data)
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
        .from("user_body_metrics")
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
        .from("user_body_metrics")
        .select("weight_kg, recorded_at")
        .eq("user_id", userId)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .single();

      if (latestError || !latest) return null;

      const { data: first, error: firstError } = await supabase
        .from("user_body_metrics")
        .select("weight_kg, recorded_at")
        .eq("user_id", userId)
        .order("recorded_at", { ascending: true })
        .limit(1)
        .single();

      if (firstError || !first) return null;

      const change = latest.weight_kg - first.weight_kg;
      const weeks = Math.max(
        1,
        Math.ceil(
          (new Date(latest.recorded_at).getTime() - new Date(first.recorded_at).getTime()) /
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
