import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SentryErrorBoundary } from "./SentryErrorBoundary";

// Test component that throws an error
const ThrowError = () => {
  throw new Error("Test error");
};

describe("SentryErrorBoundary", () => {
  it("renders children when there is no error", () => {
    render(
      <SentryErrorBoundary>
        <div data-testid="child">Child content</div>
      </SentryErrorBoundary>
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("renders error fallback when child throws", () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <SentryErrorBoundary>
        <ThrowError />
      </SentryErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Reload Page")).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it("renders custom fallback when provided", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const customFallback = <div data-testid="custom-fallback">Custom error</div>;

    render(
      <SentryErrorBoundary fallback={customFallback}>
        <ThrowError />
      </SentryErrorBoundary>
    );

    expect(screen.getByTestId("custom-fallback")).toBeInTheDocument();
    expect(screen.getByText("Custom error")).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
