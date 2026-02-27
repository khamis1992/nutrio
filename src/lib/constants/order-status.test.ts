/**
 * Order Status Constants Tests
 * Tests for order status definitions and helper functions
 */

import { describe, it, expect } from "vitest";
import {
  ORDER_STATUS,
  ORDER_STATUS_CONFIG,
  ORDER_TIMELINE,
  getStatusIndex,
  isStatusPast,
  isStatusCurrent,
  getNextStatus,
  getEstimatedTimeForStatus,
  type OrderStatus,
} from "./order-status";

describe("ORDER_STATUS Constants", () => {
  it("defines all expected status values", () => {
    expect(ORDER_STATUS.PENDING).toBe("pending");
    expect(ORDER_STATUS.CONFIRMED).toBe("confirmed");
    expect(ORDER_STATUS.PREPARING).toBe("preparing");
    expect(ORDER_STATUS.READY).toBe("ready");
    expect(ORDER_STATUS.OUT_FOR_DELIVERY).toBe("out_for_delivery");
    expect(ORDER_STATUS.DELIVERED).toBe("delivered");
    expect(ORDER_STATUS.CANCELLED).toBe("cancelled");
  });

  it("has correct number of statuses", () => {
    expect(Object.keys(ORDER_STATUS).length).toBe(7);
  });

  it("all statuses are strings", () => {
    Object.values(ORDER_STATUS).forEach((status) => {
      expect(typeof status).toBe("string");
    });
  });

  it("status values are unique", () => {
    const values = Object.values(ORDER_STATUS);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });
});

describe("ORDER_STATUS_CONFIG", () => {
  it("has configuration for all statuses", () => {
    const statuses: OrderStatus[] = [
      "pending",
      "confirmed",
      "preparing",
      "ready",
      "out_for_delivery",
      "delivered",
      "cancelled",
    ];

    statuses.forEach((status) => {
      expect(ORDER_STATUS_CONFIG[status]).toBeDefined();
      expect(ORDER_STATUS_CONFIG[status].label).toBeDefined();
      expect(ORDER_STATUS_CONFIG[status].description).toBeDefined();
      expect(ORDER_STATUS_CONFIG[status].icon).toBeDefined();
      expect(ORDER_STATUS_CONFIG[status].color).toBeDefined();
      expect(ORDER_STATUS_CONFIG[status].customerVisible).toBeDefined();
    });
  });

  it("all statuses are customer visible", () => {
    Object.values(ORDER_STATUS_CONFIG).forEach((config) => {
      expect(config.customerVisible).toBe(true);
    });
  });

  it("has correct labels for each status", () => {
    expect(ORDER_STATUS_CONFIG.pending.label).toBe("Order Placed");
    expect(ORDER_STATUS_CONFIG.confirmed.label).toBe("Confirmed");
    expect(ORDER_STATUS_CONFIG.preparing.label).toBe("Preparing");
    expect(ORDER_STATUS_CONFIG.ready.label).toBe("Ready for Pickup");
    expect(ORDER_STATUS_CONFIG.out_for_delivery.label).toBe("Out for Delivery");
    expect(ORDER_STATUS_CONFIG.delivered.label).toBe("Delivered");
    expect(ORDER_STATUS_CONFIG.cancelled.label).toBe("Cancelled");
  });

  it("has correct colors for each status", () => {
    expect(ORDER_STATUS_CONFIG.pending.color).toBe("bg-yellow-500");
    expect(ORDER_STATUS_CONFIG.confirmed.color).toBe("bg-blue-500");
    expect(ORDER_STATUS_CONFIG.preparing.color).toBe("bg-orange-500");
    expect(ORDER_STATUS_CONFIG.ready.color).toBe("bg-purple-500");
    expect(ORDER_STATUS_CONFIG.out_for_delivery.color).toBe("bg-indigo-500");
    expect(ORDER_STATUS_CONFIG.delivered.color).toBe("bg-green-500");
    expect(ORDER_STATUS_CONFIG.cancelled.color).toBe("bg-red-500");
  });

  it("has descriptions for all statuses", () => {
    Object.values(ORDER_STATUS_CONFIG).forEach((config) => {
      expect(config.description).toBeTruthy();
      expect(typeof config.description).toBe("string");
    });
  });

  it("has icon names for all statuses", () => {
    Object.values(ORDER_STATUS_CONFIG).forEach((config) => {
      expect(config.icon).toBeTruthy();
      expect(typeof config.icon).toBe("string");
    });
  });
});

