import { supabase } from "@/integrations/supabase/client";
import type { PartnerIntegrationRecord } from "@/lib/partnerTracking";

export type SportHubActivitySession = {
  id: string;
  activity_type: string;
  venue_name: string | null;
  starts_at: string;
  ends_at: string | null;
  duration_minutes: number | null;
  calories_burned: number | null;
  status: "booked" | "confirmed" | "completed" | "cancelled" | "no_show";
};

type PartnerDb = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: unknown) => {
        eq: (column: string, value: unknown) => {
          order: (column: string, options: { ascending: boolean }) => Promise<{ data: SportHubActivitySession[] | null; error: Error | null }>;
          maybeSingle: () => Promise<{ data: PartnerIntegrationRecord | null; error: Error | null }>;
        };
        maybeSingle: () => Promise<{ data: PartnerIntegrationRecord | null; error: Error | null }>;
      };
    };
  };
};

const partnerDb = supabase as unknown as PartnerDb;

export async function getSportHubIntegration(userId: string) {
  const { data, error } = await partnerDb.from("partner_integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("partner", "sporthub")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getSportHubActivitySessions(userId: string) {
  const { data, error } = await partnerDb.from("partner_activity_sessions")
    .select("id,activity_type,venue_name,starts_at,ends_at,duration_minutes,calories_burned,status")
    .eq("user_id", userId)
    .eq("partner", "sporthub")
    .order("starts_at", { ascending: false });
  if (error) {
    // Keep the Activity page usable while a new partner schema is rolling out.
    if ((error as Error & { code?: string }).code === "42P01") return [];
    throw error;
  }
  return data ?? [];
}

export async function startSportHubLink(redirectPath = "/dashboard/activity") {
  const { data, error } = await supabase.functions.invoke("sporthub-link-start", {
    body: { redirect_path: redirectPath },
  });
  if (error) throw error;
  if (!data?.authorization_url) throw new Error(data?.error || "SportHub authorization URL is missing");
  return data.authorization_url as string;
}

export async function completeSportHubLink(completionToken: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(completionToken)) {
    throw new Error("SportHub completion token is invalid");
  }
  const { data, error } = await supabase.functions.invoke("sporthub-link-complete", {
    body: { completion_token: completionToken },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || "SportHub link confirmation failed");
  return data as { ok: true; integration_id: string };
}

export async function unlinkSportHub() {
  const { data, error } = await supabase.functions.invoke("sporthub-unlink", { body: {} });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || "SportHub unlink failed");
}

export async function syncSportHub() {
  const { data, error } = await supabase.functions.invoke("sporthub-sync", { body: {} });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || "SportHub sync failed");
  return data as { ok: true; synced: number; last_synced_at: string };
}
