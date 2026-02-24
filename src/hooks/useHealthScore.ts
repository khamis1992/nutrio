import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface HealthScore {
  id: string;
  user_id: string;
  calculated_at: string;
  score_week_start: string;
  macro_adherence_score: number;
  meal_consistency_score: number;
  weight_logging_score: number;
  protein_accuracy_score: number;
  overall_score: number;
  category: "green" | "orange" | "red";
  metrics_used: {
    weight_logs_count: number;
    target_meals: number;
    actual_meals: number;
    target_protein: number;
    actual_protein_avg: number;
  };
}

export interface HealthScoreBreakdown {
  overall_score: number;
  category: "green" | "orange" | "red";
  macro_adherence: number;
  meal_consistency: number;
  weight_logging: number;
  protein_accuracy: number;
}

// Fetch latest health score
export function useHealthScore(userId: string | undefined) {
  return useQuery({
    queryKey: ["health-score", userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from("user_health_scores")
        .select("*")
        .eq("user_id", userId)
        .order("calculated_at", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // No data found
          return null;
        }
        console.error("Error fetching health score:", error);
        throw error;
      }

      return data as HealthScore;
    },
    enabled: !!userId,
  });
}

// Fetch health score history
export function useHealthScoreHistory(userId: string | undefined, weeks: number = 12) {
  return useQuery({
    queryKey: ["health-score-history", userId, weeks],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from("user_health_scores")
        .select("*")
        .eq("user_id", userId)
        .order("score_week_start", { ascending: false })
        .limit(weeks);

      if (error) {
        console.error("Error fetching health score history:", error);
        throw error;
      }

      return (data as HealthScore[]).reverse(); // Reverse to show oldest first for charts
    },
    enabled: !!userId,
  });
}

// Calculate health score manually
export function useCalculateHealthScore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      weekStart,
    }: {
      userId: string;
      weekStart?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "calculate-health-score",
        {
          body: {
            user_id: userId,
            week_start: weekStart,
          },
        }
      );

      if (error) {
        console.error("Error calculating health score:", error);
        throw error;
      }

      return data as {
        message: string;
        week_start: string;
        results: Array<{
          user_id: string;
          success: boolean;
          overall_score?: number;
          category?: "green" | "orange" | "red";
          breakdown?: HealthScoreBreakdown;
          error?: string;
        }>;
      };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["health-score", variables.userId],
      });
      queryClient.invalidateQueries({
        queryKey: ["health-score-history", variables.userId],
      });
      
      const result = data.results[0];
      if (result?.success) {
        toast.success(`Health score calculated: ${result.overall_score}/100`);
      } else {
        toast.error(result?.error || "Failed to calculate health score");
      }
    },
    onError: (error) => {
      console.error("Calculation error:", error);
      toast.error("Failed to calculate health score.");
    },
  });
}

// Get health score statistics
export function useHealthScoreStats(userId: string | undefined) {
  return useQuery({
    queryKey: ["health-score-stats", userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from("user_health_scores")
        .select("overall_score, category, calculated_at")
        .eq("user_id", userId)
        .order("calculated_at", { ascending: false });

      if (error) {
        console.error("Error fetching health score stats:", error);
        throw error;
      }

      if (!data || data.length === 0) return null;

      const scores = data as HealthScore[];
      const latest = scores[0];
      const previous = scores[1];

      // Calculate trend
      const trend = previous
        ? latest.overall_score - previous.overall_score
        : 0;

      // Calculate averages
      const avgScore =
        scores.reduce((sum, s) => sum + s.overall_score, 0) / scores.length;

      // Count by category
      const categoryCounts = scores.reduce(
        (acc, s) => {
          acc[s.category] = (acc[s.category] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      // Best score
      const bestScore = Math.max(...scores.map((s) => s.overall_score));

      return {
        latest: latest.overall_score,
        previous: previous?.overall_score,
        trend,
        average: Math.round(avgScore * 100) / 100,
        best: bestScore,
        totalCalculations: scores.length,
        categoryDistribution: categoryCounts,
        currentCategory: latest.category,
      };
    },
    enabled: !!userId,
  });
}

// Get score color based on category
export function getScoreColor(category: "green" | "orange" | "red"): string {
  switch (category) {
    case "green":
      return "text-green-600 bg-green-100";
    case "orange":
      return "text-orange-600 bg-orange-100";
    case "red":
      return "text-red-600 bg-red-100";
    default:
      return "text-gray-600 bg-gray-100";
  }
}

// Get score label
export function getScoreLabel(category: "green" | "orange" | "red"): string {
  switch (category) {
    case "green":
      return "Excellent";
    case "orange":
      return "Good";
    case "red":
      return "Needs Improvement";
    default:
      return "Unknown";
  }
}

// Get component weight percentages
export const SCORE_WEIGHTS = {
  macro_adherence: 40,
  meal_consistency: 30,
  weight_logging: 20,
  protein_accuracy: 10,
} as const;
