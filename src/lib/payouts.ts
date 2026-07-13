import { supabase } from "@/integrations/supabase/client";

export type AffiliatePayoutAction = "approve" | "reject" | "complete";
export type CoachWithdrawalAction = "approve" | "reject" | "process";
export type PartnerPayoutAction = "start" | "complete" | "reject";
export type DriverPayoutAction = "start" | "pay" | "reject";

export interface PayoutMutationResult {
  success: boolean;
  duplicate?: boolean;
  payout_id?: string;
  withdrawal_id?: string;
  status: string;
  amount?: number;
  available_balance?: number;
}

type PayoutRpcClient = typeof supabase & {
  rpc(
    fn: "request_affiliate_payout",
    args: {
      p_request_key: string;
      p_amount: number;
      p_method: string;
      p_details: Record<string, string>;
    },
  ): Promise<{ data: PayoutMutationResult | null; error: Error | null }>;
  rpc(
    fn: "transition_affiliate_payout",
    args: {
      p_payout_id: string;
      p_action: AffiliatePayoutAction;
      p_notes: string | null;
      p_transfer_reference: string | null;
    },
  ): Promise<{ data: PayoutMutationResult | null; error: Error | null }>;
  rpc(
    fn: "get_coach_available_balance",
    args: { p_coach_id: string },
  ): Promise<{ data: number | null; error: Error | null }>;
  rpc(
    fn: "request_coach_withdrawal",
    args: {
      p_request_key: string;
      p_amount: number;
      p_bank_name: string;
      p_iban: string;
      p_account_holder: string;
    },
  ): Promise<{ data: PayoutMutationResult | null; error: Error | null }>;
  rpc(
    fn: "transition_coach_withdrawal",
    args: {
      p_withdrawal_id: string;
      p_action: CoachWithdrawalAction;
      p_notes: string | null;
      p_transfer_reference: string | null;
    },
  ): Promise<{ data: PayoutMutationResult | null; error: Error | null }>;
  rpc(
    fn: "settle_coach_earnings",
    args: { p_earning_ids: string[] },
  ): Promise<{
    data: { success: boolean; released_count: number; released_amount: number } | null;
    error: Error | null;
  }>;
  rpc(
    fn: "request_partner_payout",
    args: {
      p_restaurant_id: string;
      p_request_key: string;
      p_period_start: string | null;
      p_period_end: string | null;
      p_request_source: "partner";
    },
  ): Promise<{ data: PayoutMutationResult | null; error: Error | null }>;
  rpc(
    fn: "transition_partner_payout",
    args: {
      p_payout_id: string;
      p_action: PartnerPayoutAction;
      p_reference_number: string | null;
      p_notes: string | null;
    },
  ): Promise<{ data: PayoutMutationResult | null; error: Error | null }>;
  rpc(
    fn: "transition_legacy_partner_payout",
    args: {
      p_payout_id: string;
      p_action: "process" | "reject";
      p_reference_number: string | null;
    },
  ): Promise<{ data: PayoutMutationResult | null; error: Error | null }>;
  rpc(
    fn: "request_driver_payout",
    args: {
      p_request_key: string;
      p_bank_name: string;
      p_account_number: string;
      p_account_name: string;
    },
  ): Promise<{ data: PayoutMutationResult | null; error: Error | null }>;
  rpc(
    fn: "create_driver_payout_for_operator",
    args: {
      p_driver_id: string;
      p_period_start: string;
      p_period_end: string;
      p_request_key: string;
    },
  ): Promise<{ data: PayoutMutationResult | null; error: Error | null }>;
  rpc(
    fn: "transition_driver_payout",
    args: {
      p_payout_id: string;
      p_action: DriverPayoutAction;
      p_payment_reference: string | null;
      p_notes: string | null;
    },
  ): Promise<{ data: PayoutMutationResult | null; error: Error | null }>;
};

const payoutRpc = supabase as PayoutRpcClient;

function requireResult<T extends { success: boolean }>(data: T | null, fallback: string): T {
  if (!data?.success) throw new Error(fallback);
  return data;
}

export async function requestAffiliatePayout(
  amount: number,
  method: string,
  details: Record<string, string>,
  requestKey = crypto.randomUUID(),
) {
  const { data, error } = await payoutRpc.rpc("request_affiliate_payout", {
    p_request_key: requestKey,
    p_amount: amount,
    p_method: method,
    p_details: details,
  });
  if (error) throw error;
  return requireResult(data, "AFFILIATE_PAYOUT_REQUEST_FAILED");
}

export async function transitionAffiliatePayout(
  payoutId: string,
  action: AffiliatePayoutAction,
  notes?: string,
  transferReference?: string,
) {
  const { data, error } = await payoutRpc.rpc("transition_affiliate_payout", {
    p_payout_id: payoutId,
    p_action: action,
    p_notes: notes?.trim() || null,
    p_transfer_reference: transferReference?.trim() || null,
  });
  if (error) throw error;
  return requireResult(data, "AFFILIATE_PAYOUT_TRANSITION_FAILED");
}

