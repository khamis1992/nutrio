import { supabase } from "@/integrations/supabase/client";

type PartnerTrackingInput = {
  userId?: string | null;
  partner: string;
  campaign: string;
  referralCode?: string;
  eventType?: string;
  metadata?: Record<string, unknown>;
};

type PartnerReferralStatusInput = {
  userId?: string | null;
  sourceApp: string;
  targetApp: string;
  campaign?: string | null;
  referralCode?: string | null;
  status: "clicked" | "signed_up" | "converted" | "expired" | "rejected";
  metadata?: Record<string, unknown>;
};

export type PartnerIntegrationRecord = {
  id: string;
  user_id: string;
  partner: string;
  external_user_id: string | null;
  consent_status: "pending" | "linked" | "revoked" | "failed" | "reauth_required";
  linked_at: string | null;
  unlinked_at: string | null;
  last_synced_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type IntegrationQueryBuilder = {
  eq: (column: string, value: unknown) => IntegrationQueryBuilder;
  maybeSingle: () => Promise<{ data: PartnerIntegrationRecord | null; error: Error | null }>;
};

type IntegrationUpsertBuilder = {
  select: (columns: string) => {
    maybeSingle: () => Promise<{ data: PartnerIntegrationRecord | null; error: Error | null }>;
  };
};

const partnerDb = supabase as unknown as {
  from: (table: string) => {
    insert: (values: Record<string, unknown>) => Promise<{ error: Error | null }>;
    select: (columns: string) => IntegrationQueryBuilder;
    upsert: (values: Record<string, unknown>, options?: { onConflict?: string }) => IntegrationUpsertBuilder;
  };
};

export async function getPartnerIntegration({
  userId,
  partner,
}: {
  userId?: string | null;
  partner: string;
}) {
  if (!userId) return null;

  const { data, error } = await partnerDb
    .from("partner_integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("partner", partner)
    .maybeSingle();

  if (error) {
    console.error("Failed to load partner integration:", error);
    return null;
  }

  return data;
}

export async function upsertPartnerIntegration({
  userId,
  partner,
  consentStatus,
  metadata = {},
}: {
  userId?: string | null;
  partner: string;
  consentStatus: PartnerIntegrationRecord["consent_status"];
  metadata?: Record<string, unknown>;
}) {
  if (!userId) return null;

  const now = new Date().toISOString();
  const { data, error } = await partnerDb
    .from("partner_integrations")
    .upsert(
      {
        user_id: userId,
        partner,
        consent_status: consentStatus,
        linked_at: consentStatus === "linked" ? now : null,
        unlinked_at: consentStatus === "revoked" ? now : null,
        metadata,
        updated_at: now,
      },
      { onConflict: "user_id,partner" },
    )
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("Failed to save partner integration:", error);
    return null;
  }

  return data;
}

export async function recordPartnerReferralClick({
  userId,
  partner,
  campaign,
  referralCode,
  metadata = {},
}: PartnerTrackingInput) {
  if (!userId) return;

  const { error } = await partnerDb.from("partner_referrals").insert({
    source_app: "nutrio",
    target_app: partner,
    user_id: userId,
    referral_code: referralCode,
    campaign,
    status: "clicked",
    metadata,
  });

  if (error) {
    console.error("Failed to record partner referral click:", error);
  }
}

export async function recordPartnerReferralStatus({
  userId,
  sourceApp,
  targetApp,
  campaign,
  referralCode,
  status,
  metadata = {},
}: PartnerReferralStatusInput) {
  if (!userId) return;

  const { error } = await partnerDb.from("partner_referrals").insert({
    source_app: sourceApp,
    target_app: targetApp,
    user_id: userId,
    referral_code: referralCode,
    campaign,
    status,
    metadata,
  });

  if (error) {
    console.error("Failed to record partner referral status:", error);
  }
}

export async function recordPartnerEvent({
  userId,
  partner,
  campaign,
  eventType = "partner_cta_clicked",
  referralCode,
  metadata = {},
}: PartnerTrackingInput) {
  if (!userId) return;

  const { error } = await partnerDb.from("partner_events").insert({
    user_id: userId,
    partner,
    event_type: eventType,
    payload: {
      campaign,
      referral_code: referralCode,
      ...metadata,
    },
  });

  if (error) {
    console.error("Failed to record partner event:", error);
  }
}

export function recordSportHubClick(input: {
  userId?: string | null;
  campaign: string;
  eventType?: string;
  metadata?: Record<string, unknown>;
}) {
  const payload = {
    userId: input.userId,
    partner: "sporthub",
    campaign: input.campaign,
    eventType: input.eventType,
    referralCode: "NUTRIO15",
    metadata: input.metadata,
  };

  void recordPartnerReferralClick(payload);
  void recordPartnerEvent(payload);
}

export function recordSportHubEvent(input: {
  userId?: string | null;
  campaign: string;
  eventType: string;
  metadata?: Record<string, unknown>;
}) {
  void recordPartnerEvent({
    userId: input.userId,
    partner: "sporthub",
    campaign: input.campaign,
    eventType: input.eventType,
    referralCode: "NUTRIO15",
    metadata: input.metadata,
  });
}
