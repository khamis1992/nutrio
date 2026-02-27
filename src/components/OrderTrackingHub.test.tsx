/**
 * OrderTrackingHub Component Tests
 * Tests for the order tracking dashboard component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { OrderTrackingHub } from "./OrderTrackingHub";
import * as AuthContext from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

// Mock Auth Context
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

// Mock Supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    channel: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    removeChannel: vi.fn(),
  },
}));

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

// Mock order data
const mockActiveOrders = [
  {
    id: "order-1",
    restaurant_name: "Healthy Bites",
    restaurant_logo: "https://example.com/logo1.png",
    status: "preparing",
    delivery_date: "2025-02-27",
    meal_type: "Lunch",
    meal_name: "Grilled Chicken Salad",
    driver_name: "Ahmed",
    driver_phone: "+974 1234 5678",
  },
  {
    id: "order-2",
    restaurant_name: "Green Kitchen",
    restaurant_logo: "",
    status: "out_for_delivery",
    delivery_date: "2025-02-27",
    meal_type: "Dinner",
    meal_name: "Quinoa Bowl",
    driver_name: "Mohammed",
    driver_phone: "+974 8765 4321",
  },
];

describe("OrderTrackingHub", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: { id: "test-user-id", email: "test@example.com" },
      session: null,
      loading: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Loading State", () => {
    it("shows loading spinner while fetching orders", () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockImplementation(() => new Promise(() => {})),
      } as any);

      renderWithRouter(<OrderTrackingHub />);

      expect(screen.getByText(/Loading your orders/i)).toBeInTheDocument();
    });

    it("renders refresh icon while loading", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any);

      renderWithRouter(<OrderTrackingHub />);

      await waitFor(() => {
        const refreshIcon = document.querySelector("svg.animate-spin");
        expect(refreshIcon).toBeInTheDocument();
      });
    });
  });

  describe("Empty State", () => {
    it("shows empty state when no active orders", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any);

      renderWithRouter(<OrderTrackingHub />);

      await waitFor(() => {
        expect(screen.getByText(/No Active Orders/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/You don't have any orders being prepared right now/i)).toBeInTheDocument();
    });

    it("shows browse meals button in empty state", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any);

      renderWithRouter(<OrderTrackingHub />);

      await waitFor(() => {
        const browseButton = screen.getByText(/Browse Meals/i);
        expect(browseButton).toBeInTheDocument();
      });
    });

    it("navigates to meals page when browse button is clicked", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any);

      renderWithRouter(<OrderTrackingHub />);

      await waitFor(() => screen.getByText(/Browse Meals/i));
      await userEvent.click(screen.getByText(/Browse Meals/i));

      expect(mockNavigate).toHaveBeenCalledWith("/meals");
    });
  });

  describe("Active Orders Display", () => {
    it("shows active orders count in header", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: mockActiveOrders.map((order) => ({
            id: order.id,
            scheduled_date: order.delivery_date,
            meal_type: order.meal_type,
            order_status: order.status,
            meals: {
              name: order.meal_name,
              restaurants: {
                name: order.restaurant_name,
                logo_url: order.restaurant_logo,
              },
            },
            delivery_jobs: [
              {
                driver_id: "driver-1",
                drivers: {
                  full_name: order.driver_name,
                  phone: order.driver_phone,
                },
              },
            ],
          })),
          error: null,
        }),
      } as any);

      renderWithRouter(<OrderTrackingHub />);

      await waitFor(() => {
        expect(screen.getByText(/Active Orders \(2\)/i)).toBeInTheDocument();
      });
    });

    it("displays order details correctly", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: "order-1",
              scheduled_date: "2025-02-27",
              meal_type: "Lunch",
              order_status: "preparing",
              meals: {
                name: "Grilled Chicken Salad",
                restaurants: {
                  name: "Healthy Bites",
                  logo_url: "",
                },
              },
              delivery_jobs: [],
            },
          ],
          error: null,
        }),
      } as any);

      renderWithRouter(<OrderTrackingHub />);

      await waitFor(() => {
        expect(screen.getByText("Grilled Chicken Salad")).toBeInTheDocument();
        expect(screen.getByText("Healthy Bites")).toBeInTheDocument();
        expect(screen.getByText(/Lunch/i)).toBeInTheDocument();
      });
    });

    it("shows correct status for each order", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: "order-1",
              scheduled_date: "2025-02-27",
              meal_type: "Lunch",
              order_status: "preparing",
              meals: {
                name: "Grilled Chicken Salad",
                restaurants: { name: "Healthy Bites", logo_url: "" },
              },
              delivery_jobs: [],
            },
          ],
          error: null,
        }),
      } as any);

      renderWithRouter(<OrderTrackingHub />);

      await waitFor(() => {
        expect(screen.getByText(/Preparing/i)).toBeInTheDocument();
        expect(screen.getByText(/Your meal is being prepared/i)).toBeInTheDocument();
      });
    });

    it("shows meal type badge for each order", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: "order-1",
              scheduled_date: "2025-02-27",
              meal_type: "Lunch",
              order_status: "preparing",
              meals: {
                name: "Grilled Chicken Salad",
                restaurants: { name: "Healthy Bites", logo_url: "" },
              },
              delivery_jobs: [],
            },
          ],
          error: null,
        }),
      } as any);

      renderWithRouter(<OrderTrackingHub />);

      await waitFor(() => {
        const badges = screen.getAllByText(/Lunch/i);
        expect(badges.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Navigation", () => {
    it("navigates to tracking page when order is clicked", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: "order-1",
              scheduled_date: "2025-02-27",
              meal_type: "Lunch",
              order_status: "preparing",
              meals: {
                name: "Grilled Chicken Salad",
                restaurants: { name: "Healthy Bites", logo_url: "" },
              },
              delivery_jobs: [],
            },
          ],
          error: null,
        }),
      } as any);

      renderWithRouter(<OrderTrackingHub />);

      await waitFor(() => screen.getByText("Grilled Chicken Salad"));

      const orderLink = screen.getByText("Grilled Chicken Salad").closest("a");
      expect(orderLink).toHaveAttribute("href", "/tracking?id=order-1");
    });

    it("navigates to all orders page when view all is clicked", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: "order-1",
              scheduled_date: "2025-02-27",
              meal_type: "Lunch",
              order_status: "preparing",
              meals: {
                name: "Grilled Chicken Salad",
                restaurants: { name: "Healthy Bites", logo_url: "" },
              },
              delivery_jobs: [],
            },
          ],
          error: null,
        }),
      } as any);

      renderWithRouter(<OrderTrackingHub />);

      await waitFor(() => screen.getByText(/View All Orders/i));
      await userEvent.click(screen.getByText(/View All Orders/i));

      expect(mockNavigate).toHaveBeenCalledWith("/orders");
    });
  });

  describe("Refresh Functionality", () => {
    it("shows refresh button in header", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any);

      renderWithRouter(<OrderTrackingHub />);

      await waitFor(() => {
        const refreshButton = screen.getByRole("button", { name: "" });
        expect(refreshButton).toBeInTheDocument();
      });
    });

    it("refreshes orders when refresh button is clicked", async () => {
      const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: mockOrder,
      } as any);

      renderWithRouter(<OrderTrackingHub />);

      await waitFor(() => screen.getByText(/No Active Orders/i));

      const refreshButton = screen.getByRole("button", { name: "" });
      await userEvent.click(refreshButton);

      expect(mockOrder).toHaveBeenCalledTimes(2);
    });

    it("shows spinning animation while refreshing", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any);

      renderWithRouter(<OrderTrackingHub />);

      await waitFor(() => screen.getByText(/No Active Orders/i));

      const refreshButton = screen.getByRole("button", { name: "" });
      await userEvent.click(refreshButton);

      // Check for spin animation class
      const refreshIcon = refreshButton.querySelector("svg");
      expect(refreshIcon?.classList.contains("animate-spin")).toBe(true);
    });
  });

  describe("Real-time Updates", () => {
    it("subscribes to real-time updates on mount", async () => {
      const mockSubscribe = vi.fn().mockReturnValue({ unsubscribe: vi.fn() });
      vi.mocked(supabase.channel).mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: mockSubscribe,
      } as any);

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any);

      renderWithRouter(<OrderTrackingHub />);

      await waitFor(() => {
        expect(supabase.channel).toHaveBeenCalledWith("order-updates");
      });
    });

    it("unsubscribes from real-time updates on unmount", async () => {
      const mockUnsubscribe = vi.fn();
      vi.mocked(supabase.channel).mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnValue({ unsubscribe: mockUnsubscribe }),
      } as any);

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any);

      const { unmount } = renderWithRouter(<OrderTrackingHub />);

      await waitFor(() => screen.getByText(/No Active Orders/i));

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe("Status Icons and Colors", () => {
    it("shows correct status icons for different order statuses", async () => {
      const statuses = [
        { status: "pending", label: "Order Placed" },
        { status: "confirmed", label: "Confirmed" },
        { status: "preparing", label: "Preparing" },
        { status: "ready", label: "Ready for Pickup" },
        { status: "out_for_delivery", label: "Out for Delivery" },
      ];

      for (const { status, label } of statuses) {
        vi.clearAllMocks();
        vi.mocked(supabase.from).mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: "order-1",
                scheduled_date: "2025-02-27",
                meal_type: "Lunch",
                order_status: status,
                meals: {
                  name: "Test Meal",
                  restaurants: { name: "Test Restaurant", logo_url: "" },
                },
                delivery_jobs: [],
              },
            ],
            error: null,
          }),
        } as any);

        const { unmount } = renderWithRouter(<OrderTrackingHub />);

        await waitFor(() => {
          expect(screen.getByText(new RegExp(label, "i"))).toBeInTheDocument();
        });

        unmount();
      }
    });
  });
});
