import { describe, it, expect, vi } from "vitest";
import { DashboardErrorBoundary } from "@/components/DashboardErrorBoundary";

vi.mock("@/lib/sentry", () => ({
  captureError: vi.fn(),
}));

import { captureError } from "@/lib/sentry";
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Test error from child");
  return <div>Child content</div>;
}

describe("DashboardErrorBoundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders children when no error", () => {
    render(
      <DashboardErrorBoundary name="test-widget">
        <div data-testid="child">Hello</div>
      </DashboardErrorBoundary>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders error UI when child throws", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <DashboardErrorBoundary name="nutrition card">
        <ThrowingChild shouldThrow={true} />
      </DashboardErrorBoundary>
    );

    expect(screen.getByText(/Something went wrong loading nutrition card/i)).toBeInTheDocument();
    expect(screen.getByText("Try again")).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it("captures error to Sentry", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <DashboardErrorBoundary name="test">
        <ThrowingChild shouldThrow={true} />
      </DashboardErrorBoundary>
    );

    expect(captureError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ component: "test" })
    );

    consoleSpy.mockRestore();
  });

  it("shows Try again button that resets error boundary", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <DashboardErrorBoundary name="test">
        <ThrowingChild shouldThrow={true} />
      </DashboardErrorBoundary>
    );

    const tryAgainBtn = screen.getByText("Try again");
    expect(tryAgainBtn).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it("renders without name prop", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <DashboardErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </DashboardErrorBoundary>
    );

    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});