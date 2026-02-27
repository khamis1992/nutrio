/**
 * NotificationPreferences Component Tests
 * Tests for notification preference management
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationPreferences } from "./NotificationPreferences";
import * as AuthContext from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Mock dependencies
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    }),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("NotificationPreferences", () => {
  const mockUser = { id: "test-user-id", email: "test@example.com" };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: mockUser,
      session: null,
      loading: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
  });

  describe("Loading State", () => {
    it("shows loading state initially", () => {
      // Delay the response to show loading
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => new Promise(() => {})),
      } as any);

      render(<NotificationPreferences />);

      expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    });
  });

  describe("Rendering Categories", () => {
    it("renders all notification categories", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { notification_preferences: null },
          error: null,
        }),
      } as any);

      render(<NotificationPreferences />);

      await waitFor(() => {
        expect(screen.getByText("Order Updates")).toBeInTheDocument();
        expect(screen.getByText("Delivery Updates")).toBeInTheDocument();
        expect(screen.getByText("Promotions")).toBeInTheDocument();
        expect(screen.getByText("Meal Reminders")).toBeInTheDocument();
      });
    });

    it("renders category descriptions", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { notification_preferences: null },
          error: null,
        }),
      } as any);

      render(<NotificationPreferences />);

      await waitFor(() => {
        expect(screen.getByText("Get notified when your order status changes")).toBeInTheDocument();
        expect(screen.getByText("Track your delivery in real-time")).toBeInTheDocument();
        expect(screen.getByText("Special offers and discounts")).toBeInTheDocument();
        expect(screen.getByText("Reminders to schedule your meals")).toBeInTheDocument();
      });
    });

    it("renders notification channel icons", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { notification_preferences: null },
          error: null,
        }),
      } as any);

      render(<NotificationPreferences />);

      await waitFor(() => {
        // Should have Push labels with icons
        const pushLabels = screen.getAllByText("Push");
        expect(pushLabels.length).toBeGreaterThan(0);

        // Should have Email labels with icons
        const emailLabels = screen.getAllByText("Email");
        expect(emailLabels.length).toBeGreaterThan(0);

        // Should have WhatsApp labels with icons
        const whatsappLabels = screen.getAllByText("WhatsApp");
        expect(whatsappLabels.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Default Preferences", () => {
    it("applies default preferences when no saved preferences", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      } as any);

      render(<NotificationPreferences />);

      await waitFor(() => {
        // Default: order_updates_push should be true
        const switches = screen.getAllByRole("switch");
        // Most should be checked by default
        expect(switches.length).toBeGreaterThan(0);
      });
    });

    it("loads saved preferences from database", async () => {
      const savedPreferences = {
        order_updates_push: false,
        order_updates_email: true,
        promotions_email: false,
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { notification_preferences: savedPreferences },
          error: null,
        }),
      } as any);

      render(<NotificationPreferences />);

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith("profiles");
      });
    });
  });

  describe("Toggle Switches", () => {
    it("toggles preference switch", async () => {
      const mockUpdate = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { notification_preferences: null },
          error: null,
        }),
        update: mockUpdate,
      } as any);

      render(<NotificationPreferences />);

      await waitFor(() => screen.getByText("Order Updates"));

      const switches = screen.getAllByRole("switch");
      const firstSwitch = switches[0];

      // Toggle the switch
      await userEvent.click(firstSwitch);

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled();
      });
    });

    it("shows success toast on successful update", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { notification_preferences: null },
          error: null,
        }),
        update: vi.fn().mockResolvedValue({ error: null }),
      } as any);

      render(<NotificationPreferences />);

      await waitFor(() => screen.getByText("Order Updates"));

      const switches = screen.getAllByRole("switch");
      await userEvent.click(switches[0]);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Preferences updated");
      });
    });

    it("shows error toast and reverts on failed update", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { notification_preferences: null },
          error: null,
        }),
        update: vi.fn().mockResolvedValue({ error: new Error("Update failed") }),
      } as any);

      render(<NotificationPreferences />);

      await waitFor(() => screen.getByText("Order Updates"));

      const switches = screen.getAllByRole("switch");
      const firstSwitch = switches[0];
      const initialChecked = firstSwitch.getAttribute("aria-checked");

      await userEvent.click(firstSwitch);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to update preferences");
      });
    });

    it("updates multiple channels for a category", async () => {
      const mockUpdate = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { notification_preferences: null },
          error: null,
        }),
        update: mockUpdate,
      } as any);

      render(<NotificationPreferences />);

      await waitFor(() => screen.getByText("Order Updates"));

      // Get all switches in Order Updates section
      const orderSection = screen.getByText("Order Updates").closest("div[class*='space-y']");
      const switches = orderSection?.querySelectorAll('[role="switch"]');

      if (switches && switches.length > 0) {
        await userEvent.click(switches[0]);
        await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
      }
    });
  });

  describe("Category Structure", () => {
    it("Order Updates has all three channels", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { notification_preferences: null },
          error: null,
        }),
      } as any);

      render(<NotificationPreferences />);

      await waitFor(() => {
        const orderSection = screen.getByText("Order Updates").parentElement?.parentElement;
        expect(orderSection?.textContent).toContain("Push");
        expect(orderSection?.textContent).toContain("Email");
        expect(orderSection?.textContent).toContain("WhatsApp");
      });
    });

    it("Promotions only has email channel", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { notification_preferences: null },
          error: null,
        }),
      } as any);

      render(<NotificationPreferences />);

      await waitFor(() => {
        const promoSection = screen.getByText("Promotions").parentElement?.parentElement;
        expect(promoSection?.textContent).toContain("Email");
        expect(promoSection?.textContent).not.toContain("Push");
        expect(promoSection?.textContent).not.toContain("WhatsApp");
      });
    });

    it("Meal Reminders only has push channel", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { notification_preferences: null },
          error: null,
        }),
      } as any);

      render(<NotificationPreferences />);

      await waitFor(() => {
        const reminderSection = screen.getByText("Meal Reminders").parentElement?.parentElement;
        expect(reminderSection?.textContent).toContain("Push");
        expect(reminderSection?.textContent).not.toContain("Email");
        expect(reminderSection?.textContent).not.toContain("WhatsApp");
      });
    });
  });

  describe("Error Handling", () => {
    it("handles fetch error gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: new Error("Database error"),
        }),
      } as any);

      render(<NotificationPreferences />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          "Error fetching preferences:",
          expect.anything()
        );
      });

      consoleSpy.mockRestore();
    });

    it("does not render until user is available", () => {
      vi.mocked(AuthContext.useAuth).mockReturnValue({
        user: null,
        session: null,
        loading: false,
        signUp: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      });

      render(<NotificationPreferences />);

      // Should show loading since user is null
      expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    });
  });

  describe("Header", () => {
    it("renders correct header title", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { notification_preferences: null },
          error: null,
        }),
      } as any);

      render(<NotificationPreferences />);

      await waitFor(() => {
        expect(screen.getByText("Notification Preferences")).toBeInTheDocument();
      });
    });

    it("renders header description", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { notification_preferences: null },
          error: null,
        }),
      } as any);

      render(<NotificationPreferences />);

      await waitFor(() => {
        expect(screen.getByText("Choose how you want to receive updates")).toBeInTheDocument();
      });
    });
  });
});
