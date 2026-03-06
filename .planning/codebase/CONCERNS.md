# Codebase Concerns

**Analysis Date:** 2026-03-06

## Tech Debt

### Payment Simulation in Production Codebase

**Issue:** The `payment-simulation.ts` service and `useSimulatedPayment.ts` hook are part of the production checkout flow (`src/pages/Checkout.tsx`). The payment simulation is controlled by `VITE_ENABLE_PAYMENT_SIMULATION` environment variable.

**Files:** 
- `src/lib/payment-simulation.ts`
- `src/hooks/useSimulatedPayment.ts`
- `src/pages/Checkout.tsx` (lines 118-128)

**Impact:** If the simulation flag is accidentally enabled in production, real payments could be simulated instead of processed through Sadad gateway. This could result in orders being fulfilled without payment.

**Fix approach:** 
1. Move payment simulation to test-only environment
2. Never expose simulation controls via client-side env vars
3. Add server-side checks before allowing simulation mode
4. Remove the simulation flag from `.env.production.template`

---

### IP Geo-Restriction Bypass for E2E Testing

**Issue:** The `checkIPLocation()` function in `src/lib/ipCheck.ts` has a hardcoded bypass that returns allow=true for all IPs with the comment "E2E TESTING MODE - IP restriction disabled" (lines 20-30).

**Files:** 
- `src/lib/ipCheck.ts` (lines 19-30)
- `src/lib/ipCheck.ts` (TODO comment at line 21)

**Impact:** The Qatar-only restriction is completely disabled, allowing access from any country. This defeats a key compliance requirement for operating in Qatar.

**Fix approach:**
1. Remove the hardcoded bypass completely
2. Use proper E2E test fixtures or mock the API endpoint instead
3. Add a separate `VITE_E2E_TEST_MODE` flag that only affects tests, not production builds
4. Add an intentional delay or error on non-test environments if this bypass code is triggered

---

### Fleet Auth Edge Function - No Token Revocation

**Issue:** The Fleet Auth Edge Function at `supabase/functions/fleet-auth/index.ts` has a TODO at line 259: "Add token to revocation list (Redis) for immediate invalidation". Currently, when users logout, tokens remain valid until expiry.

**Files:** 
- `supabase/functions/fleet-auth/index.ts` (line 259)

**Impact:** Stolen or compromised fleet manager tokens remain valid for up to 7 days (refresh token expiry). This is a significant security vulnerability for fleet management.

**Fix approach:**
1. Implement Redis-based token revocation as indicated in the TODO
2. Store revoked tokens with expiry matching their TTL
3. Validate token revocation on each request before processing
4. Add unit tests for revocation flow

---

### Fleet Auth Edge Function - No Rate Limiting

**Issue:** The Fleet Auth Edge Function has a TODO at line 15: "Implement Redis-based rate limiting for production". Currently uses in-memory approach with only 5 attempts per minute.

**Files:** 
- `supabase/functions/fleet-auth/index.ts` (line 15)
- `supabase/functions/fleet-vehicles/index.ts` (line 11)
- `supabase/functions/fleet-tracking/index.ts` (line 14)
- `supabase/functions/fleet-payouts/index.ts` (line 11)
- `supabase/functions/fleet-drivers/index.ts` (line 11)

**Impact:** Without proper rate limiting, the auth endpoints are vulnerable to brute-force attacks. The current implementation only works per-instance, not across all edge function instances.

**Fix approach:**
1. Implement distributed rate limiting using Redis (as planned in TODO)
2. Store attempt counts with per-IP and per-email tracking
3. Return proper 429 responses with retry-after headers
4. Add monitoring for rate limit breaches

---

### Deprecated Fields Not Removed from Database Schema

**Issue:** Multiple database columns have been marked as DEPRECATED in code but remain in the database and public API:
- `meals.price` - meals are now subscription-only (migrations 20260221150000, 20260225211308)
- `restaurant_details.bank_account_number` - migrated to encrypted version (migration 20260226000001)

