import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createPartnerPosOrderPayload,
  enqueuePartnerPosOrder,
  readPartnerPosOrders,
} from "@/lib/partner-pos-offline";

describe("partner POS offline queue", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("navigator", { onLine: false });
  });

  it("builds a local POS ticket with normalized totals", () => {
    const payload = createPartnerPosOrderPayload({
      restaurantId: "restaurant-1",
      restaurantName: "Fuel Kitchen",
      items: [
        { meal: { id: "meal-1", name: "Chicken Bowl", price: 42 }, quantity: 2 },
        { meal: { id: "meal-2", name: "Protein Shake", price: 18 }, quantity: 1 },
      ],
      customerName: "Walk-in",
    });

    expect(payload.totalAmount).toBe(102);
    expect(payload.items).toEqual([
      { mealId: "meal-1", name: "Chicken Bowl", quantity: 2, unitPrice: 42 },
      { mealId: "meal-2", name: "Protein Shake", quantity: 1, unitPrice: 18 },
    ]);
  });

  it("deduplicates POS tickets by client request id", () => {
    const payload = createPartnerPosOrderPayload({
      restaurantId: "restaurant-1",
      restaurantName: "Fuel Kitchen",
      items: [{ meal: { id: "meal-1", name: "Chicken Bowl", price: 42 }, quantity: 1 }],
    });

    enqueuePartnerPosOrder({ userId: "partner-1", requestId: "ticket-1", payload });
    enqueuePartnerPosOrder({ userId: "partner-1", requestId: "ticket-1", payload });

    expect(readPartnerPosOrders("partner-1", "restaurant-1")).toHaveLength(1);
  });
});
