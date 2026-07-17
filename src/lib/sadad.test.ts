import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
  },
}));

import { supabase } from "@/integrations/supabase/client";
import { sadadService, type SadadCheckoutResponse } from "@/lib/sadad";

const invoke = vi.mocked(supabase.functions.invoke);

describe("sadadService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a server-priced coach payment without a caller amount", async () => {
    const response: SadadCheckoutResponse = {
      payment_id: "payment-1",
      amount: 75,
      currency: "QAR",
      payment_type: "coach_subscription",
      description: "Coach subscription - weekly",
      form_action: "https://sadadqa.com/webpurchase",
      form_method: "POST",
      fields: { ORDER_ID: "payment-1", TXN_AMOUNT: "75.00" },
    };
    invoke.mockResolvedValue({ data: response, error: null });

    await expect(sadadService.createPayment({
      paymentType: "coach_subscription",
      referenceId: "coach-1",
      coachPlan: "weekly",
      mobileNumber: "+97450000000",
    })).resolves.toEqual(response);

    expect(invoke).toHaveBeenCalledWith("sadad-payment", {
      body: {
        op: "create",
        payload: {
          paymentType: "coach_subscription",
          referenceId: "coach-1",
          coachPlan: "weekly",
          mobileNumber: "+97450000000",
        },
      },
    });
    expect(JSON.stringify(invoke.mock.calls[0])).not.toContain('"amount"');
  });

  it("surfaces a fail-closed payment preparation error", async () => {
    invoke.mockResolvedValue({
      data: { error: "COACH_PRICING_NOT_FOUND" },
      error: null,
    });

    await expect(sadadService.createPayment({
      paymentType: "coach_subscription",
      referenceId: "coach-1",
      coachPlan: "monthly",
      mobileNumber: "50000000",
    })).rejects.toThrow("COACH_PRICING_NOT_FOUND");
  });

  it("surfaces the structured error returned by a non-2xx edge function response", async () => {
    const context = {
      clone: () => ({
        json: async () => ({ error: "SADAD_SERVER_CONFIGURATION_MISSING" }),
      }),
    };
    invoke.mockResolvedValue({
      data: null,
      error: Object.assign(new Error("Edge Function returned a non-2xx status code"), { context }),
    });

    await expect(sadadService.createPayment({
      paymentType: "wallet_topup",
      referenceId: "package-1",
      mobileNumber: "50000000",
    })).rejects.toThrow("SADAD_SERVER_CONFIGURATION_MISSING");
  });

  it("reads payment status from the authenticated server function", async () => {
    invoke.mockResolvedValue({
      data: {
        payment_id: "payment-1",
        amount: 75,
        currency: "QAR",
        payment_type: "coach_subscription",
        status: "completed",
        fulfillment_status: "completed",
        description: "Coach subscription - weekly",
        metadata: { coach_id: "coach-1" },
        transaction_id: "sadad-transaction",
        created_at: "2026-07-12T00:00:00Z",
        completed_at: "2026-07-12T00:01:00Z",
        error: null,
      },
      error: null,
    });

    const result = await sadadService.getPaymentStatus("payment-1");

    expect(result.metadata.coach_id).toBe("coach-1");
    expect(invoke).toHaveBeenCalledWith("sadad-payment", {
      body: { op: "status", payload: { paymentId: "payment-1" } },
    });
  });
});