**Files:** 
- `src/pages/partner/PartnerMenu.tsx` (DEPRECATED comment at line 54)
- `supabase/migrations/20260225211308_add_subscription_columns.sql`
- `supabase/migrations/20260226000001_encrypt_banking_data.sql`

**Impact:** 
1. API still accepts and potentially uses deprecated fields
2. Database schema contains redundant data
3. Developers may unknowingly use deprecated fields

**Fix approach:**
1. Add database trigger to reject inserts/updates on deprecated columns
2. Add runtime warnings when deprecated fields are accessed
3. Create migration to drop deprecated columns after verifying no usage
4. Update Supabase types after column removal

---

### Bank Encryption Key Hardcoded as Placeholder

**Issue:** The encryption key in `supabase/migrations/20260226000001_encrypt_banking_data.sql` is hardcoded as `YOUR_SECURE_32_BYTE_KEY_HERE` (line 26). The migration warns "In production, never store encryption keys in the database" (line 24).

**Files:** 
- `supabase/migrations/20260226000001_encrypt_banking_data.sql` (lines 24-27)

**Impact:** Banking data encryption is not actually secure - anyone with database access can decrypt the data using the hardcoded key.

**Fix approach:**
1. Use AWS KMS or HashiCorp Vault for key management
2. Store key references in environment variables, not SQL files
3. Modify encryption functions to fetch keys from external vault service
4. Add key rotation mechanism
5. Re-encrypt all data with properly managed keys

---

### TODO Comments in Fleet Dashboard Stats

**Issue:** The `getDashboardStats()` function in `src/fleet/services/fleetApi.ts` returns hardcoded zeros for key metrics with TODO comments indicating they need implementation.

**Files:** 
- `src/fleet/services/fleetApi.ts` (lines 119-121)

```typescript
ordersInProgress: 0, // TODO: Implement with orders table
todayDeliveries: 0, // TODO: Implement with deliveries
averageDeliveryTime: 0, // TODO: Calculate from delivery times
```

**Impact:** Fleet dashboard shows incomplete metrics, reducing operational visibility and decision-making capability.

**Fix approach:**
1. Implement actual queries against orders and deliveries tables
2. Add database indexes for common aggregation queries
3. Consider caching results if queries become expensive

---

## Known Bugs

### Missing Dependency Warning in useSmartRecommendations

**Issue:** The `useSmartRecommendations.ts` hook has a React exhaustive-deps warning. The `generateRecommendations` function is defined inside the component (line 211) and used in a useEffect (line 283-285), but is not in the dependency array.

**Files:** 
- `src/hooks/useSmartRecommendations.ts` (lines 283-285)

**Symptoms:** 
- React console warning: "React Hook useEffect has a missing dependency: 'generateRecommendations'"
- Potential stale closure issues if `userId` changes between renders

**Workaround:** None - the hook currently works but may have subtle bugs.

**Fix approach:**
1. Move `generateRecommendations` outside the component using `useCallback`
2. Add proper dependency array to useEffect
3. or wrap in `useMemo` if the function depends on props/state

---

### Missing keys in Addresses Page Error Messages

**Issue:** The `Addresses.tsx` page has TODO comments indicating missing keys for error message toast descriptions.

**Files:** 
- `src/pages/Addresses.tsx` (lines 353, 477, 498)

**Symptoms:** 
- Error messages may not display properly in the UI
- Missing i18n keys could cause fallback text

**Workaround:** None - code uses default text if key is missing

**Fix approach:**
1. Add missing i18n keys for error messages
2. Run lint/check script to catch i18n issues

---

### Race Condition in AuthState Initialization

**Issue:** The `AuthProvider` in `src/contexts/AuthContext.tsx` sets up an auth listener (lines 38-51) AND checks existing session (lines 54-58) separately. There's a potential race condition where both callbacks execute, possibly causing UI to re-render unnecessarily or show inconsistent state.

**Files:** 
- `src/contexts/AuthContext.tsx` (lines 36-61)

**Symptoms:** 
- App may briefly show loading state on initial render
- Auth state may flicker between null and user

**Workaround:** None - functionally works but suboptimal

