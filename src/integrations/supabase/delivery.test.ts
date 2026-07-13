import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, rpcMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
  },
}));

import {
  getActiveDeliveries,
  getDriverCurrentJob,
  getDriverJobHistory,
} from "@/integrations/supabase/delivery";

function query(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: <TResult1 = typeof result, TResult2 = never>(
      onFulfilled?: ((value: typeof result) => TResult1 | PromiseLike<TResult1>) | null,
      onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
  };
  return builder;
}

describe("delivery service source integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enriches a direct order for the active driver screen", async () => {
    const jobQuery = query({
      data: {
        id: "job-1",
        order_id: "order-1",
        schedule_id: null,
        restaurant_id: "restaurant-1",
        status: "assigned",
      },
      error: null,
    });
    const restaurantQuery = query({
      data: {
        name: "Nutrio Kitchen",
        address: "Doha",
        phone: "+97450000000",
        latitude: 25.28,
        longitude: 51.52,
      },
      error: null,
    });

    fromMock.mockImplementation((table: string) =>
      table === "delivery_jobs" ? jobQuery : restaurantQuery,
    );
    rpcMock.mockResolvedValue({
      data: {
        source: "order",
        meal_name: "Chicken Bowl",
        customer_name: "Khamis",
        customer_phone: "+97451111111",
      },
      error: null,
    });

    const result = await getDriverCurrentJob("driver-1");

    expect(rpcMock).toHaveBeenCalledWith("get_delivery_details_for_driver", {
      p_delivery_job_id: "job-1",
    });
    expect(result?.schedule.meal.name).toBe("Chicken Bowl");
    expect(result?.schedule.user.raw_user_meta_data.name).toBe("Khamis");
    expect(result?.schedule.meal.restaurant?.name).toBe("Nutrio Kitchen");
  });

  it("enriches direct orders in driver history", async () => {
    fromMock.mockReturnValue(query({
      data: [{
        id: "job-2",
        order_id: "order-2",
        schedule_id: null,
        status: "delivered",
      }],
      error: null,
    }));
    rpcMock.mockResolvedValue({
      data: { meal_name: "Salmon Bowl", customer_name: "Mona" },
      error: null,
    });

    const result = await getDriverJobHistory("driver-1", 5);

    expect(result[0]).toMatchObject({
      id: "job-2",
      meal_name: "Salmon Bowl",
      customer_name: "Mona",
    });
  });

  it("normalizes direct orders for the admin active-deliveries screen", async () => {
    const deliveryQuery = query({
      data: [{
        id: "job-admin-1",
        order_id: "order-admin-1",
        schedule_id: null,
        restaurant_id: "restaurant-1",
        driver_id: "driver-1",
        status: "in_transit",
      }],
      error: null,
    });

    const resultsByTable: Record<string, { data: unknown; error: unknown }> = {
      delivery_jobs: { data: [], error: null },
      drivers: {
        data: [{ id: "driver-1", user_id: "driver-user-1" }],
        error: null,
      },
      meal_schedules: { data: [], error: null },
      orders: {
        data: [{
          id: "order-admin-1",
          user_id: "customer-1",
          meal_id: "meal-1",
          restaurant_id: "restaurant-1",
          status: "in_transit",
        }],
        error: null,
      },
      meals: {
        data: [{
          id: "meal-1",
          name: "Chicken Bowl",
          image_url: "meal.jpg",
          restaurant_id: "restaurant-1",
        }],
        error: null,
      },
      profiles: {
        data: [{ id: "customer-1", full_name: "Khamis" }],
        error: null,
      },
      restaurants: {
        data: [{
          id: "restaurant-1",
          name: "Nutrio Kitchen",
          address: "Doha",
          phone_number: "+97450000000",
        }],
        error: null,
      },
    };

    fromMock.mockImplementation((table: string) => {
      if (table === "delivery_jobs") return deliveryQuery;
      return query(resultsByTable[table] || { data: [], error: null });
    });

    const result = await getActiveDeliveries();

    expect(deliveryQuery.in).toHaveBeenCalledWith("status", [
      "assigned",
      "accepted",
      "picked_up",
      "in_transit",
      "on_the_way",
    ]);
    expect(result[0]).toMatchObject({
      id: "job-admin-1",
      order_id: "order-admin-1",
      schedule_id: null,
      schedule: {
        id: "order-admin-1",
        source_type: "order",
        meal_type: "Direct order",
        order_status: "in_transit",
        meal: {
          name: "Chicken Bowl",
          restaurant: { name: "Nutrio Kitchen" },
        },
        user: { raw_user_meta_data: { name: "Khamis" } },
      },
    });
  });
});
