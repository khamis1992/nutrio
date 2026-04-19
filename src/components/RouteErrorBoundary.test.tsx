import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@sentry/react", () => ({
  captureException: vi.fn(),
  withErrorBoundary: (component: any) => component,
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

import * as Sentry from "@sentry/react";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

function ThrowingChild(): never {
  throw new Error("Route error test");
}

describe("RouteErrorBoundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders children when no error", () => {
    render(
      <RouteErrorBoundary>
        <div data-testid="child">Content</div>
      </RouteErrorBoundary>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders error fallback when child throws", () => {
    render(
      <RouteErrorBoundary>
        <ThrowingChild />
      </RouteErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("displays error message in fallback", () => {
    render(
      <RouteErrorBoundary>
        <ThrowingChild />
      </RouteErrorBoundary>
    );

    expect(screen.getByText("Route error test")).toBeInTheDocument();
  });

  it("has Reload button", () => {
    render(
      <RouteErrorBoundary>
        <ThrowingChild />
      </RouteErrorBoundary>
    );

    expect(screen.getByText("Reload")).toBeInTheDocument();
  });

  it("has Go Home button", () => {
    render(
      <RouteErrorBoundary>
        <ThrowingChild />
      </RouteErrorBoundary>
    );

    expect(screen.getByText("Go Home")).toBeInTheDocument();
  });

  it("reports error to Sentry", () => {
    render(
      <RouteErrorBoundary>
        <ThrowingChild />
      </RouteErrorBoundary>
    );

    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        extra: expect.objectContaining({ componentStack: expect.any(String) }),
      })
    );
  });
});