**Fix approach:**
1. Remove the separate `getSession()` call - the onAuthStateChange listener will fire with existing session
2. OR use a flag to track initialization to prevent duplicate handling

---

## Security Considerations

### Client-Side API Keys in Supabase Client

**Risk:** The Supabase client at `src/integrations/supabase/client.ts` (lines 7-8) loads `VITE_SUPABASE_PUBLISHABLE_KEY` at runtime. While publishable keys are designed for client use, any secret leaked through build artifacts or browser devtools exposes the project to unauthorized access.

**Files:** 
- `src/integrations/supabase/client.ts`

**Current mitigation:** Uses publishable key (not service role key), RLS on all tables

**Recommendations:**
1. Verify all Supabase tables have proper RLS policies
2. Consider using Supabase project with restricted keys
3. Add Content Security Policy headers to prevent key theft via XSS
4. Monitor Supabase dashboard for suspicious activity

---

### SQL Injection Risk from User Supplied Input

**Risk:** Several places use `.or()` and `.ilike()` with user input without explicit sanitization. While Supabase's built-in escaping helps, there's potential for injection via complex query compositions.

**Files:** 
- `src/fleet/services/fleetApi.ts` (line 200) - uses `.or()` with search
- `src/hooks/usePagination.ts` - pagination queries

**Current mitigation:** Supabase client uses parameterized queries for `.eq()`, `.in()`, etc.

**Recommendations:**
1. Add input sanitization for user-provided search terms
2. Whitelist allowed fields for `.or()` queries
3. Consider using raw SQL only with properly escaped parameters

---

### XSS Risk from Unsanitized User Content

**Risk:** User-provided content (restaurant names, meal descriptions, user reviews) is rendered directly in React components. While React default escapes text, HTML content from the database could lead to XSS.

**Files:** 
- Multiple pages rendering meal/restaurant data
- `src/components/MealDetail.tsx`
- `src/pages/RestaurantDetail.tsx`

**Current mitigation:** React escapes text by default when using `{variable}` syntax

**Recommendations:**
1. Audit where HTML content is rendered using `dangerouslySetInnerHTML`
2. Consider using a sanitizer library for rich text content
3. Implement CSP headers

---

### Session Not Cleared on Fleet Logout

**Risk:** The fleet manager logout in `src/fleet/services/fleetApi.ts` calls `signOut()` but the JWT tokens (access and refresh) remain valid until expiry due to lack of token revocation (see Tech Debt item above).

**Files:** 
- `src/fleet/services/fleetApi.ts` (line 78)
- `supabase/functions/fleet-auth/index.ts` (line 259)

**Current mitigation:** Tokens expire after 15 minutes (access) or 7 days (refresh)

**Recommendations:** Implement Redis-based token revocation as planned in TODO

---

### Payment Simulation Can Be Enabled Remotely

**Risk:** The payment simulation flag `VITE_ENABLE_PAYMENT_SIMULATION` is read from `import.meta.env` (line 221 in `payment-simulation.ts`). If an attacker can modify build config or inject environment variables, they could enable payment simulation.

**Files:** 
- `src/lib/payment-simulation.ts` (line 221)
- `src/pages/Checkout.tsx` (line 118 uses `process.env.NODE_ENV`)

**Current mitigation:** Uses `NODE_ENV` check at line 118, but simulation config checks separate flag

**Recommendations:**
1. Never enable payment simulation on production builds
2. Move simulation logic to a separate test-only package
3. Add build-time flag that cannot be overridden at runtime

---

## Performance Bottlenecks

### Large Supabase Types File

**Problem:** The Supabase types file at `src/integrations/supabase/types.ts` is ~106K lines and is auto-generated. This creates slow TypeScript compilation and IDE performance issues.

**Files:** 
- `src/integrations/supabase/types.ts`

**Cause:** Auto-generated types from full database schema (all tables, views, functions)

**Improvement path:**
1. Use Supabase's `--schema` option to generate types for only required schemas
2. Consider using a smaller subset of types for common operations
3. Optimize TypeScript config for large type files
4. Consider schema versioning to avoid full regeneration

