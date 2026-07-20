import { describe, expect, it } from "vitest";

import {
  deriveMealDeliveryAvailability,
  recommendationSlot,
  restaurantOpenState,
} from "@/lib/meal-delivery-availability";

const qatarNoon = "2026-07-19T09:00:00.000Z";

describe("meal delivery availability", () => {
  it("uses Qatar time for recommendation slots", () => {
    expect(recommendationSlot(qatarNoon)).toEqual({
      mealType: "lunch",
      timeSlot: "12:00 PM",
    });
  });

  it("handles normal and overnight restaurant hours", () => {
    expect(
      restaurantOpenState(
        { sunday: { is_open: true, open: "09:00", close: "22:00" } },
        qatarNoon,
      ),
    ).toBe(true);
    expect(
      restaurantOpenState(
        { sunday: { is_open: true, open: "18:00", close: "02:00" } },
        qatarNoon,
      ),
    ).toBe(false);
  });

  it("derives ETA from the branch actually selected by server routing", () => {
    expect(
      deriveMealDeliveryAvailability({
        generatedAt: qatarNoon,
        operatingHours: {
          sunday: { is_open: true, open: "09:00", close: "22:00" },
        },
        restaurantPrepMinutes: 30,
        routingResult: {
          status: "routed",
          branch_id: "branch-2",
          routed_at: qatarNoon,
          candidates: [
            { branch_id: "branch-1", avg_prep_time_minutes: 15, distance_km: 1 },
            { branch_id: "branch-2", avg_prep_time_minutes: 20, distance_km: 4.2 },
          ],
        },
      }),
    ).toEqual({
      deliveryAvailable: true,
      deliveryMinutes: 33,
      routedAt: qatarNoon,
    });
  });

  it("marks capacity failure or closed restaurants unavailable", () => {
    const result = deriveMealDeliveryAvailability({
      generatedAt: qatarNoon,
      operatingHours: {
        sunday: { is_open: true, open: "18:00", close: "22:00" },
      },
      restaurantPrepMinutes: 20,
      routingResult: { status: "manual_review" },
    });
    expect(result.deliveryAvailable).toBe(false);
  });

  it("keeps availability unknown when operating hours are missing", () => {
    const result = deriveMealDeliveryAvailability({
      generatedAt: qatarNoon,
      operatingHours: null,
      restaurantPrepMinutes: 20,
      routingResult: { status: "single_kitchen" },
    });
    expect(result.deliveryAvailable).toBeNull();
    expect(result.deliveryMinutes).toBe(20);
  });
});
