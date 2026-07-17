import { supabase } from "@/integrations/supabase/client";

export type PartnerPayoutFrequency = "weekly" | "biweekly" | "monthly";

export interface PartnerBankingSummary {
  restaurant_id: string;
  /** Masked compatibility alias. This value must never contain a full bank name. */
  bank_name: string | null;
  bank_name_masked: string | null;
  bank_account_name_masked: string | null;
  bank_account_number_masked: string | null;
  bank_iban_masked: string | null;
  swift_code_masked: string | null;
  payout_frequency: PartnerPayoutFrequency;
  is_configured: boolean;
  updated_at: string | null;
}

export interface PartnerBankingInput {
  restaurantId: string;
  bankName?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  iban?: string | null;
  swiftCode?: string | null;
  payoutFrequency?: PartnerPayoutFrequency | null;
}

export interface CompletePartnerOnboardingInput {
  requestKey: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  email?: string | null;
  websiteUrl?: string | null;
  logoUrl?: string | null;
  cuisineTypes: string[];
  dietaryTags: string[];
  operatingHours: Record<string, unknown>;
  averagePreparationMinutes: number;
  maximumMealsPerDay: number;
  bankName: string;
  accountName: string;
  accountNumber: string;
  iban?: string | null;
  swiftCode?: string | null;
  payoutFrequency?: PartnerPayoutFrequency;
  termsAccepted: boolean;
}

export interface CompletePartnerOnboardingResult {
  restaurantId: string;
  duplicate: boolean;
  reusedExisting: boolean;
}

interface RpcErrorShape {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  status?: number;
}

interface RpcResult {
  data: unknown;
  error: RpcErrorShape | null;
}

interface BankingRpcClient {
  rpc(
    functionName: string,
    args: Record<string, unknown>,
  ): PromiseLike<RpcResult>;
}

export class PartnerBankingRpcError extends Error {
  readonly code?: string;
  readonly status?: number;

  constructor(error: RpcErrorShape | null, fallback: string) {
    super(error?.message || fallback);
    this.name = "PartnerBankingRpcError";
    this.code = error?.code;
    this.status = error?.status;
  }
}

const bankingRpcClient = supabase as unknown as BankingRpcClient;

const nullableString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;

const payoutFrequency = (value: unknown): PartnerPayoutFrequency => {
  if (value === "biweekly" || value === "monthly") return value;
  return "weekly";
};

const maskDisplayLabel = (value: unknown): string | null => {
  const label = nullableString(value);
  if (!label) return null;

  // Preserve server-side masks while defensively masking legacy plaintext
  // responses during the migration window.
  if (/^\*{1,80}$/u.test(label) || /^.\*{1,8}.$/u.test(label)) {
    return label.slice(0, 80);
  }
  if (label.length <= 2) return "*".repeat(label.length);

  return `${label[0]}${"*".repeat(Math.min(label.length - 2, 8))}${label.at(-1)}`;
};

const maskLastFour = (value: unknown): string | null => {
  const identifier = nullableString(value);
  if (!identifier) return null;

  const compact = identifier.replace(/[^a-z0-9]/gi, "");
  if (compact) return `****${compact.slice(-4)}`;
  return /^\*{4}$/u.test(identifier) ? "****" : null;
};

const maskSwiftCode = (value: unknown): string | null => {
  const swift = nullableString(value);
  if (!swift) return null;
  if (/^[A-Z0-9]{4}\*{4}(?:[A-Z0-9]{2})?$/u.test(swift)) {
    return swift;
  }

  const compact = swift.replace(/[^a-z0-9]/gi, "").toUpperCase();
  if (compact.length <= 4) return "*".repeat(compact.length);
  return `${compact.slice(0, 4)}****${compact.length > 6 ? compact.slice(-2) : ""}`;
};

const rpcError = (error: RpcErrorShape | null, fallback: string): Error =>
  new PartnerBankingRpcError(error, fallback);

