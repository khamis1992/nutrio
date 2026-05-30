import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ClientOnboardingData {
  id?: string;
  client_id: string;
  coach_id: string;
  health_goal: string;
  current_weight_kg: number | null;
  target_weight_kg: number | null;
  activity_level: string | null;
  dietary_preferences: string | null;
  allergies_or_restrictions: string | null;
  medical_conditions: string | null;
  coaching_expectations: string | null;
  submitted_at: string;
}

export function useClientOnboarding(clientId: string | undefined, coachId: string | undefined) {
  const [onboarding, setOnboarding] = useState<ClientOnboardingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchOnboarding = useCallback(async () => {
    if (!clientId || !coachId) {
      setOnboarding(null);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("client_onboarding_responses")
        .select("*")
        .eq("client_id", clientId)
        .eq("coach_id", coachId)
        .maybeSingle();

      if (error) throw error;
      setOnboarding(data as ClientOnboardingData | null);
    } catch (err) {
      console.error("Error fetching onboarding:", err);
    } finally {
      setLoading(false);
    }
  }, [clientId, coachId]);

  const submitOnboarding = useCallback(
    async (formData: {
      health_goal: string;
      current_weight_kg?: number | null;
      target_weight_kg?: number | null;
      activity_level?: string | null;
      dietary_preferences?: string | null;
      allergies_or_restrictions?: string | null;
      medical_conditions?: string | null;
      coaching_expectations?: string | null;
    }) => {
      if (!clientId || !coachId) return { success: false, error: new Error("Missing IDs") };
      setSubmitting(true);
      try {
        // Upsert: if a row exists for this client-coach pair, update it
        const { data, error } = await supabase
          .from("client_onboarding_responses")
          .upsert(
            {
              client_id: clientId,
              coach_id: coachId,
              health_goal: formData.health_goal,
              current_weight_kg: formData.current_weight_kg ?? null,
              target_weight_kg: formData.target_weight_kg ?? null,
              activity_level: formData.activity_level ?? null,
              dietary_preferences: formData.dietary_preferences ?? null,
              allergies_or_restrictions: formData.allergies_or_restrictions ?? null,
              medical_conditions: formData.medical_conditions ?? null,
              coaching_expectations: formData.coaching_expectations ?? null,
              submitted_at: new Date().toISOString(),
            },
            { onConflict: "client_id,coach_id" }
          )
          .select()
          .single();

        if (error) throw error;
        setOnboarding({
          ...(data as ClientOnboardingData),
        });
        return { success: true, error: null, data };
      } catch (err) {
        console.error("Error submitting onboarding:", err);
        return { success: false, error: err as Error };
      } finally {
        setSubmitting(false);
      }
    },
    [clientId, coachId]
  );

  useEffect(() => {
    fetchOnboarding();
  }, [fetchOnboarding]);

  return { onboarding, loading, submitting, submitOnboarding };
}