export async function getCoachAvailableBalance(coachId: string) {
  const { data, error } = await payoutRpc.rpc("get_coach_available_balance", {
    p_coach_id: coachId,
  });
  if (error) throw error;
  return Number(data || 0);
}

export async function requestCoachWithdrawal(
  amount: number,
  bankName: string,
  iban: string,
  accountHolder: string,
  requestKey = crypto.randomUUID(),
) {
  const { data, error } = await payoutRpc.rpc("request_coach_withdrawal", {
    p_request_key: requestKey,
    p_amount: amount,
    p_bank_name: bankName,
    p_iban: iban,
    p_account_holder: accountHolder,
  });
  if (error) throw error;
  return requireResult(data, "COACH_WITHDRAWAL_REQUEST_FAILED");
}

export async function transitionCoachWithdrawal(
  withdrawalId: string,
  action: CoachWithdrawalAction,
  notes?: string,
  transferReference?: string,
) {
  const { data, error } = await payoutRpc.rpc("transition_coach_withdrawal", {
    p_withdrawal_id: withdrawalId,
    p_action: action,
    p_notes: notes?.trim() || null,
    p_transfer_reference: transferReference?.trim() || null,
  });
  if (error) throw error;
  return requireResult(data, "COACH_WITHDRAWAL_TRANSITION_FAILED");
}

export async function settleCoachEarnings(earningIds: string[]) {
  const { data, error } = await payoutRpc.rpc("settle_coach_earnings", {
    p_earning_ids: earningIds,
  });
  if (error) throw error;
  return requireResult(data, "COACH_EARNINGS_SETTLEMENT_FAILED");
}

export async function requestPartnerPayout(
  restaurantId: string,
  requestKey = crypto.randomUUID(),
) {
  const { data, error } = await payoutRpc.rpc("request_partner_payout", {
    p_restaurant_id: restaurantId,
    p_request_key: requestKey,
    p_period_start: null,
    p_period_end: null,
    p_request_source: "partner",
  });
  if (error) throw error;
  return requireResult(data, "PARTNER_PAYOUT_REQUEST_FAILED");
}

export async function transitionPartnerPayout(
  payoutId: string,
  action: PartnerPayoutAction,
  referenceNumber?: string,
  notes?: string,
) {
  const { data, error } = await payoutRpc.rpc("transition_partner_payout", {
    p_payout_id: payoutId,
    p_action: action,
    p_reference_number: referenceNumber?.trim() || null,
    p_notes: notes?.trim() || null,
  });
  if (error) throw error;
  return requireResult(data, "PARTNER_PAYOUT_TRANSITION_FAILED");
}

export async function transitionLegacyPartnerPayout(
  payoutId: string,
  action: "process" | "reject",
  referenceNumber?: string,
) {
  const { data, error } = await payoutRpc.rpc("transition_legacy_partner_payout", {
    p_payout_id: payoutId,
    p_action: action,
    p_reference_number: referenceNumber?.trim() || null,
  });
  if (error) throw error;
  return requireResult(data, "LEGACY_PARTNER_PAYOUT_TRANSITION_FAILED");
}

export async function requestDriverPayout(
  bankName: string,
  accountNumber: string,
  accountName: string,
  requestKey = crypto.randomUUID(),
) {
  const { data, error } = await payoutRpc.rpc("request_driver_payout", {
    p_request_key: requestKey,
    p_bank_name: bankName.trim(),
    p_account_number: accountNumber.trim(),
    p_account_name: accountName.trim(),
  });
  if (error) throw error;
  return requireResult(data, "DRIVER_PAYOUT_REQUEST_FAILED");
}

export async function createDriverPayoutForOperator(
  driverId: string,
  periodStart: string,
  periodEnd: string,
  requestKey = crypto.randomUUID(),
) {
  const { data, error } = await payoutRpc.rpc("create_driver_payout_for_operator", {
    p_driver_id: driverId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_request_key: requestKey,
  });
  if (error) throw error;
  return requireResult(data, "DRIVER_PAYOUT_CREATION_FAILED");
}

export async function transitionDriverPayout(
  payoutId: string,
  action: DriverPayoutAction,
  paymentReference?: string,
  notes?: string,
) {
  const { data, error } = await payoutRpc.rpc("transition_driver_payout", {
    p_payout_id: payoutId,
    p_action: action,
    p_payment_reference: paymentReference?.trim() || null,
    p_notes: notes?.trim() || null,
  });
  if (error) throw error;
  return requireResult(data, "DRIVER_PAYOUT_TRANSITION_FAILED");
}
