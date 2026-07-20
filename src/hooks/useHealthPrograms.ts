import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";

export type HealthProgram = Tables<"health_programs">;
export type HealthProgramVersion = Tables<"health_program_versions">;
export type HealthProgramEnrollment = Tables<"health_program_enrollments">;
export type HealthProgramCheckin = Tables<"health_program_checkins">;
export type HealthProgramBaseline = Tables<"health_program_baselines">;
export type HealthProgramTask = Tables<"health_program_task_completions">;
export type HealthProgramSafetyEvent = Tables<"health_program_safety_events">;
export type HealthProgramMeal = Tables<"meals">;
export type HealthProgramMealQualification = Tables<"health_program_meal_qualifications"> & {
  meals: HealthProgramMeal | null;
};

export type ActiveHealthProgram = HealthProgramEnrollment & {
  health_programs: HealthProgram;
  health_program_versions: HealthProgramVersion;
};

export type HealthProgramCheckinInput = {
  enrollmentId: string;
  appetite: number;
  energy: number;
  hydrationAbility: number;
  nausea: number;
  vomiting: number;
  constipation: number;
  diarrhea: number;
  reflux: number;
  symptomsDisruptFood: boolean;
  symptomsPersistent: boolean;
  severePersistentAbdominalPain: boolean;
  unableToKeepFluids: boolean;
  breathingOrSwallowingDifficulty: boolean;
  faceOrTongueSwelling: boolean;
  fainting: boolean;
  suddenVisionChange: boolean;
};

const queryKeys = {
  programs: ["health-programs"] as const,
  program: (slug: string) => ["health-programs", slug] as const,
  active: (userId?: string) => ["health-programs", "active", userId] as const,
  tasks: (enrollmentId?: string, date?: string) =>
    ["health-programs", "tasks", enrollmentId, date] as const,
  checkin: (enrollmentId?: string, date?: string) =>
    ["health-programs", "checkin", enrollmentId, date] as const,
  safety: (enrollmentId?: string) =>
    ["health-programs", "safety", enrollmentId] as const,
  history: (enrollmentId?: string) =>
    ["health-programs", "history", enrollmentId] as const,
  baseline: (enrollmentId?: string) =>
    ["health-programs", "baseline", enrollmentId] as const,
  meals: (versionId?: string) => ["health-programs", "meals", versionId] as const,
};

const today = () => new Date().toISOString().slice(0, 10);