---

### Dense Meal Generation Logic

**Problem:** The `meal-plan-generator.ts` file (87 lines) and `useSmartRecommendations.ts` (292 lines) contain complex business logic that may block the main thread.

**Files:** 
- `src/lib/meal-plan-generator.ts`
- `src/hooks/useSmartRecommendations.ts`

**Cause:** JavaScript-based meal planning with no async separation

**Improvement path:**
1. Move heavy calculations to Web Workers
2. Consider moving meal planning to a Supabase Edge Function
3. Cache generated recommendations per user profile

---

### Missing Database Indexes for Fleet Tables

**Problem:** Fleet management features (drivers, vehicles, payouts) may have slow queries without proper indexes.

**Files:** 
- `src/fleet/services/fleetApi.ts`

**Cause:** Migration files don't consistently add indexes for search fields

**Improvement path:**
1. Review common query patterns in fleet API
2. Add indexes for: `city_id`, `status`, `is_online`, `created_at`
3. Add composite indexes for common filter combinations
4. Use `EXPLAIN ANALYZE` to verify index usage

---

## Fragile Areas

### Migration Order Dependencies

**Why fragile:** The database migrations have complex dependencies. Several migrations start with "fix" in their name, indicating they were created to fix issues from previous migrations.

**Files:** 
- `supabase/migrations/20260221000001_fix_subscriptions_columns.sql`
- `supabase/migrations/20260221000002_fix_restaurants_columns.sql`
- `supabase/migrations/20260221000003_fix_meals_and_preferences.sql`
- `supabase/migrations/20260222150000_create_user_top_meals.sql`
- `supabase/migrations/20260223000000_create_streak_calculation.sql`

**Safe modification:** 
1. Never modify existing migrations - create new ones
2. Test migrations on fresh database clone
3. Document migration dependencies in comments
4. Use `supabase db diff` to verify expected schema

---

### Order Status Transition Logic

**Why fragile:** The order workflow has complex status transitions defined across multiple migrations. Relying on CHECK constraints and trigger functions for valid transitions.

**Files:** 
- `supabase/migrations/20260222160000_order_workflow_improvements.sql`
- `supabase/migrations/20260222170000_test_order_workflow.sql`

**Safe modification:**
1. Test all status transitions before deployment
2. Add RLS policies to prevent unauthorized status changes
3. Add logging for status changes
4. Consider using finite state machine library for validation

---

### Subscription Credit System

**Why fragile:** The subscription credit system uses complex SQL functions to deduct credits and allocate them. The migration `20260225211302_financial_enforcement_functions.sql` contains multiple warning messages for errors (lines 172, 273, 444, 516, 576, 678).

**Files:** 
- `supabase/migrations/20260225211302_financial_enforcement_functions.sql`
- `supabase/migrations/20260225211304_add_atomic_meal_completion.sql`
- `supabase/migrations/20260225211305_add_atomic_wallet_payment.sql`

**Safe modification:**
1. Test credit deduction under concurrent access
2. Add monitoring for credit balance going negative
3. Implement audit log for all credit transactions
4. Consider adding credit balance verification job

---

### Payment Processing

**Why fragile:** Payment processing uses a combination of client-side simulation and server-side RPC calls. The `process_payment_atomic` RPC function must handle concurrent requests properly.

**Files:** 
- `src/pages/Checkout.tsx` (line 40)
- `supabase/migrations/20260225211305_add_atomic_wallet_payment.sql`

**Safe modification:**
1. Ensure atomic operations use database-level locking
2. Add idempotency keys for all payment operations
3. Add comprehensive logging for payment debugging
4. Test payment failures and retries

---

## Scaling Limits

### Supabase Row Level Security Overhead

**Current capacity:** RLS policies add query overhead. With 20+ tables and multiple policy types, queries may slow as data scales.

**Limit:** Supabase RLS performance degrades with:
- Complex policies with multiple conditions
- Tables with >1M rows
- Frequent concurrent writes

**Scaling path:**
1. Simplify RLS policies where possible
2. Use database roles for coarse-grained access control
3. Consider denormalization for high-read tables
4. Add Redis caching for frequently accessed data

