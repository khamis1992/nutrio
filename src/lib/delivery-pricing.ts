import { supabase } from "@/integrations/supabase/client";

export interface DeliveryFeeQuote {
  quoteId: string;
  baseFee: number;
  surgeFee: number;
  totalFee: number;
  ruleName: string | null;
  message: string;
  demandCount: number;
  city: string;
  expiresAt: string;
}

type DeliveryFeeQuoteRow = {
  quote_id?: unknown;
  base_fee?: unknown;
  surge_fee?: unknown;
  total_fee?: unknown;
  rule_name?: unknown;
  message?: unknown;
  demand_count?: unknown;
  city?: unknown;
  expires_at?: unknown;
};

const toFiniteNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function normalizeDeliveryFeeQuote(value: unknown): DeliveryFeeQuote {
  const row = (value || {}) as DeliveryFeeQuoteRow;
  const quoteId = typeof row.quote_id === "string" ? row.quote_id : "";
  if (!quoteId) throw new Error("DELIVERY_QUOTE_INVALID");

  return {
    quoteId,
    baseFee: toFiniteNumber(row.base_fee),
    surgeFee: toFiniteNumber(row.surge_fee),
    totalFee: toFiniteNumber(row.total_fee),
    ruleName: typeof row.rule_name === "string" && row.rule_name ? row.rule_name : null,
    message: typeof row.message === "string" ? row.message : "Delivery fee",
    demandCount: Math.max(0, Math.round(toFiniteNumber(row.demand_count))),
    city: typeof row.city === "string" ? row.city : "",
    expiresAt: typeof row.expires_at === "string" ? row.expires_at : "",
  };
}

export async function quoteDeliveryFee(input: {
  scheduledDate: string;
  timeSlot: string;
  deliveryAddressId: string;
  deliveryType?: "standard" | "express";
  orderTotal?: number;
}): Promise<DeliveryFeeQuote> {
  const { data, error } = await supabase.rpc(
    "quote_delivery_fee" as never,
    {
      p_scheduled_date: input.scheduledDate,
      p_delivery_time_slot: input.timeSlot,
      p_delivery_address_id: input.deliveryAddressId,
      p_delivery_type: input.deliveryType || "standard",
      p_order_total: input.orderTotal || 0,
    } as never,
  );

  if (error) throw error;
  return normalizeDeliveryFeeQuote(data);
}
