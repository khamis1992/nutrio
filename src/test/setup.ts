import "@testing-library/jest-dom";
import { beforeEach, vi } from "vitest";

vi.mock("lottie-web/build/player/lottie_light", () => ({
  default: {
    loadAnimation: vi.fn(() => ({
      destroy: vi.fn(),
      goToAndStop: vi.fn(),
      totalFrames: 1,
    })),
  },
}));

function createMemoryStorage(): Storage {
  let values: Record<string, string> = {};

  return {
    get length() { return Object.keys(values).length; },
    clear: vi.fn(() => { values = {}; }),
    getItem: vi.fn((key: string) => values[key] ?? null),
    key: vi.fn((index: number) => Object.keys(values)[index] ?? null),
    removeItem: vi.fn((key: string) => { delete values[key]; }),
    setItem: vi.fn((key: string, value: string) => { values[key] = String(value); }),
  };
}

beforeEach(() => {
  const storage = window.localStorage;
  if (
    typeof storage?.getItem !== "function" ||
    typeof storage?.setItem !== "function" ||
    typeof storage?.removeItem !== "function" ||
    typeof storage?.clear !== "function"
  ) {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createMemoryStorage(),
    });
  }
});

export function createSupabaseMockChain(resolver?: () => Promise<unknown>): Record<string, ReturnType<typeof vi.fn>> {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = new Set(["select", "insert", "update", "delete", "upsert", "eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in", "contains", "not", "or", "and", "filter", "match", "order", "limit", "range", "offset", "maybeSingle", "single", "setHeader", "overrideTypes"]);
  const proxy = new Proxy(chain, {
    get(target, prop) {
      if (typeof prop === "symbol") return undefined;
      if (prop === "then") {
        return (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
          Promise.resolve(resolver ? resolver() : { data: [], error: null }).then(resolve, reject);
      }
      if (prop in target) return (target as any)[prop];
      const fn = vi.fn().mockReturnValue(proxy);
      (target as any)[prop] = fn;
      return fn;
    },
  });
  for (const m of methods) (chain as any)[m] = vi.fn().mockReturnValue(proxy);
  if (resolver) { (chain as any).maybeSingle = vi.fn().mockImplementation(resolver); (chain as any).single = vi.fn().mockImplementation(resolver); }
  return proxy;
}

// Global supabase mock — handles ALL query methods via Proxy
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn().mockReturnValue(createSupabaseMockChain()),
    channel: vi.fn().mockReturnValue({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }) }),
    removeChannel: vi.fn(),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }), signInWithPassword: vi.fn(), signUp: vi.fn(), signOut: vi.fn(), onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }) },
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
    rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "RPC unavailable in unit tests" } }),
    realtime: { setAuth: vi.fn() },
  },
}));

vi.mock("import.meta.env", () => ({ VITE_SUPABASE_URL: "https://test.supabase.co", VITE_SUPABASE_PUBLISHABLE_KEY: "test-key", VITE_SENTRY_DSN: "", VITE_POSTHOG_KEY: "", DEV: true, MODE: "test" }));

Object.defineProperty(window, "matchMedia", { writable: true, value: vi.fn().mockImplementation((q: string) => ({ matches: false, media: q, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })) });
class MockIO { observe = vi.fn(); disconnect = vi.fn(); unobserve = vi.fn(); }
Object.defineProperty(window, "IntersectionObserver", { writable: true, value: MockIO });
class MockRO { observe = vi.fn(); disconnect = vi.fn(); unobserve = vi.fn(); }
Object.defineProperty(window, "ResizeObserver", { writable: true, value: MockRO });
window.scrollTo = vi.fn();
const _err = console.error;
console.error = (...args: unknown[]) => { const m = args[0]?.toString() || ""; if (m.includes("Warning:") || m.includes("act") || m.includes("not wrapped in act")) return; _err(...args); };