describe("ORDER_TIMELINE", () => {
  it("has correct number of timeline steps", () => {
    expect(ORDER_TIMELINE.length).toBe(6);
  });

  it("follows correct progression order", () => {
    expect(ORDER_TIMELINE[0]).toBe("pending");
    expect(ORDER_TIMELINE[1]).toBe("confirmed");
    expect(ORDER_TIMELINE[2]).toBe("preparing");
    expect(ORDER_TIMELINE[3]).toBe("ready");
    expect(ORDER_TIMELINE[4]).toBe("out_for_delivery");
    expect(ORDER_TIMELINE[5]).toBe("delivered");
  });

  it("does not include cancelled in timeline", () => {
    expect(ORDER_TIMELINE).not.toContain("cancelled");
  });

  it("all timeline statuses are valid order statuses", () => {
    ORDER_TIMELINE.forEach((status) => {
      expect(Object.values(ORDER_STATUS)).toContain(status);
    });
  });
});

describe("getStatusIndex", () => {
  it("returns correct index for each timeline status", () => {
    expect(getStatusIndex("pending")).toBe(0);
    expect(getStatusIndex("confirmed")).toBe(1);
    expect(getStatusIndex("preparing")).toBe(2);
    expect(getStatusIndex("ready")).toBe(3);
    expect(getStatusIndex("out_for_delivery")).toBe(4);
    expect(getStatusIndex("delivered")).toBe(5);
  });

  it("returns -1 for cancelled status", () => {
    expect(getStatusIndex("cancelled")).toBe(-1);
  });
});

describe("isStatusPast", () => {
  it("returns true when check status is before current status", () => {
    expect(isStatusPast("preparing", "pending")).toBe(true);
    expect(isStatusPast("preparing", "confirmed")).toBe(true);
    expect(isStatusPast("delivered", "out_for_delivery")).toBe(true);
  });

  it("returns false when check status is current or future", () => {
    expect(isStatusPast("preparing", "preparing")).toBe(false);
    expect(isStatusPast("preparing", "ready")).toBe(false);
    expect(isStatusPast("pending", "confirmed")).toBe(false);
  });

  it("handles edge cases correctly", () => {
    expect(isStatusPast("delivered", "pending")).toBe(true);
    expect(isStatusPast("pending", "delivered")).toBe(false);
  });
});

describe("isStatusCurrent", () => {
  it("returns true when statuses match", () => {
    expect(isStatusCurrent("pending", "pending")).toBe(true);
    expect(isStatusCurrent("delivered", "delivered")).toBe(true);
    expect(isStatusCurrent("preparing", "preparing")).toBe(true);
  });

  it("returns false when statuses do not match", () => {
    expect(isStatusCurrent("pending", "confirmed")).toBe(false);
    expect(isStatusCurrent("preparing", "delivered")).toBe(false);
  });
});

describe("getNextStatus", () => {
  it("returns correct next status for each step", () => {
    expect(getNextStatus("pending")).toBe("confirmed");
    expect(getNextStatus("confirmed")).toBe("preparing");
    expect(getNextStatus("preparing")).toBe("ready");
    expect(getNextStatus("ready")).toBe("out_for_delivery");
    expect(getNextStatus("out_for_delivery")).toBe("delivered");
  });

  it("returns null for final status", () => {
    expect(getNextStatus("delivered")).toBeNull();
  });

  it("returns null for cancelled status", () => {
    expect(getNextStatus("cancelled")).toBeNull();
  });
});

describe("getEstimatedTimeForStatus", () => {
  it("returns time estimates for active statuses", () => {
    expect(getEstimatedTimeForStatus("pending")).toContain("5-10 min");
    expect(getEstimatedTimeForStatus("confirmed")).toContain("15-25 min");
    expect(getEstimatedTimeForStatus("preparing")).toContain("10-20 min");
    expect(getEstimatedTimeForStatus("ready")).toContain("5-10 min");
    expect(getEstimatedTimeForStatus("out_for_delivery")).toContain("15-30 min");
  });

  it("returns empty string for terminal statuses", () => {
    expect(getEstimatedTimeForStatus("delivered")).toBe("");
    expect(getEstimatedTimeForStatus("cancelled")).toBe("");
  });

  it("returns string for all statuses", () => {
    const allStatuses: OrderStatus[] = [
      "pending",
      "confirmed",
      "preparing",
      "ready",
      "out_for_delivery",
      "delivered",
      "cancelled",
    ];

    allStatuses.forEach((status) => {
      const estimate = getEstimatedTimeForStatus(status);
      expect(typeof estimate).toBe("string");
    });
  });
});

describe("Type Safety", () => {
  it("OrderStatus type accepts all valid statuses", () => {
    const validStatuses: OrderStatus[] = [
      "pending",
      "confirmed",
      "preparing",
      "ready",
      "out_for_delivery",
      "delivered",
      "cancelled",
    ];

    validStatuses.forEach((status) => {
      expect(ORDER_STATUS_CONFIG[status]).toBeDefined();
    });
  });
});
