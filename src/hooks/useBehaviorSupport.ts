import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type BehaviorBarrier = "time" | "choice" | "energy" | "hunger" | "routine" | "none";
export type BehaviorEvent = "shown" | "acted" | "completed" | "dismissed";

export interface BehaviorSupport {
  available: boolean;
  reason: string | null;
  intervention_id: string | null;
  status: "assigned" | "shown" | "acted" | "completed" | "dismissed" | null;
  variant: "action_first" | "reflection_first" | "control" | null;
  title: string | null;
  body: string | null;
  action_label: string | null;
  action_route: string | null;
  category: string | null;
  language: "ar" | "en" | null;
  review_tier: "editorial" | "dietitian" | null;
}

export interface BehaviorPreferences {
  enabled: boolean;
  preferred_language: "ar" | "en";
  max_prompts_per_day: number;
  max_prompts_per_week: number;
  quiet_hours_start: string;
  quiet_hours_end: string;
  timezone: string;
  allowed_contexts: Array<"dashboard" | "meals" | "activity" | "progress">;
}

type RpcResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;
type RpcCall = <T>(name: string, args?: Record<string, unknown>) => RpcResult<T>;
const rpc = supabase.rpc.bind(supabase) as unknown as RpcCall;

const emptySupport: BehaviorSupport = {
  available: false,
  reason: null,
  intervention_id: null,
  status: null,
  variant: null,
  title: null,
  body: null,
  action_label: null,
  action_route: null,
  category: null,
  language: null,
  review_tier: null,
};

function normalizeSupport(value: unknown): BehaviorSupport {
  if (!value || typeof value !== "object") return emptySupport;
  const row = value as Record<string, unknown>;
  return {
    ...emptySupport,
    available: row.available === true,
    reason: typeof row.reason === "string" ? row.reason : null,
    intervention_id: typeof row.intervention_id === "string" ? row.intervention_id : null,
    status: typeof row.status === "string" ? row.status as BehaviorSupport["status"] : null,
    variant: typeof row.variant === "string" ? row.variant as BehaviorSupport["variant"] : null,
    title: typeof row.title === "string" ? row.title : null,
    body: typeof row.body === "string" ? row.body : null,
    action_label: typeof row.action_label === "string" ? row.action_label : null,
    action_route: typeof row.action_route === "string" ? row.action_route : null,
    category: typeof row.category === "string" ? row.category : null,
    language: row.language === "ar" ? "ar" : row.language === "en" ? "en" : null,
    review_tier: row.review_tier === "dietitian" ? "dietitian" : row.review_tier === "editorial" ? "editorial" : null,
  };
}

export function useBehaviorSupport(context: "dashboard" | "meals" | "activity" | "progress" = "dashboard") {
  const queryClient = useQueryClient();
  const queryKey = ["behavior-support", context] as const;

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await rpc<unknown>("get_my_behavior_support", { p_context: context });
      if (error) throw new Error(error.message);
      return normalizeSupport(data);
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const recordEvent = useMutation({
    mutationFn: async ({ interventionId, event, metadata = {} }: {
      interventionId: string;
      event: BehaviorEvent;
      metadata?: Record<string, unknown>;
    }) => {
      const { error } = await rpc<boolean>("record_my_behavior_intervention_event", {
        p_intervention_id: interventionId,
        p_event_type: event,
        p_metadata: metadata,
      });
      if (error) throw new Error(error.message);
      return event;
    },
    onSuccess: (event) => {
      if (event === "dismissed" || event === "completed") {
        queryClient.setQueryData(queryKey, (current: BehaviorSupport | undefined) => current
          ? { ...current, available: false, status: event }
          : current);
      }
    },
  });

  const submitReflection = useMutation({
    mutationFn: async ({ barrier, confidence }: { barrier: BehaviorBarrier; confidence?: number }) => {
      const { error } = await rpc<string>("submit_my_behavior_reflection", {
        p_barrier: barrier,
        p_confidence: confidence ?? null,
        p_note: null,
      });
      if (error) throw new Error(error.message);
    },
  });

  return { ...query, recordEvent, submitReflection };
}

export function useBehaviorPreferences() {
  const queryClient = useQueryClient();
  const queryKey = ["behavior-preferences"] as const;
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await rpc<BehaviorPreferences>("get_my_behavior_preferences");
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Behavior preferences are unavailable");
      return data;
    },
  });
  const update = useMutation({
    mutationFn: async (preferences: BehaviorPreferences) => {
      const { data, error } = await rpc<BehaviorPreferences>("update_my_behavior_preferences", {
        p_enabled: preferences.enabled,
        p_preferred_language: preferences.preferred_language,
        p_max_prompts_per_day: preferences.max_prompts_per_day,
        p_max_prompts_per_week: preferences.max_prompts_per_week,
        p_quiet_hours_start: preferences.quiet_hours_start,
        p_quiet_hours_end: preferences.quiet_hours_end,
        p_timezone: preferences.timezone,
        p_allowed_contexts: preferences.allowed_contexts,
      });
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Behavior preferences were not saved");
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
      queryClient.invalidateQueries({ queryKey: ["behavior-support"] });
    },
  });
  return { ...query, update };
}
