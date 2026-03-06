# Coding Conventions

**Analysis Date:** 2026-03-06

## Naming Patterns

**Files:**
- Components: PascalCase with descriptive names (e.g., `OrderTrackingHub.tsx`, `MealWizard.tsx`)
- Hooks: `use` prefix + camelCase (e.g., `useProfile.ts`, `useWallet.ts`, `useSubscription.ts`)
- Services: PascalCase + `Service` suffix (e.g., `walletService.ts`, `emailService.ts`)
- Utilities: camelCase (e.g., `utils.ts`, `currency.ts`, `nutrition-calculator.ts`)
- Tests: Component name + `.test.tsx` (e.g., `Profile.test.tsx`, `NotificationPreferences.test.tsx`)

**Functions:**
- Main export: PascalCase for components (e.g., `const Button = ...`)
- Hooks: camelCase with `use` prefix (e.g., `export const useProfile = ...`)
- Utilities: camelCase (e.g., `export function cn(...)`)
- Async operations: present tense verbs (e.g., `fetchProfile`, `processWalletTopup`, `submitMealReview`)

**Variables:**
- State: camelCase (e.g., `profile`, `loading`, `subscription`, `wallet`)
- Event handlers: `on` + action name (e.g., `handleSubmit`, `handleClick`)
- Refs: `ref` prefix + camelCase (e.g., `refInput`, `refModal`)

**Types/Interfaces:**
- PascalCase (e.g., `interface Profile`, `interface WalletData`, `type TabValue`)
- Return types: `UseXReturn` for hooks (e.g., `UseSubscriptionReturn`, `UseProfileReturn`)
- API responses: `XResult` (e.g., `WalletTopupResult`)

## Code Style

**Formatting:**
- **No explicit formatter configured** - relies on editor defaults
- Use double quotes for strings
- Import organization: React → third-party → `@/` absolute imports → relative imports
- Maximum line length: ~120 characters
- Curly braces: always used, block on new line for multiline statements

**Linting:**
- **ESLint 9** with TypeScript support via `typescript-eslint`
- Config: `eslint.config.js` (flat config format)
- Rules:
  - `@typescript-eslint/no-unused-vars`: **off** (relies on tsc for that)
  - `react-refresh/only-export-components`: warn
  - `react-hooks` rules enabled (recommended config)
  - ESLint disabled for e2e test files (`e2e/**/*`) - React hooks rules don't apply to Playwright tests

## Import Organization

**Order:**
1. React hooks and core (`import { useState, useEffect, useCallback } from "react"`)
2. Third-party libraries (React Router, Framer Motion, etc.)
3. Absolute imports from `@/` (`@/hooks/...`, `@/components/...`, `@/lib/...`)
4. Relative imports (`../utils`, `./types`)

**Path Aliases:**
- `@/` maps to `./src` (defined in `tsconfig.json` and `vitest.config.ts`)

## Error Handling

**Supabase Queries:**
- Always check `error` in response and throw if present
- Pattern: `if (error) throw error;`
- For async functions: `try { ... } catch (err) { setError(err as Error) }`

**API Response Pattern:**
```typescript
export const useProfile = () => {
  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase.from("profiles").select("*").maybeSingle();
      if (error) throw error;
      setProfile(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };
};
```

**Async Functions:**
- Return `{ data, error }` pattern for mutations
- Pattern: `return { data: null, error: err as Error };`

**User-Facing Errors:**
- Use Sonner `toast.error()` for user notifications
- Use `console.error()` for debug logging only
- In production code paths, use `captureError()` from `@/lib/sentry`

**Error Tracking:**
```typescript
import { captureError } from "@/lib/sentry";

// Usage
if (error) {
  console.error("Wallet credit failed:", creditError);
  captureError(error, { context: "wallet-topup" });
  return { success: false, error: "Failed to credit wallet" };
}
```

## Logging

**Framework:** Console only (no logging library used)

**Patterns:**
- Debug: `console.log()`, `console.error()` - only in development or error cases
- Production errors: `captureError()` from Sentry
- Production info: `captureMessage()` from Sentry

**Important:** Console logs are removed in production build (`vite build` uses terser with `drop_console: true`)

## Comments

**When to Comment:**
- Complex business logic (e.g., subscription proration algorithm)
- Non-obvious workarounds or limitations
- File-level documentation
- Test suites have extensive documentation

**JSDoc/TSDoc:**
- Not consistently used across codebase
- Most functions rely on TypeScript types for documentation
- Test files often have detailed docblock comments describing test scope

## Function Design

**Size:**
- Components: Typically 50-200 lines
- Hooks: 30-100 lines
- Utility functions: 5-30 lines (often one-liners)

**Parameters:**
- Use named parameters (objects) for functions with 3+ arguments
- Group related parameters into interfaces

**Return Values:**
- Hooks: Return object with all state and functions
- API functions: `{ data, error }` or `{ success, error }`

## Module Design

**Exports:**
- Default export for single main component (e.g., `export default Onboarding`)
- Named exports for multiple components (e.g., `export { Button, buttonVariants }`)
- Mixed in hooks: `export const useX` and `export type UseXReturn`

**Barrel Files:**
- Used in `src/components/ui/index.ts` for UI components
- Used in `src/fleet/index.ts` for fleet module exports
- Not consistently used throughout codebase

## State Management

**Approach (per AGENTS.md):**
- React Context for global state (auth, analytics, language)
- TanStack Query for server state (used via custom hooks)
- `useState`/`useReducer` for local component state
- Local state for form inputs

**Context Pattern:**
```typescript
// src/contexts/AuthContext.tsx
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
```

## Component Structure

**Functional Components:**
- Export as named or default export
- Props typed as interface
- Hooks at top, then rendering logic

**Component Naming:**
- PascalCase for file and component name
- Descriptive names indicating purpose (e.g., `OrderTrackingHub`, `MealWizard`)

## Testing Conventions

**Hook Tests:**
- Mock context/providers via `vi.mock()`
- Use `renderHook` from `@testing-library/react` or manual hook calls
- Test loading states, success, and error scenarios

**Component Tests:**
- Render with appropriate providers (QueryClient, Router, AuthProvider)
- Mock Supabase client for database interactions
- Test user interactions with `userEvent`
- Use `screen` queries (getByRole, getByText, etc.)

## Special Patterns

**Toast Notifications:**
- Prefer Sonner for all user notifications
- Use `toast.success()`, `toast.error()`, `toast.loading()`
- Fallback to `sonnerToast.toast()` for default toast
- Custom dialog for destructive actions (ConfirmDialog pattern)

**Supabase Client Usage:**
- Single import: `import { supabase } from "@/integrations/supabase/client"`
- Always check `error` property
- Use `.maybeSingle()` for potentially null results
- Use `.single()` for required results (throw on null)

**CSS Utility:**
- Use `cn()` from `@/lib/utils` for class merging
- Pattern: `cn("base-class", { "conditional-class": condition })`
- Follows shadcn/ui component patterns

---

*Convention analysis: 2026-03-06*