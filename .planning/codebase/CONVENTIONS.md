# Coding Conventions

**Analysis Date:** 2025-02-14

## Naming Patterns

**Files:**
- Components: PascalCase (`RestaurantCard.tsx`, `AdminLayout.tsx`)
- Hooks: camelCase with `use` prefix (`useProfile.ts`, `useSubscription.ts`)
- Pages: PascalCase, matching route name (`Dashboard.tsx`, `Meals.tsx`)
- Utilities: camelCase (`currency.ts`, `nutrition-calculator.ts`)
- UI components: kebab-case (`button.tsx`, `alert-dialog.tsx`)

**Functions:**
- camelCase for all functions (`fetchProfile`, `updateProfile`, `handleSignOut`)
- Event handlers prefixed with `handle` (`handleClick`, `handleSubmit`)
- Async functions use `async/await` pattern
- Getter functions named after data they return (`getRole`, `hasPermission`)

**Variables:**
- camelCase for all variables (`userName`, `isLoading`, `hasActiveSubscription`)
- Boolean variables prefixed with `is`, `has`, `should` (`isOpen`, `hasRestaurant`)
- Constants: UPPER_SNAKE_CASE (not widely used, should be adopted)

**Types/Interfaces:**
- PascalCase for type names (`Profile`, `Restaurant`, `Order`)
- Interface names match domain concepts
- Props interfaces: `[ComponentName]Props` (e.g., `ProtectedRouteProps`)

## Code Style

**Formatting:**
- Tool: Not explicitly configured (likely Prettier via editor)
- Key settings: Inferred from code
  - Single quotes for strings
  - Trailing commas in multi-line statements
  - 2-space indentation
  - Semicolons present

**Linting:**
- Tool: ESLint with flat config
- Key rules:
  - react-hooks rules enforced
  - react-refresh for fast refresh
  - TypeScript checking via typescript-eslint
  - No explicit rules file pattern detected

## Import Organization

**Order:**
1. React imports
2. Third-party imports (lucide-react, @radix-ui, etc.)
3. Internal imports (grouped by source)
   - @/components
   - @/hooks
   - @/contexts
   - @/integrations
   - @/lib
4. Relative imports
5. CSS imports (typically in main.tsx only)

**Path Aliases:**
- `@/*` → `./src/*`
- Examples:
  - `@/components/ui/button`
  - `@/hooks/useProfile`
  - `@/integrations/supabase/client`

**Example import block:**
```typescript
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
```

## Error Handling

**Patterns:**
- Try-catch blocks for async operations
- Return tuple `{ data, error }` from async functions
- Check for error and throw/return early
- Toast notifications for user-facing errors
- Console logging for debugging (development only)

**Example pattern:**
```typescript
try {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  setProfile(data);
} catch (err) {
  setError(err as Error);
} finally {
  setLoading(false);
}
```

## Logging

**Framework:** console (no structured logging)

**Patterns:**
- `console.error()` for error conditions
- `console.log()` for debugging
- Console logs dropped in production via Vite config
- No logging service integration

## Comments

**When to Comment:**
- Minimal comments in codebase
- Complex logic sometimes explained inline
- Component props documented via TypeScript interfaces

**JSDoc/TSDoc:**
- Not extensively used
- Types preferred over documentation comments
- Some function-level comments in business logic

## Function Design

**Size:**
- Component files: 200-500 lines typical
- Hook files: 50-150 lines
- Utility files: 50-100 lines
- Large components: Dashboard.tsx (535 lines), several admin pages

**Parameters:**
- Destructured props in components
- Parameter objects for multiple params (not consistently used)
- Options objects for configuration

**Return Values:**
- Hooks return objects: `{ data, loading, error, refetch, updateX }`
- Async functions return tuples: `{ data, error }`
- Consistent return shapes across hooks

**Example hook pattern:**
```typescript
export const useProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProfile = async () => { /* ... */ };
  const updateProfile = async (updates: Partial<Profile>) => { /* ... */ };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  return { profile, loading, error, refetch: fetchProfile, updateProfile };
};
```

## Module Design

**Exports:**
- Named exports for components and utilities
- Default exports for pages and main components
- Consistent within each module

**Barrel Files:**
- Not extensively used
- Direct imports preferred
- UI components each exported individually

---

*Convention analysis: 2025-02-14*
