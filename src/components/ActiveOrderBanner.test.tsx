import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ActiveOrderBanner } from "@/components/ActiveOrderBanner";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        order_active_orders: "Active Orders",
        order_view_all: "View All",
        order_status_pending: "Pending",
        order_status_pending_short: "Pending",
        order_status_confirmed: "Confirmed",
        order_status_confirmed_short: "Confirmed",
        order_status_preparing: "Preparing",
        order_status_preparing_short: "Prep",
        order_status_in_queue: "In queue",
        order_status_ready: "Ready",
        order_status_ready_short: "Ready",
        order_status_on_the_way: "On the way",
        order_status_on_the_way_short: "On way",
        order_status_near_location: "Near you",
        order_status_delivered: "Delivered",
        order_status_delivered_short: "Delivered",
        order_status_completed: "Completed",
        order_status_completed_short: "Done",
        order_status_cancelled: "Cancelled",
        order_status_cancelled_short: "Cancelled",
        order_status_placed: "Placed",
        order_est: "Est.",
        order_eta: "ETA",
        order_more_meals: "more meals",
        order_meal_default: "Meal",
        order_restaurant_default: "Restaurant",
        order_track: "Track",
        order_cancel_confirm_title: "Cancel Order?",
        order_cancel_confirm: "Are you sure you want to cancel this order?",
        order_cancel_no: "No, Keep It",
        order_cancel_yes: "Yes, Cancel",
        order_cannot_cancel_title: "Cannot Cancel",
        order_cannot_cancel_description: "This order is already being prepared.",
        order_cancel_success: "Order cancelled",
        order_cancel_error: "Error cancelling",
        date_today: "Today",
        date_tomorrow: "Tomorrow",
      };
      return map[key] ?? key;
    },
    language: "en",
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    }),
    removeChannel: vi.fn(),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "token" } } }) },
    realtime: { setAuth: vi.fn() },
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("react-router-dom", () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
    span: ({ children, ...rest }: any) => <span {...rest}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

import { supabase } from "@/integrations/supabase/client";

describe("ActiveOrderBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when loading with no orders", async () => {
    (supabase as any).from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    });

    const { container } = render(<ActiveOrderBanner userId="user-1" />);
    expect(container.querySelector("[class*='animate-']")).toBeInTheDocument();
  });

  it("renders active orders with restaurant name", async () => {
    const mockSchedules = [
      { id: "s1", scheduled_date: "2026-04-15", order_status: "confirmed", meal_id: "m1", addons_total: 25, delivery_fee: 5, delivery_type: "delivery" },
    ];
    const mockMeals = [
      { id: "m1", name: "Grilled Chicken", restaurant_id: "r1" },
    ];
    const mockRestaurants = [
      { id: "r1", name: "Healthy Bites" },
    ];

    let callCount = 0;
    (supabase as any).from = vi.fn().mockImplementation((table: string) => {
      callCount++;
      if (table === "meal_schedules") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockSchedules, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "meals") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: mockMeals, error: null }),
          }),
        };
      }
      if (table === "restaurants") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: mockRestaurants, error: null }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    render(<ActiveOrderBanner userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText("Healthy Bites")).toBeInTheDocument();
    });
  });

  it("shows cancel button for pending orders", async () => {
    const mockSchedules = [
      { id: "s1", scheduled_date: "2026-04-15", order_status: "pending", meal_id: "m1", addons_total: 0, delivery_fee: 0, delivery_type: "pickup" },
    ];
    const mockMeals = [
      { id: "m1", name: "Test Meal", restaurant_id: "r1" },
    ];
    const mockRestaurants = [
      { id: "r1", name: "Test Restaurant" },
    ];

    (supabase as any).from = vi.fn().mockImplementation((table: string) => {
      if (table === "meal_schedules") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockSchedules, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "meals") {
        return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: mockMeals, error: null }) }) };
      }
      if (table === "restaurants") {
        return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: mockRestaurants, error: null }) }) };
      }
      return { select: vi.fn() };
    });

    render(<ActiveOrderBanner userId="user-1" />);
    await waitFor(() => {
      expect(screen.getByLabelText("Cancel order")).toBeInTheDocument();
    });
  });
});