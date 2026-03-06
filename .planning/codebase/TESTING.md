# Testing Patterns

**Analysis Date:** 2026-03-06

## Test Framework

**Runner:**
- **Vitest** v4.0.18 withglobals enabled
- Config: `vitest.config.ts`

**Assertion Library:**
- **Testing Library** (`@testing-library/react`, `@testing-library/jest-dom`)
- **jsdom** v28.1.0 for DOM simulation
- **user-event** v14.6.1 for user interaction simulation

**Playwright:**
- **Playwright** v1.58.2 for E2E tests
- Used for cross-portal integration tests
- Configured for Chrome browser

**Run Commands:**
```bash
npm run test              # Run Vitest in watch mode
npm run test:run          # Run Vitest once
npm run test:coverage     # Run with V8 coverage report
npx vitest run src/path/to/file.test.tsx   # Run single test file
npm run test:e2e          # Run Playwright E2E tests
npm run test:e2e:ui       # Playwright UI mode
```

**Test Types:**
| Type | Framework | Location | Examples |
|------|-----------|----------|----------|
| Unit | Vitest + RTL | `src/**/*.{test,spec}.tsx` | Component tests, hook tests |
| Integration | Vitest | `src/test/integration/`, `tests/` | RPC function tests |
| E2E | Playwright | `e2e/cross-portal/` | Order lifecycle, user flows |
| Load | Vitest | `tests/load/` | Payment processing performance |
| Financial | Vitest | `tests/financial-integrity.test.ts` | Balance calculations |

## Test File Organization

**Location:**
- **Component/Unit Tests:** Co-located next to source files (e.g., `src/pages/Profile.tsx` ↔ `src/pages/Profile.test.tsx`)
- **Integration Tests:** `src/test/integration/` or `tests/` directory
- **E2E Tests:** `e2e/cross-portal/`
- **Load Tests:** `tests/load/`
- **Setup Files:** `src/test/setup.ts`

**Naming:**
- Component: `{ComponentName}.test.tsx`
- Integration: `{Feature}-integration.test.tsx` or `{Feature}.test.ts`
- E2E: `{feature}-{workflow}.spec.ts`
- Load: `{feature}-load.test.ts`

**Structure:**
```
src/
├── pages/
│   ├── Profile.tsx
│   ├── Profile.test.tsx          # Component tests
│   └── Onboarding.test.tsx
├── hooks/
│   └── useProfile.ts
├── components/
│   └── OrderTrackingHub.test.tsx
└── test/
    ├── setup.ts                  # Global test configuration
    ├── server.ts                 # MSW server setup
    ├── integration/
    │   └── critical-flows.test.tsx
    └── mocks/
        └── index.ts
tests/
├── load/
│   ├── payment-processing-load.test.ts
│   └── meal-completion-load.test.ts
├── financial-integrity.test.ts
└── ai-accuracy.test.ts
e2e/
└── cross-portal/
    ├── order-lifecycle.spec.ts
    ├── customer-journey.spec.ts
    ├── subscription-management.spec.ts
    └── ...

```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("ComponentName", () => {
  beforeEach(() => {
    // Clear mocks, set up defaults
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Feature/State", () => {
    it("should behave correctly in this scenario", async () => {
      // Arrange
      render(<Component />);
      
      // Act
      await userEvent.click(screen.getByRole("button"));
      
      // Assert
      expect(screen.getByText("Success")).toBeInTheDocument();
    });
  });
});
```

**Patterns:**

**Setup Pattern:**
```typescript
const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          {ui}
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

const mockAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: mockAuth,
}));
```

**Teardown Pattern:**
```typescript
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});
```

**Assertion Pattern:**
- Use `toBeInTheDocument()` for presence checks
- Use `toBeInTheDocument()` for absence (expect().not.toBeInTheDocument())
- Use `toHaveBeenCalledWith()` for mock verification
- Use `toHaveTextContent()` for text matching with whitespace tolerance
- Use `toHaveValue()` for form inputs
- Use `toHaveStyle()` for CSS property verification

## Mocking

**Supabase Client:**
```typescript
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    rpc: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
  },
}));
```

**Auth Context:**
```typescript
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { id: "test-user-id", email: "test@example.com" },
    session: null,
    loading: false,
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));
```

**Toast Notifications:**
```typescript
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
  },
}));
```

**What to Mock:**
- Supabase client for API calls
- Context providers (AuthContext, AnalyticsContext)
- External services (toast, router navigation)
- Capacitor APIs for native features

**What NOT to Mock:**
- Utility functions (e.g., `cn()`, `formatCurrency`)
- Library components (shadcn/ui, Radix primitives)
- QueryClient from TanStack Query
- Standard React hooks (useState, useEffect, useContext)

**MSW (Mock Service Worker):**
- Configured in `src/test/server.ts`
- Used for API request/response interception
- Ideal for testing network layers and error scenarios

## Fixtures and Factories

**Test Data:**
```typescript
const mockActiveOrders = [
  {
    id: "order-1",
    restaurant_name: "Healthy Bites",
    status: "preparing",
    delivery_date: "2025-02-27",
    meal_type: "Lunch",
    meal_name: "Grilled Chicken Salad",
    driver_name: "Ahmed",
    driver_phone: "+974 1234 5678",
  },
  {
    id: "order-2",
    restaurant_name: "Green Kitchen",
    status: "out_for_delivery",
    delivery_date: "2025-02-27",
    meal_type: "Dinner",
    meal_name: "Quinoa Bowl",
    driver_name: "Mohammed",
    driver_phone: "+974 8765 4321",
  },
];
```

**Location:**
- Simple fixtures: Within test file as constants
- Complex fixtures: In `src/test/mocks/index.ts`
- Database insertions: In E2E test files (Playwright)

## Coverage

**Requirements:** No formal coverage threshold enforced

**Configuration:**
```typescript
coverage: {
  provider: "v8",
  reporter: ["text", "json", "html"],
  exclude: [
    "node_modules/",
    "src/test/",
    "**/*.d.ts",
    "**/*.config.*",
    "**/mockData.*",
  ],
}
```

**View Coverage:**
```bash
npm run test:coverage    # Generate and open coverage report
# Report available at: coverage/index.html
```

## Test Types

**Unit Tests:**
- Scope: Single component, hook, or utility function
- Approach: Render single component, mock dependencies
- Example: `src/components/OrderTrackingHub.test.tsx`
- Used for: UI components, hooks, utility functions

**Integration Tests:**
- Scope: Multiple components working together, RPC functions
- Approach: Render with providers, test data flow
- Example: `src/test/integration/critical-flows.test.tsx`
- Used for: Database RPC functions, multi-step flows, state transitions

**E2E Tests (Playwright):**
- Scope: Full user journeys across portals
- Approach: Real browser automation
- Example: `e2e/cross-portal/order-lifecycle.spec.ts`
- Portals tested: Customer, Partner, Admin, Driver
- Used for: Critical user flows, cross-portal workflows

**Load Tests:**
- Scope: High-volume operations
- Approach: Simulate concurrent requests
- Example: `tests/load/payment-processing-load.test.ts`
- Used for: Database RPC performance testing

**Financial Integrity Tests:**
- Scope: Critical financial calculations
- Approach: Direct database queries and RPC calls
- Example: `tests/financial-integrity.test.ts`
- Used for: Balance accuracy, transaction integrity

## Common Patterns

**Async Testing:**
```typescript
it("should complete async operation", async () => {
  render(<Component />);
  
  await userEvent.click(screen.getByRole("button"));
  await waitFor(() => {
    expect(screen.getByText("Success")).toBeInTheDocument();
  });
});
```

**Error Testing:**
```typescript
it("should handle error state", async () => {
  vi.mocked(supabase.from).mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: null,
      error: new Error("Database error"),
    }),
  } as any);
  
  render(<Component />);
  
  await waitFor(() => {
    expect(screen.getByText("Error occurred")).toBeInTheDocument();
  });
});
```

**Loading State Testing:**
```typescript
it("should show loading while fetching", async () => {
  vi.mocked(supabase.from).mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockImplementation(() => new Promise(() => {})), // Never resolves
  } as any);
  
  render(<Component />);
  expect(screen.getByRole("status")).toBeInTheDocument();
});
```

**Form Testing:**
```typescript
it("should validate and submit form", async () => {
  renderWithProviders(<FormComponent />);
  
  await userEvent.type(screen.getByLabelText(/Email/i), "test@example.com");
  await userEvent.click(screen.getByRole("button", { name: /Submit/i }));
  
  await waitFor(() => {
    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ email: "test@example.com" })
    );
  });
});
```

**User Flow Testing:**
```typescript
it("should navigate through multi-step flow", async () => {
  renderWithProviders(<Onboarding />);
  
  // Step 1
  await userEvent.click(screen.getByText("Lose Weight"));
  await userEvent.click(screen.getByText(/Continue/i));
  
  // Step 2
  await waitFor(() => {
    expect(screen.getByText(/Tell us about yourself/i)).toBeInTheDocument();
  });
  
  await userEvent.click(screen.getByText(/Male/i));
  await userEvent.click(screen.getByText(/Continue/i));
  
  // Verify state persists
  await waitFor(() => {
    expect(screen.getByText(/Step 2 of 5/i)).toBeInTheDocument();
  });
});
```

## E2E Test Patterns (Playwright)

**Cross-Portal Tests:**
- Located in `e2e/cross-portal/`
- Test workflows spanning multiple user portals
- Examples: Customer places order, Partner receives order, Driver delivers

**Test Categories:**
- `order-lifecycle.spec.ts` - Full order flow
- `customer-journey.spec.ts` - Customer onboarding to purchase
- `partner-onboarding.spec.ts` - Restaurant onboarding
- `driver-delivery.spec.ts` - Driver assignment and delivery
- `admin-management.spec.ts` - Admin user and restaurant management
- `subscription-management.spec.ts` - Subscription creation and management
- `wallet-payments.spec.ts` - Payment and wallet credit flow

**Run Specific Tests:**
```bash
npm run test:cross-portal:ui                  # UI mode
npm run test:order-lifecycle                  # Single file
npm run test:partner-onboarding               # Partner workflow
```

---

*Testing analysis: 2026-03-06*