export const isAtomicPartnerOnboardingUnavailable = (
  error: unknown,
): boolean => {
  if (!(error instanceof Error)) return false;

  const code =
    error instanceof PartnerBankingRpcError ? error.code : undefined;
  if (code === "PGRST202" || code === "42883") return true;

  return /complete_partner_onboarding.*(not found|schema cache|does not exist)/i.test(
    error.message,
  );
};

export const isPartnerOnboardingOutcomeAmbiguous = (
  error: unknown,
): boolean => {
  if (!(error instanceof Error)) return true;

  if (error instanceof PartnerBankingRpcError) {
    if (typeof error.status === "number" && error.status >= 500) return true;
    if (!error.code) return true;

    // PostgREST connection and pool failures may happen after PostgreSQL has
    // accepted a request but before the response reaches the browser.
    return /^PGRST00[0-3]$/.test(error.code);
  }

  return true;
};

export async function getPartnerBankingSummary(
  restaurantId: string,
): Promise<PartnerBankingSummary> {
  const { data, error } = await bankingRpcClient.rpc(
    "get_restaurant_banking_summary",
    { p_restaurant_id: restaurantId },
  );

  if (error) throw rpcError(error, "Failed to load banking summary");

  const row =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  const bankNameMasked = maskDisplayLabel(
    row.bank_name_masked ?? row.bank_name,
  );

  return {
    restaurant_id: nullableString(row.restaurant_id) || restaurantId,
    bank_name: bankNameMasked,
    bank_name_masked: bankNameMasked,
    bank_account_name_masked: maskDisplayLabel(
      row.bank_account_name_masked,
    ),
    bank_account_number_masked: maskLastFour(
      row.bank_account_number_masked,
    ),
    bank_iban_masked: maskLastFour(row.bank_iban_masked),
    swift_code_masked: maskSwiftCode(row.swift_code_masked),
    payout_frequency: payoutFrequency(row.payout_frequency),
    is_configured: row.is_configured === true,
    updated_at: nullableString(row.updated_at),
  };
}

export async function savePartnerBankingInfo(
  input: PartnerBankingInput,
): Promise<void> {
  const { error } = await bankingRpcClient.rpc("set_restaurant_banking_info", {
    p_restaurant_id: input.restaurantId,
    p_bank_name: input.bankName || null,
    p_bank_account_name: input.accountName || null,
    p_bank_account_number: input.accountNumber || null,
    p_bank_iban: input.iban || null,
    p_swift_code: input.swiftCode || null,
    p_payout_frequency: input.payoutFrequency || null,
  });

  if (error) throw rpcError(error, "Failed to save banking information");
}

export async function completePartnerOnboarding(
  input: CompletePartnerOnboardingInput,
): Promise<CompletePartnerOnboardingResult> {
  const { data, error } = await bankingRpcClient.rpc(
    "complete_partner_onboarding",
    {
      p_request_key: input.requestKey,
      p_name: input.name,
      p_description: input.description,
      p_address: input.address,
      p_phone: input.phone,
      p_email: input.email || null,
      p_website_url: input.websiteUrl || null,
      p_logo_url: input.logoUrl || null,
      p_cuisine_types: input.cuisineTypes,
      p_dietary_tags: input.dietaryTags,
      p_operating_hours: input.operatingHours,
      p_avg_prep_time_minutes: input.averagePreparationMinutes,
      p_max_meals_per_day: input.maximumMealsPerDay,
      p_bank_name: input.bankName,
      p_bank_account_name: input.accountName,
      p_bank_account_number: input.accountNumber,
      p_bank_iban: input.iban || null,
      p_swift_code: input.swiftCode || null,
      p_payout_frequency: input.payoutFrequency || "weekly",
      p_terms_accepted: input.termsAccepted,
    },
  );

  if (error) throw rpcError(error, "Failed to complete partner onboarding");

  const row =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  const restaurantId = nullableString(row.restaurant_id);

  if (!restaurantId) {
    throw new Error("Invalid partner onboarding response");
  }

  return {
    restaurantId,
    duplicate: row.duplicate === true,
    reusedExisting: row.reused_existing === true,
  };
}
