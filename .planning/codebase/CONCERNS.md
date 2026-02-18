# Codebase Concerns

**Analysis Date:** 2025-02-14

## Tech Debt

**TypeScript Strict Mode:**
- Issue: Strict mode disabled (`noImplicitAny: false`, `strictNullChecks: false`)
- Files: `tsconfig.json`
- Impact: Type safety compromised, potential runtime errors from type mismatches
- Fix approach: Enable strict mode incrementally, fix resulting type errors

**Code Splitting:**
- Issue: No explicit code splitting for large page bundles
- Files: `src/App.tsx`, `src/pages/` (several 500+ line files)
- Impact: Slower initial load, larger bundle sizes
- Fix approach: Implement React.lazy() for route components, add loading fallbacks

**Testing Gap:**
- Issue: No test framework or tests present
- Files: All source files lack test coverage
- Impact: High risk of regressions, difficult to refactor safely
- Fix approach: Set up Vitest, write tests for critical paths (auth, payments)

**Large Component Files:**
- Issue: Several components exceed 500 lines (Dashboard, admin pages)
- Files: `src/pages/Dashboard.tsx` (535 lines), various admin pages
- Impact: Difficult to maintain, poor separation of concerns
- Fix approach: Extract subcomponents, create custom hooks for complex logic

## Known Bugs

**No Known Bugs Documented:**
- Symptoms: None
- Files: N/A
- Trigger: N/A
- Workaround: N/A

## Security Considerations

**Role-Based Access Control:**
- Risk: Role checks scattered throughout components, not centralized
- Files: All admin/partner pages, `src/components/ProtectedRoute.tsx`
- Current mitigation: Database-level RLS, component-level checks
- Recommendations: Implement centralized authorization hooks, add middleware pattern

**API Key Exposure:**
- Risk: Supabase keys exposed in client code (by design)
- Files: `src/integrations/supabase/client.ts`
- Current mitigation: Using publishable key only, RLS enabled
- Recommendations: Ensure RLS policies are comprehensive, audit regularly

**Input Validation:**
- Risk: Client-side validation only (Zod forms)
- Files: Form components throughout app
- Current mitigation: Zod schema validation
- Recommendations: Add server-side validation in Supabase functions, validate all inputs

**Session Management:**
- Risk: localStorage for session persistence (vulnerable to XSS)
- Files: `src/integrations/supabase/client.ts`, `src/contexts/AuthContext.tsx`
- Current mitigation: Supabase handles auth tokens
- Recommendations: Implement Content Security Policy, consider httpOnly cookies for tokens

## Performance Bottlenecks

**No Pagination:**
- Problem: Queries fetch all records (e.g., all restaurants, all meals)
- Files: `src/pages/Meals.tsx`, `src/pages/Dashboard.tsx`
- Cause: No pagination strategy implemented
- Improvement path: Implement infinite scroll or pagination with Supabase pagination

**Unoptimized Re-renders:**
- Problem: Components may re-render unnecessarily
- Files: Large page components
- Cause: Lack of React.memo, useMemo, useCallback usage
- Improvement path: Add memoization to expensive components and callbacks

**Image Optimization:**
- Problem: No responsive images or lazy loading
- Files: `src/components/MealImageUpload.tsx`, image display components
- Cause: Direct Supabase storage URLs used
- Improvement path: Implement image optimization service, use lazy loading

**Bundle Size:**
- Problem: Large vendor bundles (React, Radix UI, Recharts)
- Files: `vite.config.ts` (some chunking configured)
- Cause: Many UI dependencies
- Improvement path: Tree shaking already configured, consider dynamic imports for heavy libraries

## Fragile Areas

**Auth Context:**
- Files: `src/contexts/AuthContext.tsx`
- Why fragile: Single point of failure for auth, complex state management
- Safe modification: Add tests first, carefully manage session state transitions
- Test coverage: No tests (high risk)

**Subscription Logic:**
- Files: `src/hooks/useSubscription.ts`, subscription-related pages
- Why fragile: Complex business rules, quota management, meal counting
- Safe modification: Comprehensive tests needed, validate edge cases
- Test coverage: No tests (high risk)

**Order Processing:**
- Files: Order-related pages, database functions
- Why fragile: Multi-step process, financial implications
- Safe modification: Transaction safety, validate all steps
- Test coverage: No tests (high risk)

**Navigation Structure:**
- Files: `src/App.tsx` (498 lines of routes)
- Why fragile: Adding routes requires editing large file, risk of merge conflicts
- Safe modification: Consider route configuration file or lazy loading
- Test coverage: No tests

## Scaling Limits

**Supabase Tier:**
- Current capacity: Free tier limitations (500MB DB, 1GB bandwidth)
- Limit: 50,000 requests/month on free tier
- Scaling path: Upgrade to Pro tier as traffic grows

**Realtime Features:**
- Current capacity: Limited use of Supabase Realtime
- Limit: 200 concurrent connections on Supabase free tier
- Scaling path: Implement efficient subscription patterns, upgrade tier

**Mobile Build:**
- Current capacity: Capacitor for native apps
- Limit: App store review processes, device compatibility
- Scaling path: Regular testing on devices, keep Capacitor updated

## Dependencies at Risk

**Supabase:**
- Risk: Vendor lock-in (heavily integrated)
- Impact: Major refactor required if switching providers
- Migration plan: Abstract data layer with repository pattern for future flexibility

**Radix UI:**
- Risk: Frequent updates, potential breaking changes
- Impact: UI component upgrades required
- Migration plan: Stay updated, pin versions in lockfile

**Capacitor:**
- Risk: Native platform changes (iOS/Android)
- Impact: Native code may need updates
- Migration plan: Regular Capacitor updates, test on physical devices

## Missing Critical Features

**Payment Processing:**
- Problem: Stripe referenced in database but not implemented
- Blocks: Subscription payments, one-time orders
- Current status: Manual/admin-only subscription management

**Email Notifications:**
- Problem: No email service integration
- Blocks: Order confirmations, password resets, marketing emails
- Current status: In-app notifications only

**Analytics/Tracking:**
- Problem: No user analytics or error tracking
- Blocks: Data-driven decisions, error monitoring
- Current status: No visibility into user behavior or production errors

**Admin-to-User Messaging:**
- Problem: No communication system for support
- Blocks: Effective customer support
- Current status: Basic ticket system exists but no real-time messaging

## Test Coverage Gaps

**Authentication Flow:**
- What's not tested: Sign up, sign in, sign out, session refresh
- Files: `src/contexts/AuthContext.tsx`, `src/components/ProtectedRoute.tsx`
- Risk: Users locked out or unauthorized access
- Priority: High

**Subscription Quotas:**
- What's not tested: Meal counting, quota resets, plan upgrades/downgrades
- Files: `src/hooks/useSubscription.ts`
- Risk: Users over- or under-charged
- Priority: High

**Order Processing:**
- What's not tested: Order creation, payment handling, notifications
- Files: Order-related pages and components
- Risk: Lost orders, incorrect charges
- Priority: High

**Nutrition Calculations:**
- What's not tested: Calorie math, macro tracking, progress calculations
- Files: `src/lib/nutrition-calculator.ts`
- Risk: Incorrect user data, health implications
- Priority: Medium

**UI Interactions:**
- What's not tested: Form submissions, navigation, modal behavior
- Files: All UI components
- Risk: Broken user experience
- Priority: Low

---

*Concerns audit: 2025-02-14*
