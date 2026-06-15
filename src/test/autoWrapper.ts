import path from "path";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as rtlRender, renderHook as rtlRenderHook } from "@testing-library/react";
import { vi, beforeEach } from "vitest";

/**
 * Global test setup — auto-wraps every `render()` with QueryClientProvider.
 * 
 * This prevents "No QueryClient set" errors in tests that call useQuery 
 * without manually wrapping in QueryClientProvider.
 */

// ── Auto-wrapping QueryClient ──
let _qc: QueryClient | null = null;

beforeEach(() => {
  _qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
});

function getQC() {
  if (!_qc) throw new Error("QueryClient not initialized — setup.ts beforeEach didn't run");
  return _qc;
}

const QCWrapper = ({ children }: { children: React.ReactNode }) => (
  React.createElement(QueryClientProvider, { client: getQC() }, children)
);

// ── Monkey-patch render and renderHook ──
const origRender = rtlRender;
const origRenderHook = rtlRenderHook;

// @ts-expect-error — override the module's render
(rtlRender as any) = (ui: any, options?: any) =>
  origRender(ui, { ...options, wrapper: QCWrapper });

// @ts-expect-error — override the module's renderHook
(rtlRenderHook as any) = (hook: any, options?: any) =>
  origRenderHook(hook, { ...options, wrapper: QCWrapper });

// Re-export so tests can still import if needed
export { rtlRender as render, rtlRenderHook as renderHook };
