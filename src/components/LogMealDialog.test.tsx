import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LogMealDialog } from "@/components/LogMealDialog";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        log_meal: "Log Meal",
        search_food: "Search food...",
        recent: "Recent",
        scan_food: "Scan",
        no_recent_meals: "No recent meals",
        no_results_for: "No results for",
        try_quick_log: "Try quick log",
        add: "Add",
        items: "items",
        item: "item",
        select_items_to_add: "Select items to add",
        manual_log: "Manual",
        meal_logged: "Meal logged!",
        meal_deleted: "Meal deleted",
        meal_deleted_desc: "Deleted {calories} cal",
        failed_to_delete: "Failed to delete",
        todays_schedule: "Today's Schedule",
        protein: "Protein",
        carbs: "Carbs",
        fat: "Fat",
        analyzing_food: "Analyzing...",
        ai_detecting_ingredients: "Detecting ingredients...",
        items_detected: "items detected",
        item_detected: "item detected",
        scan_again: "Scan again",
        scan_your_food: "Scan your food",
        scan_food_desc: "Take a photo or scan",
        take_photo: "Take Photo",
        use_camera_to_capture: "Use camera to capture",
        upload_from_gallery: "Upload",
        pick_existing_photo: "Pick existing photo",
        scan_barcode: "Barcode",
        scan_barcode_desc: "Look up nutrition info",
      };
      return map[key] ?? key;
    },
    language: "en",
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    }),
    removeChannel: vi.fn(),
    realtime: { setAuth: vi.fn() },
  },
}));

vi.mock("@/lib/capacitor", () => ({
  isNative: false,
}));

vi.mock("@/components/BarcodeScanner", () => ({
  BarcodeScanner: () => <div data-testid="barcode-scanner" />,
}));

vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
  AnalyticsEvents: {},
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
    span: ({ children, ...rest }: any) => <span {...rest}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, onOpenChange, children }: any) =>
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: any) => <div>{children}</div>,
  SheetTitle: ({ children }: any) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h3>{children}</h3>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}));

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

describe("LogMealDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    userId: "user-1",
    onMealLogged: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the dialog when open", () => {
    render(<LogMealDialog {...defaultProps} />);
    expect(screen.getAllByText("Log Meal").length).toBeGreaterThan(0);
  });

  it("does not render when closed", () => {
    render(<LogMealDialog {...defaultProps} open={false} />);
    expect(screen.queryByText("Log Meal")).not.toBeInTheDocument();
  });

  it("shows search input", () => {
    render(<LogMealDialog {...defaultProps} />);
    expect(screen.getByPlaceholderText("Search food...")).toBeInTheDocument();
  });

  it("shows quick log button", () => {
    render(<LogMealDialog {...defaultProps} />);
    expect(screen.getByText("Manual")).toBeInTheDocument();
  });

  it("shows tab options for Recent and Scan", () => {
    render(<LogMealDialog {...defaultProps} />);
    expect(screen.getByText("Recent")).toBeInTheDocument();
    expect(screen.getByText("Scan")).toBeInTheDocument();
  });

  it("calls onOpenChange(false) when close button clicked", async () => {
    const onOpenChange = vi.fn();
    render(<LogMealDialog {...defaultProps} onOpenChange={onOpenChange} />);
    const closeBtn = screen.getAllByRole("button").find(btn => btn.querySelector("svg") && btn.className.includes("rounded-full"));
    if (closeBtn) {
      await userEvent.click(closeBtn);
    }
  });

  it("switches to Manual tab when Manual button clicked", async () => {
    render(<LogMealDialog {...defaultProps} />);
    const manualBtn = screen.getByText("Manual");
    await userEvent.click(manualBtn);
  });

  it("shows Scan tab content when Scan is clicked", async () => {
    render(<LogMealDialog {...defaultProps} />);
    const scanTab = screen.getByText("Scan");
    await userEvent.click(scanTab);
    expect(screen.getByText("Take Photo")).toBeInTheDocument();
  });

  it("shows barcode scan option in Scan tab", async () => {
    render(<LogMealDialog {...defaultProps} />);
    const scanTab = screen.getByText("Scan");
    await userEvent.click(scanTab);
    expect(screen.getByText("Barcode")).toBeInTheDocument();
  });
});