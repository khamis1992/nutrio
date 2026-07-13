import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn() },
}));

import { supabase } from "@/integrations/supabase/client";
import {
  createDriverPayoutForOperator,
  requestAffiliatePayout,
  requestCoachWithdrawal,
  requestDriverPayout,
  requestPartnerPayout,
  transitionAffiliatePayout,
  transitionCoachWithdrawal,
  transitionDriverPayout,
  transitionPartnerPayout,
} from "@/lib/payouts";

const rpc = vi.mocked(supabase.rpc);

describe("payout RPC contracts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requests an affiliate payout without a caller user or balance", async () => {
    rpc.mockResolvedValue({
      data: { success: true, status: "pending", payout_id: "payout-1" },
      error: null,
    } as never);

    await requestAffiliatePayout(
      100,
      "bank_transfer",
      { accountName: "Khamis", bankName: "Bank", accountNumber: "QA001" },
      "00000000-0000-4000-8000-000000000001",
    );

    expect(rpc).toHaveBeenCalledWith("request_affiliate_payout", {
      p_request_key: "00000000-0000-4000-8000-000000000001",
      p_amount: 100,
      p_method: "bank_transfer",
      p_details: { accountName: "Khamis", bankName: "Bank", accountNumber: "QA001" },
    });
  });

  it("requires the admin transition RPC for payout completion", async () => {
    rpc.mockResolvedValue({
      data: { success: true, status: "completed", payout_id: "payout-1" },
      error: null,
    } as never);

    await transitionAffiliatePayout("payout-1", "complete", "Sent", "BANK-123");

    expect(rpc).toHaveBeenCalledWith("transition_affiliate_payout", {
      p_payout_id: "payout-1",
      p_action: "complete",
      p_notes: "Sent",
      p_transfer_reference: "BANK-123",
    });
  });

  it("requests a coach withdrawal without a caller coach id", async () => {
    rpc.mockResolvedValue({
      data: { success: true, status: "pending", withdrawal_id: "withdrawal-1" },
      error: null,
    } as never);

    await requestCoachWithdrawal(
      250,
      "Qatar Bank",
      "QA00TEST1234567890123456789",
      "Khamis",
      "00000000-0000-4000-8000-000000000002",
    );

    expect(JSON.stringify(rpc.mock.calls[0])).not.toContain("coach_id");
    expect(rpc).toHaveBeenCalledWith("request_coach_withdrawal", expect.objectContaining({
      p_amount: 250,
      p_request_key: "00000000-0000-4000-8000-000000000002",
    }));
  });

  it("propagates illegal withdrawal transitions", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("INVALID_WITHDRAWAL_TRANSITION") } as never);

    await expect(
      transitionCoachWithdrawal("withdrawal-1", "process", undefined, "BANK-123"),
    ).rejects.toThrow("INVALID_WITHDRAWAL_TRANSITION");
  });

  it("requests a partner payout without trusting a browser amount", async () => {
    rpc.mockResolvedValue({
      data: { success: true, status: "pending", payout_id: "partner-payout-1", amount: 450 },
      error: null,
    } as never);

    await requestPartnerPayout(
      "restaurant-1",
      "00000000-0000-4000-8000-000000000003",
    );

    expect(JSON.stringify(rpc.mock.calls[0])).not.toContain('"amount"');
    expect(rpc).toHaveBeenCalledWith("request_partner_payout", {
      p_restaurant_id: "restaurant-1",
      p_request_key: "00000000-0000-4000-8000-000000000003",
      p_period_start: null,
      p_period_end: null,
      p_request_source: "partner",
    });
  });

  it("requires the partner state machine for settlement", async () => {
    rpc.mockResolvedValue({
      data: { success: true, status: "completed", payout_id: "partner-payout-1" },
      error: null,
    } as never);

    await transitionPartnerPayout("partner-payout-1", "complete", "BANK-456");

    expect(rpc).toHaveBeenCalledWith("transition_partner_payout", {
      p_payout_id: "partner-payout-1",
      p_action: "complete",
      p_reference_number: "BANK-456",
      p_notes: null,
    });
  });

  it("requests a driver payout without a caller amount or driver id", async () => {
    rpc.mockResolvedValue({
      data: { success: true, status: "pending", payout_id: "driver-payout-1", amount: 125 },
      error: null,
    } as never);

    await requestDriverPayout(
      "Qatar Bank",
      "QA001234",
      "Khamis",
      "00000000-0000-4000-8000-000000000004",
    );

    expect(JSON.stringify(rpc.mock.calls[0])).not.toContain("driver_id");
    expect(JSON.stringify(rpc.mock.calls[0])).not.toContain('"amount"');
  });

  it("creates and transitions fleet payouts through server contracts", async () => {
    rpc.mockResolvedValue({
      data: { success: true, status: "pending", payout_id: "driver-payout-1" },
      error: null,
    } as never);

    await createDriverPayoutForOperator(
      "driver-1",
      "2026-07-01",
      "2026-07-12",
      "00000000-0000-4000-8000-000000000005",
    );
    await transitionDriverPayout("driver-payout-1", "pay", "BANK-789");

    expect(rpc).toHaveBeenLastCalledWith("transition_driver_payout", {
      p_payout_id: "driver-payout-1",
      p_action: "pay",
      p_payment_reference: "BANK-789",
      p_notes: null,
    });
  });
});
