import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock environment variables
vi.mock("import.meta.env", () => ({
  VITE_SUPABASE_URL: "https://test.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "test-key",
  VITE_SENTRY_DSN: "",
  VITE_POSTHOG_KEY: "",
  DEV: true,
  MODE: "test",
}));

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  value: MockIntersectionObserver,
});

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: MockResizeObserver,
});

// Mock scrollTo
window.scrollTo = vi.fn();

// Suppress console errors during tests
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  // Filter out React warnings and other expected errors
  const message = args[0]?.toString() || "";
  if (
    message.includes("Warning:") ||
    message.includes("act") ||
    message.includes("not wrapped in act")
  ) {
    return;
  }
  originalConsoleError(...args);
};
