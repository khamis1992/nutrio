import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn() },
}));

import { supabase } from "@/integrations/supabase/client";
import {
  completePartnerOnboarding,
  getPartnerBankingSummary,
  isAtomicPartnerOnboardingUnavailable,
  isPartnerOnboardingOutcomeAmbiguous,
  PartnerBankingRpcError,
  savePartnerBankingInfo,
} from "@/lib/partner-banking";

const rpc = vi.mocked(supabase.rpc);

describe("partner banking security contracts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("never exposes legacy plaintext banking values to React callers", async () => {
    rpc.mockResolvedValue({
      data: {
        restaurant_id: "restaurant-1",
        bank_name: "Qatar National Bank",
        bank_account_name_masked: "Sensitive Account Holder",
        bank_account_number_masked: "1234567890123456",
        bank_iban_masked: "QA001234567890123456789012345",
        swift_code_masked: "QNBAQAQA123",
        payout_frequency: "weekly",
        is_configured: true,
        updated_at: "2026-07-17T09:10:00.000Z",
      },
      error: null,
    } as never);

    const summary = await getPartnerBankingSummary("restaurant-1");
    const serialized = JSON.stringify(summary);

    expect(summary.bank_name).toBe("Q********k");
    expect(summary.bank_name_masked).toBe("Q********k");
    expect(summary.bank_account_name_masked).toBe("S********r");
    expect(summary.bank_account_number_masked).toBe("****3456");
    expect(summary.bank_iban_masked).toBe("****2345");
    expect(summary.swift_code_masked).toBe("QNBA****23");
    expect(serialized).not.toContain("Qatar National Bank");
    expect(serialized).not.toContain("Sensitive Account Holder");
    expect(serialized).not.toContain("1234567890123456");
  });

  it("keeps already masked server values stable", async () => {
    rpc.mockResolvedValue({
      data: {
        restaurant_id: "restaurant-1",
        bank_name_masked: "Q******k",
        bank_account_name_masked: "K***s",
        bank_account_number_masked: "****7788",
        bank_iban_masked: "****9900",
        swift_code_masked: "QNBA****23",
        payout_frequency: "monthly",
        is_configured: true,
      },
      error: null,
    } as never);

    const summary = await getPartnerBankingSummary("restaurant-1");

    expect(summary).toEqual(
      expect.objectContaining({
        bank_name: "Q******k",
        bank_name_masked: "Q******k",
        bank_account_number_masked: "****7788",
        payout_frequency: "monthly",
      }),
    );
  });

  it("uses one atomic RPC and does not trust a browser owner id", async () => {
    rpc.mockResolvedValue({
      data: {
        restaurant_id: "restaurant-1",
        onboarding_completed: true,
        duplicate: false,
        reused_existing: true,
        bank_account_number: "must-be-ignored",
      },
      error: null,
    } as never);

    const result = await completePartnerOnboarding({
      requestKey: "00000000-0000-4000-8000-000000000017",
      name: "Secure Kitchen",
      description: "Healthy food prepared daily.",
      address: "Doha, Qatar",
      phone: "+97450000000",
      email: "partner@example.com",
      websiteUrl: "https://example.com",
      logoUrl: "https://example.supabase.co/storage/v1/object/public/logo.png",
      cuisineTypes: ["Healthy"],
      dietaryTags: ["High-Protein"],
      operatingHours: {
        sunday: { is_open: true, open: "09:00", close: "22:00" },
      },
      averagePreparationMinutes: 30,
      maximumMealsPerDay: 50,
      bankName: "Qatar National Bank",
      accountName: "Secure Kitchen LLC",
      accountNumber: "1234567890",
      iban: "QA00TEST1234567890123456789",
      payoutFrequency: "weekly",
      termsAccepted: true,
    });

    expect(result).toEqual({
      restaurantId: "restaurant-1",
      duplicate: false,
      reusedExisting: true,
    });
    expect(JSON.stringify(result)).not.toContain("must-be-ignored");
    expect(rpc).toHaveBeenCalledWith(
      "complete_partner_onboarding",
      expect.objectContaining({
        p_request_key: "00000000-0000-4000-8000-000000000017",
        p_bank_account_number: "1234567890",
        p_terms_accepted: true,
      }),
    );
    expect(JSON.stringify(rpc.mock.calls[0])).not.toContain("owner_id");
    expect(JSON.stringify(rpc.mock.calls[0])).not.toContain("user_id");
  });

  it("recognizes only a missing atomic RPC as a compatibility fallback", () => {
    expect(
      isAtomicPartnerOnboardingUnavailable(
        new PartnerBankingRpcError(
          { code: "PGRST202", message: "Function not found" },
          "fallback",
        ),
      ),
    ).toBe(true);
    expect(
      isAtomicPartnerOnboardingUnavailable(
        new PartnerBankingRpcError(
          { code: "42501", message: "PARTNER_ROLE_REQUIRED" },
          "fallback",
        ),
      ),
    ).toBe(false);
  });

  it("distinguishes definite database rejection from an ambiguous network outcome", () => {
    expect(
      isPartnerOnboardingOutcomeAmbiguous(
        new PartnerBankingRpcError(
          { code: "P0001", message: "INVALID_RESTAURANT_NAME", status: 400 },
          "fallback",
        ),
      ),
    ).toBe(false);
    expect(
      isPartnerOnboardingOutcomeAmbiguous(
        new PartnerBankingRpcError(
          { code: "PGRST003", message: "Pool timeout", status: 504 },
          "fallback",
        ),
      ),
    ).toBe(true);
    expect(
      isPartnerOnboardingOutcomeAmbiguous(new Error("Failed to fetch")),
    ).toBe(true);
  });

  it("preserves the deployed encrypted banking update RPC contract", async () => {
    rpc.mockResolvedValue({ data: null, error: null } as never);

    await savePartnerBankingInfo({
      restaurantId: "restaurant-1",
      bankName: "Qatar National Bank",
      accountName: "Secure Kitchen LLC",
      accountNumber: "1234567890",
      iban: "QA00TEST1234567890123456789",
      swiftCode: null,
      payoutFrequency: "weekly",
    });

    expect(rpc).toHaveBeenCalledWith("set_restaurant_banking_info", {
      p_restaurant_id: "restaurant-1",
      p_bank_name: "Qatar National Bank",
      p_bank_account_name: "Secure Kitchen LLC",
      p_bank_account_number: "1234567890",
      p_bank_iban: "QA00TEST1234567890123456789",
      p_swift_code: null,
      p_payout_frequency: "weekly",
    });
  });
});