---

### Fleet Real-time Tracking

**Current capacity:** The websocket server (`websocket-server/src/server.ts`) supports up to 10,000 connections (`WS_MAX_CONNECTIONS`). GPS updates every 5-10 seconds per driver.

**Limit:** 
- 10,000 concurrent connections
- Redis cache TTL of 5 minutes for locations
- No persistent message queue for offline drivers

**Scaling path:**
1. Implement message batching for drivers that are offline
2. Add Redis Cluster for horizontal scaling
3. Consider switching to Supabase Realtime for smaller deployments
4. Implement offline-first tracking with local storage

---

## Dependencies at Risk

### React 18.3.1 with React Router 7.13.0

**Risk:** React Router v7 is new and may have breaking changes. Combined with React 18.3, there could be compatibility issues.

**Impact:** Updating may require extensive refactoring of routing logic

**Migration plan:**
1. Monitor React Router release notes
2. Test upgrades in a feature branch
3. Use `react-router@7` features cautiously
4. Consider staying on React Router DOM v6 until v7 stabilizes

---

### Supabase JS Client 2.89.0

**Risk:** Supabase updates may include breaking changes in RLS or API.

**Impact:** Database queries May break on client upgrade

**Migration plan:**
1. Lock Supabase types to specific version
2. Test with `supabase gen types` after client updates
3. Use TypeScript strict mode to catch breaking changes
4. Maintain a test suite for Supabase integrations

---

## Missing Critical Features

### Fleet Real-time GPS not Implemented

**Problem:** The Fleet Management system has `driver_locations` table and location tracking infrastructure, but the actual real-time GPS updates are not implemented in the mobile app.

**Files:** 
- `src/fleet/hooks/useLiveTracking.ts`
- `src/fleet/services/trackingSocket.ts`
- Mobile app doesn't send GPS updates

**Blocks:** Fleet managers cannot track driver locations in real-time

**Priority:** High

---

### API Rate Limiting Not Implemented

**Problem:** No rate limiting on Supabase Edge Functions or client API endpoints.

**Files:** 
- All Edge Functions have TODO for rate limiting
- No global rate limiter in frontend

**Blocks:** Vulnerable to abuse and DDoS attacks

**Priority:** High

---

## Test Coverage Gaps

### Security Tests Not Implemented

**What's not tested:** The E2E security tests in `e2e/system/security.spec.ts` contain TODO comments - they are not actually testing security features.

**Files:** 
- `e2e/system/security.spec.ts` (all 10 tests are placeholders)

**Risk:** Critical security features (RLS, XSS, SQL injection, brute force protection) are not verified

**Priority:** Critical

**Fix approach:**
1. Implement actual RLS tests using different user sessions
2. Test XSS prevention by attempting to inject malicious scripts
3. Test brute force protection by trying multiple failed logins
4. Test SQL injection with special characters in inputs

---

### Payment Simulation Tests Missing Edge Cases

**What's not tested:** The payment simulation doesn't have comprehensive tests for:
- Concurrent payments for same order
- Payment timeout scenarios
- 3D Secure cancellation flows
- Payment retry with different card

**Files:** 
- `src/lib/payment-simulation.ts`
- No dedicated test file

**Risk:** Payment bugs may only surface in production

**Priority:** High

---

### Integration Test: Meal Plan Generation Failures

**What's not tested:** Meal plan generation failures are not properly tested - only success path.

**Files:** 
- `src/lib/meal-plan-generator.ts`
- `src/hooks/useSmartRecommendations.ts`

**Risk:** Failed meal generation may crash app or show blank screen

**Priority:** Medium

---

### Missing Integration: Fleet-Payout Coordination

**What's not tested:** The integration between driver payouts and actual bank transfers is not tested end-to-end.

**Files:** 
- `src/fleet/services/fleetApi.ts`
- `supabase/functions/fleet-payouts/index.ts`

**Risk:** Payouts may be processed incorrectly

**Priority:** Medium

---

*Concerns audit: 2026-03-06*
