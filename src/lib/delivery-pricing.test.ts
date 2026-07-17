import { describe, expect, it } from "vitest";

import { normalizeDeliveryFeeQuote } from "@/lib/delivery-pricing";

describe("normalizeDeliveryFeeQuote", () => {
  it("normalizes numeric Postgres values and keeps the pricing explanation", () => {
    expect(normalizeDeliveryFeeQuote({
      quote_id: "quote-1",
      base_fee: "3.99",
      surge_fee: "2.01",
      total_fee: "6.00",
      rule_name: "Evening peak",
      message: "Peak pricing applies.",
      demand_count: 12,
      city: "Doha",
      expires_at: "2026-07-18T12:00:00Z",
    })).toEqual({
      quoteId: "quote-1",
      baseFee: 3.99,
      surgeFee: 2.01,
      totalFee: 6,
      ruleName: "Evening peak",
      message: "Peak pricing applies.",
      demandCount: 12,
      city: "Doha",
      expiresAt: "2026-07-18T12:00:00Z",
    });
  });

  it("rejects a response without an auditable quote id", () => {
    expect(() => normalizeDeliveryFeeQuote({ total_fee: 5 })).toThrow("DELIVERY_QUOTE_INVALID");
  });
});
