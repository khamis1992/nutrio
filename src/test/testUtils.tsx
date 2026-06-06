/**
 * Test utilities — shared render wrappers for Vitest + React Testing Library.
 *
 * Provides renderWithProviders() and renderHookWithProviders() that
 * automatically wrap components with QueryClientProvider.
 *
 * Import path: @/test/testUtils
 */
import React, { ReactNode } from "react";
import { render, renderHook, RenderOptions, RenderHookOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";

/** Creates a fresh QueryClient for each test to avoid cache leaks. */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface AllTheProvidersProps {
  children: ReactNode;
}

export function AllTheProviders({ children }: AllTheProvidersProps) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

/**
 * Renders a React element with QueryClientProvider.
 * Drop-in replacement for @testing-library/react's render().
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  return render(ui, { wrapper: AllTheProviders, ...options });
}

/**
 * Renders a hook with QueryClientProvider.
 * Drop-in replacement for @testing-library/react's renderHook().
 */
export function renderHookWithProviders<Result, Props>(
  hook: (initialProps: Props) => Result,
  options?: Omit<RenderHookOptions<Props>, "wrapper">
) {
  return renderHook(hook, { wrapper: AllTheProviders, ...options });
}
