import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import {
  getMealResponseDashboard,
  recordMealResponseFeedback,
  setMealResponsePreferences,
  submitMealResponseCheckIn,
  type MealResponseCheckInInput,
  type MealResponsePreferences,
} from "@/lib/meal-response";

export function useMealResponse() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["meal-response-dashboard", user?.id || "anonymous"] as const;

  const query = useQuery({
    queryKey,
    enabled: Boolean(user?.id),
    queryFn: getMealResponseDashboard,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const preferences = useMutation({
    mutationFn: (value: MealResponsePreferences) => setMealResponsePreferences(value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  const checkIn = useMutation({
    mutationFn: (value: MealResponseCheckInInput) => submitMealResponseCheckIn(value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  const feedback = useMutation({
    mutationFn: (value: { estimateId: string; rating: "useful" | "not_accurate"; reason?: string }) => (
      recordMealResponseFeedback(value.estimateId, value.rating, value.reason)
    ),
  });

  return { ...query, preferences, checkIn, feedback };
}
