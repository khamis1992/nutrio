import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DailyNutritionCard } from "@/components/DailyNutritionCard";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { id: "user-1" },
    session: null,
    loading: false,
  }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        nutrition_eaten: "Eaten",
        nutrition_cal: "cal",
        nutrition_cal_left: "cal left",
        nutrition_burned: "Burned",
        nutrition_total_burned: "Total Burned",
        macro_carbs: "Carbs",
        macro_protein: "Protein",
        macro_fat: "Fat",
        activity_details: "Activity",
        activity_sessions: "Sessions",
        todays_progress: "Today's Progress",
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
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }),
  },
}));

vi.mock("@/components/LogActivitySheet", () => ({
  LogActivitySheet: ({ open, onOpenChange }: any) =>
    open ? <div data-testid="log-activity-sheet">Log Activity</div> : null,
}));

vi.mock("@/components/ui/nav-chevron", () => ({
  NavChevronLeft: () => <span>←</span>,
  NavChevronRight: () => <span>→</span>,
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
    span: ({ children, ...rest }: any) => <span {...rest}>{children}</span>,
    circle: ({ children, ...rest }: any) => <circle {...rest}>{children}</circle>,
  },
}));

vi.mock("@/lib/dateUtils", () => ({
  getQatarNow: () => {
    const d = new Date();
    d.setHours(10, 0, 0, 0);
    return d;
  },
  getQatarDay: () => "2026-04-15",
}));

vi.mock("date-fns", () => ({
  format: (date: Date, fmt: string) => {
    if (fmt === "yyyy-MM-dd") return "2026-04-15";
    if (fmt === "EEE, MMM d") return "Wed, Apr 15";
    return date.toISOString();
  },
}));

describe("DailyNutritionCard", () => {
  const defaultProps = {
    totalCalories: 800,
    totalProtein: 60,
    totalCarbs: 120,
    totalFat: 30,
    focusCalories: 2000,
    targetProtein: 150,
    targetCarbs: 200,
    targetFat: 65,
  };

  it("renders calorie count", () => {
    render(<DailyNutritionCard {...defaultProps} />);
    expect(screen.getByText("800")).toBeInTheDocument();
  });

  it("renders remaining calories", () => {
    render(<DailyNutritionCard {...defaultProps} />);
    expect(screen.getByText("1200")).toBeInTheDocument();
  });

  it("renders date navigation buttons", () => {
    render(<DailyNutritionCard {...defaultProps} />);
    expect(screen.getByText("←")).toBeInTheDocument();
    expect(screen.getByText("→")).toBeInTheDocument();
  });

  it("renders macro labels", () => {
    render(<DailyNutritionCard {...defaultProps} />);
    expect(screen.getByText("Carbs")).toBeInTheDocument();
    expect(screen.getByText("Protein")).toBeInTheDocument();
    expect(screen.getByText("Fat")).toBeInTheDocument();
  });

  it("renders burned calories section", () => {
    render(<DailyNutritionCard {...defaultProps} />);
    expect(screen.getByText("Total Burned")).toBeInTheDocument();
  });

  it("calls onDateChange when navigating to previous day", async () => {
    const onDateChange = vi.fn();
    render(<DailyNutritionCard {...defaultProps} onDateChange={onDateChange} />);
    const prevBtn = screen.getByText("←").closest("button")!;
    await userEvent.click(prevBtn);
    expect(onDateChange).toHaveBeenCalled();
  });

  it("shows next day button as disabled when on today", () => {
    render(<DailyNutritionCard {...defaultProps} />);
    const nextBtn = screen.getByText("→").closest("button")!;
    expect(nextBtn).toBeDisabled();
  });
});