export function useHealthPrograms() {
  return useQuery({
    queryKey: queryKeys.programs,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("health_programs")
        .select("*")
        .eq("status", "published")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useHealthProgram(slug: string) {
  return useQuery({
    queryKey: queryKeys.program(slug),
    enabled: Boolean(slug),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("health_programs")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function usePublishedHealthProgramVersion(programId?: string) {
  return useQuery({
    queryKey: ["health-programs", "published-version", programId],
    enabled: Boolean(programId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("health_program_versions")
        .select("*")
        .eq("program_id", programId!)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useActiveHealthProgram() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.active(user?.id),
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("health_program_enrollments")
        .select("*, health_programs(*), health_program_versions(*)")
        .in("status", ["onboarding", "active", "paused"])
        .maybeSingle();
      if (error) throw error;
      return data as ActiveHealthProgram | null;
    },
  });
}

export function useHealthProgramBaseline(enrollmentId?: string) {
  return useQuery({
    queryKey: queryKeys.baseline(enrollmentId),
    enabled: Boolean(enrollmentId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("health_program_baselines")
        .select("*")
        .eq("enrollment_id", enrollmentId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useHealthProgramMeals(programVersionId?: string) {
  return useQuery({
    queryKey: queryKeys.meals(programVersionId),
    enabled: Boolean(programVersionId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("health_program_meal_qualifications")
        .select("*, meals(*)")
        .eq("program_version_id", programVersionId!)
        .eq("status", "eligible")
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order("reviewed_at", { ascending: false });
      if (error) throw error;
      return data as HealthProgramMealQualification[];
    },
  });
}

export function useSaveHealthProgramBaseline() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      enrollmentId,
      mealsPerDay,
      appetite,
      energy,
      hydrationConfidence,
      strengthExperience,
      goals,
    }: {
      enrollmentId: string;
      mealsPerDay: number;
      appetite: number;
      energy: number;
      hydrationConfidence: number;
      strengthExperience: "none" | "beginner" | "regular";
      goals: string[];
    }) => {
      if (!user) throw new Error("Authentication required");
      const { data, error } = await supabase
        .from("health_program_baselines")
        .upsert(
          {
            enrollment_id: enrollmentId,
            user_id: user.id,
            eating_pattern: { meals_per_day: mealsPerDay },
            appetite,
            energy,
            hydration_confidence: hydrationConfidence,
            strength_experience: strengthExperience,
            goals,
          },
          { onConflict: "enrollment_id" },
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.baseline(variables.enrollmentId) });
    },
  });
}

export function useCompleteHealthProgramOnboarding() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (enrollmentId: string) => {
      const { data, error } = await supabase.rpc("complete_health_program_onboarding", {
        p_enrollment_id: enrollmentId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.active(user?.id) });
    },
  });
}

export function useHealthProgramTasks(enrollmentId?: string, date = today()) {
  return useQuery({
    queryKey: queryKeys.tasks(enrollmentId, date),
    enabled: Boolean(enrollmentId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("health_program_task_completions")
        .select("*")
        .eq("enrollment_id", enrollmentId!)
        .eq("task_date", date)
        .order("completed_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useTodayHealthProgramCheckin(
  enrollmentId?: string,
  date = today(),
) {
  return useQuery({
    queryKey: queryKeys.checkin(enrollmentId, date),
    enabled: Boolean(enrollmentId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("health_program_checkins")
        .select("*")
        .eq("enrollment_id", enrollmentId!)
        .eq("checkin_date", date)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useHealthProgramSafetyEvents(enrollmentId?: string) {
  return useQuery({
    queryKey: queryKeys.safety(enrollmentId),
    enabled: Boolean(enrollmentId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("health_program_safety_events")
        .select("*")
        .eq("enrollment_id", enrollmentId!)
        .is("acknowledged_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useHealthProgramHistory(enrollmentId?: string) {
  return useQuery({
    queryKey: queryKeys.history(enrollmentId),
    enabled: Boolean(enrollmentId),
    queryFn: async () => {
      const [checkins, tasks] = await Promise.all([
        supabase.from("health_program_checkins").select("*")
          .eq("enrollment_id", enrollmentId!).order("checkin_date", { ascending: true }),
        supabase.from("health_program_task_completions").select("*")
          .eq("enrollment_id", enrollmentId!).order("task_date", { ascending: true }),
      ]);
      if (checkins.error) throw checkins.error;
      if (tasks.error) throw tasks.error;
      return { checkins: checkins.data, tasks: tasks.data };
    },
  });
}

export function useEnrollInHealthProgram() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      slug,
      noticeSnapshot,
    }: {
      slug: string;
      noticeSnapshot: string;
    }) => {
      const { data, error } = await supabase.rpc("enroll_in_health_program", {
        p_program_slug: slug,
        p_adult_attested: true,
        p_clinician_prescription_attested: true,
        p_service_boundary_accepted: true,
        p_notice_snapshot: noticeSnapshot,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.active(user?.id) });
    },
  });
}

export function useSetHealthProgramStatus() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ enrollmentId, status }: { enrollmentId: string; status: string }) => {
      const { data, error } = await supabase.rpc("set_health_program_status", {
        p_enrollment_id: enrollmentId,
        p_status: status,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.active(user?.id) });
    },
  });
}

export function useCompleteHealthProgramTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      enrollmentId,
      taskCode,
      taskType,
      completed,
    }: {
      enrollmentId: string;
      taskCode: string;
      taskType: HealthProgramTask["task_type"];
      completed: boolean;
    }) => {
      if (!user) throw new Error("Authentication required");
      if (!completed) {
        const { error } = await supabase
          .from("health_program_task_completions")
          .delete()
          .eq("enrollment_id", enrollmentId)
          .eq("task_date", today())
          .eq("task_code", taskCode);
        if (error) throw error;
        return null;
      }
      const { data, error } = await supabase
        .from("health_program_task_completions")
        .upsert(
          {
            enrollment_id: enrollmentId,
            user_id: user.id,
            task_date: today(),
            task_code: taskCode,
            task_type: taskType,
            completion_source: "manual",
          },
          { onConflict: "enrollment_id,task_date,task_code" },
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.tasks(variables.enrollmentId, today()),
      });
    },
  });
}

export function useSubmitHealthProgramCheckin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: HealthProgramCheckinInput) => {
      const { data, error } = await supabase.rpc("submit_health_program_checkin", {
        p_enrollment_id: input.enrollmentId,
        p_appetite: input.appetite,
        p_energy: input.energy,
        p_hydration_ability: input.hydrationAbility,
        p_nausea: input.nausea,
        p_vomiting: input.vomiting,
        p_constipation: input.constipation,
        p_diarrhea: input.diarrhea,
        p_reflux: input.reflux,
        p_symptoms_disrupt_food: input.symptomsDisruptFood,
        p_symptoms_persistent: input.symptomsPersistent,
        p_severe_persistent_abdominal_pain: input.severePersistentAbdominalPain,
        p_unable_to_keep_fluids: input.unableToKeepFluids,
        p_breathing_or_swallowing_difficulty: input.breathingOrSwallowingDifficulty,
        p_face_or_tongue_swelling: input.faceOrTongueSwelling,
        p_fainting: input.fainting,
        p_sudden_vision_change: input.suddenVisionChange,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async (_data, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.checkin(input.enrollmentId, today()) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks(input.enrollmentId, today()) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.safety(input.enrollmentId) }),
      ]);
    },
  });
}

export function useAcknowledgeHealthProgramSafetyEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId }: { eventId: string; enrollmentId: string }) => {
      const { data, error } = await supabase.rpc(
        "acknowledge_health_program_safety_event",
        { p_event_id: eventId },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.safety(variables.enrollmentId) });
    },
  });
}

export function useDeleteHealthProgramData() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (enrollmentId: string) => {
      const { data, error } = await supabase.rpc("delete_my_health_program_data", {
        p_enrollment_id: enrollmentId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.active(user?.id) });
    },
  });
}
