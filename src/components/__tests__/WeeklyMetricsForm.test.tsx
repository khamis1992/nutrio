import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WeeklyMetricsForm } from "@/components/body-metrics/WeeklyMetricsForm";
import { toast } from "sonner";

const logMetrics = vi.fn();

vi.mock("@/hooks/useBodyMetrics", () => ({
  useLogBodyMetrics: () => ({
    mutate: logMetrics,
    isPending: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe("WeeklyMetricsForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits valid body metrics for the selected user", () => {
    const onSuccess = vi.fn();
    render(<WeeklyMetricsForm userId="user-1" onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText(/weight/i), {
      target: { value: "82.5" },
    });
    fireEvent.change(screen.getByLabelText(/waist/i), {
      target: { value: "91" },
    });
    fireEvent.change(screen.getByLabelText(/body fat/i), {
      target: { value: "22" },
    });
    fireEvent.change(screen.getByLabelText(/notes/i), {
      target: { value: "steady week" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save metrics/i }));

    expect(logMetrics).toHaveBeenCalledWith(
      {
        userId: "user-1",
        data: {
          weight_kg: 82.5,
          waist_cm: 91,
          body_fat_percent: 22,
          muscle_mass_percent: undefined,
          notes: "steady week",
        },
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );

    const callbacks = logMetrics.mock.calls[0][1];
    callbacks.onSuccess();
    expect(onSuccess).toHaveBeenCalled();
  });

  it("blocks invalid weight before calling the mutation", () => {
    render(<WeeklyMetricsForm userId="user-1" />);

    fireEvent.change(screen.getByLabelText(/weight/i), {
      target: { value: "0" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /save metrics/i }).closest("form")!);

    expect(logMetrics).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      "Please enter a valid weight (0.1 - 500 kg)",
    );
  });
});
