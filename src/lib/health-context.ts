import { supabase } from "@/integrations/supabase/client";

export const HEALTH_CONTEXT_AI_POLICY_VERSION = "2026-07-health-context-ai-v1";

export type HealthContextScale = 1 | 2 | 3 | 4 | 5;
export type DigestiveSymptom =
  | "bloating"
  | "reflux"
  | "constipation"
  | "diarrhea"
  | "nausea"
  | "discomfort";
export type CyclePhase = "menstrual" | "follicular" | "ovulatory" | "luteal";
export type BleedingFlow = "none" | "spotting" | "light" | "medium" | "heavy";

export interface HealthContextPreferences {
  journal_enabled: boolean;
  cycle_tracking_enabled: boolean;
  recommendation_context_enabled: boolean;
  mood_enabled: boolean;
  stress_enabled: boolean;
  appetite_enabled: boolean;
  energy_enabled: boolean;
  digestive_enabled: boolean;
  note_enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface HealthContextEntry {
  id: string;
  entry_date: string;
  mood: HealthContextScale | null;
  stress: HealthContextScale | null;
  appetite: HealthContextScale | null;
  energy: HealthContextScale | null;
  digestive_symptoms: DigestiveSymptom[];
  symptom_severity: 0 | 1 | 2 | 3 | 4 | null;
  cycle_phase: CyclePhase | null;
  bleeding_flow: BleedingFlow | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface HealthContextTrends {
  window_days: number;
  entry_count: number;
  average_mood: number | null;
  average_stress: number | null;
  average_appetite: number | null;
  average_energy: number | null;
  stress_readiness_correlation: number | null;
  phase_observations: Array<{
    cycle_phase: CyclePhase;
    entry_count: number;
    average_mood: number | null;
    average_stress: number | null;
    average_appetite: number | null;
    average_energy: number | null;
    average_readiness: number | null;
    average_nutrition_score: number | null;
  }>;
}

export interface HealthContextState {
  feature_enabled: boolean;
  has_existing_data?: boolean;
  preferences?: HealthContextPreferences;
  entries?: HealthContextEntry[];
  trends?: HealthContextTrends;
  ai_consent?: boolean;
}

export interface HealthContextEntryInput {
  entryDate: string;
  mood?: HealthContextScale | null;
  stress?: HealthContextScale | null;
  appetite?: HealthContextScale | null;
  energy?: HealthContextScale | null;
  digestiveSymptoms?: DigestiveSymptom[];
  symptomSeverity?: 0 | 1 | 2 | 3 | 4 | null;
  cyclePhase?: CyclePhase | null;
  bleedingFlow?: BleedingFlow | null;
  note?: string | null;
}

export interface HealthContextRecommendationInput {
  available: boolean;
  reason?: "feature_disabled" | "not_enabled" | "missing_or_stale" | string;
  source_date?: string;
  freshness_days?: number;
  mood?: HealthContextScale | null;
  stress?: HealthContextScale | null;
  appetite?: HealthContextScale | null;
  energy?: HealthContextScale | null;
  digestive_symptoms?: DigestiveSymptom[];
  symptom_severity?: 0 | 1 | 2 | 3 | 4 | null;
  cycle_phase?: CyclePhase | null;
  explanation_codes?: string[];
}

type RpcResult<T> = PromiseLike<{ data: T | null; error: { message?: string } | null }>;
type HealthContextClient = {
  rpc(name: string, args?: Record<string, unknown>): RpcResult<unknown>;
};

const client = supabase as unknown as HealthContextClient;

async function invoke<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.message || `HEALTH_CONTEXT_RPC_FAILED:${name}`);
  return data as T;
}

export async function fetchHealthContextState(days = 90): Promise<HealthContextState> {
  return invoke<HealthContextState>("get_health_context_state", { p_days: days });
}

export async function saveHealthContextPreferences(
  preferences: HealthContextPreferences,
): Promise<HealthContextPreferences> {
  return invoke<HealthContextPreferences>("set_health_context_preferences", {
    p_journal_enabled: preferences.journal_enabled,
    p_cycle_tracking_enabled: preferences.cycle_tracking_enabled,
    p_recommendation_context_enabled: preferences.recommendation_context_enabled,
    p_mood_enabled: preferences.mood_enabled,
    p_stress_enabled: preferences.stress_enabled,
    p_appetite_enabled: preferences.appetite_enabled,
    p_energy_enabled: preferences.energy_enabled,
    p_digestive_enabled: preferences.digestive_enabled,
    p_note_enabled: preferences.note_enabled,
  });
}

export async function saveHealthContextEntry(
  input: HealthContextEntryInput,
): Promise<HealthContextEntry> {
  return invoke<HealthContextEntry>("upsert_health_context_entry", {
    p_entry_date: input.entryDate,
    p_mood: input.mood ?? null,
    p_stress: input.stress ?? null,
    p_appetite: input.appetite ?? null,
    p_energy: input.energy ?? null,
    p_digestive_symptoms: input.digestiveSymptoms ?? [],
    p_symptom_severity: input.symptomSeverity ?? null,
    p_cycle_phase: input.cyclePhase ?? null,
    p_bleeding_flow: input.bleedingFlow ?? null,
    p_note: input.note?.trim().slice(0, 800) || null,
  });
}

export async function deleteHealthContextEntry(entryId: string): Promise<boolean> {
  return invoke<boolean>("delete_health_context_entry", { p_entry_id: entryId });
}

export async function setHealthContextAiConsent(granted: boolean): Promise<boolean> {
  return invoke<boolean>("set_health_context_ai_consent", {
    p_granted: granted,
    p_policy_version: HEALTH_CONTEXT_AI_POLICY_VERSION,
  });
}

export async function deleteHealthContextDataset(): Promise<{
  deleted_entries: number;
  consent_revoked: boolean;
}> {
  return invoke("delete_health_context_dataset");
}

export async function getHealthContextRecommendationInput(
  date: string,
): Promise<HealthContextRecommendationInput> {
  return invoke<HealthContextRecommendationInput>(
    "get_health_context_recommendation_input",
    { p_on_date: date },
  );
}

export async function getConsentedHealthContextAiSummary(days = 30): Promise<Record<string, unknown> | null> {
  return invoke("get_health_context_ai_summary", { p_days: days });
}

export async function exportUserDataWithHealthContext(): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke("export-user-data", {
    body: { format: "json" },
  });
  if (error) throw error;
  return data;
}
