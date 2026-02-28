# Production Hardening Implementation Report
## Nutrio Fuel Partner Portal

**Date:** February 27, 2026  
**Status:** In Progress  
**Priority:** CRITICAL

---

## EXECUTIVE RISK ASSESSMENT

### Current Security Posture: **65/100** (CONDITIONAL RELEASE)

### Critical Vulnerabilities Identified:

| Risk | Severity | Impact | Status |
|------|----------|--------|--------|
| Unauthenticated AI Analysis Endpoint | 🔴 CRITICAL | Cost abuse, data exposure | **PENDING** |
| No Role-Based Access Control | 🔴 HIGH | Privilege escalation | **PENDING** |
| Missing Rate Limiting | 🔴 HIGH | Brute force, DoS | **PENDING** |
| No Session Timeout | 🟡 MEDIUM | Stale session persistence | **PENDING** |
| Incomplete Approval Workflow | 🟡 MEDIUM | Spam registrations | **PARTIAL** |

---

## PHASE 1: SECURITY HARDENING

### TASK 1: Secure analyze-meal-image Edge Function

#### Impact Analysis:

**Affected Components:**
- `supabase/functions/analyze-meal-image/index.ts` (direct)
- `src/pages/partner/PartnerMenu.tsx:312` (caller)
- `src/components/LogMealDialog.tsx:328` (caller)
- 2 UI components depend on this function

**Dependencies:**
- Supabase client with JWT tokens
- Authorization header validation
- User role verification (optional enhancement)

**Side Effects:**
- Existing calls without auth headers will fail (breaking change)
- Need to update frontend to pass Authorization header
- Need error handling for 401 responses

**Failure Scenarios:**
1. Valid token → Success
2. Expired token → 401 Unauthorized
3. Missing header → 401 Unauthorized
4. Forged token → 401 Unauthorized (JWT validation fails)
5. Valid token but non-partner user → Should we restrict? (Decision: Allow for now, audit later)

#### Implementation Plan:

**Backend Changes (Edge Function):**
1. Extract and validate Authorization header
2. Verify JWT with Supabase
3. Return 401 for invalid/missing tokens
4. Add audit logging for failed attempts

**Frontend Changes:**
1. Pass Authorization header in function.invoke()
2. Handle 401 errors gracefully
3. Show auth error toast

#### Schema Compatibility:
- No DB schema changes required
- Uses existing Supabase auth system
- Compatible with current JWT structure

---

### TASK 2: Role-Based ProtectedRoute

#### Impact Analysis:

**Affected Components:**
- `src/components/ProtectedRoute.tsx` (direct modification)
- `src/App.tsx` (all routes using ProtectedRoute)
- `src/contexts/AuthContext.tsx` (role data source)
- `src/components/PartnerLayout.tsx` (overlapping role check)

**Dependencies:**
- user_roles table exists in DB
- Restaurants ownership verification
- JWT custom claims (optional enhancement)

**Side Effects:**
- All routes must specify required role
- PartnerLayout role check becomes redundant
- Need to handle role fetch loading state

**Architecture Decision:**
Two approaches considered:

**Option A: DB Role Check (Current Pattern)**
- Query user_roles table on route access
- Pros: Always current, no JWT bloat
- Cons: Extra DB query per route change

**Option B: JWT Custom Claims**
- Embed role in JWT via Supabase trigger
- Pros: No extra queries, faster validation
- Cons: Role changes require re-login

**Decision:** Use Option A for flexibility, with caching

#### Implementation Plan:

1. Add role prop to ProtectedRoute
2. Query user_roles on mount
3. Redirect if role mismatch
4. Cache role in AuthContext to prevent repeated queries

---

### TASK 3: Rate Limiting

#### Implementation Layer Decision:

**Option A: Supabase Auth Rate Limiting**
- Built-in, but applies to all auth endpoints
- Limited customization
- Hard to tune per-endpoint

**Option B: Edge Function Middleware**
- Custom logic per function
- Redis/memory store for counters
- More flexible

**Option C: Database Rate Limit Table**
- Simple, no external deps
- Slight latency increase
- Good audit trail

**Decision:** Option C for simplicity + auditability

**Rate Limit Spec:**
- 5 attempts per 15 minutes per IP + user
- Track failed auth attempts
- Lockout after threshold
- Reset on successful login

---

### TASK 4: Session Timeout (30 min idle)

#### Impact Analysis:

**User Experience Considerations:**
- Must detect user activity (mouse, keyboard, touch)
- Must not logout during active form submission
- Must sync across tabs
- Must allow "Stay logged in" option

**Implementation Strategy:**
1. Idle detection hook
2. Warning modal at 25 min
3. Auto-logout at 30 min
4. Activity tracking

**Edge Cases:**
- Multi-tab: Use BroadcastChannel
- Mobile: Touch events
- File upload: Disable timeout during upload
- Long API calls: Extend timeout during pending requests

---

### TASK 5: Restaurant Approval Workflow

#### Current State Analysis:

**Already Implemented:**
✅ approval_status enum exists (pending, approved, rejected)
✅ Field exists in restaurants table
✅ Some RLS policies check approval_status
✅ Admin UI exists for approval management

**Gaps Identified:**
❌ Partner portal doesn't check approval_status on login
❌ No "Pending Approval" UI state
❌ New registrations default to approved (risk!)
❌ No email notification on approval/rejection

**Fix Required:**
1. Update PartnerAuth to check approval_status
2. Create PendingApproval page
3. Default new registrations to 'pending'
4. Add approval notification edge function

---

## PHASE 2: DATA & COMPLIANCE

### GDPR Export Implementation

**Tables to Export:**
1. auth.users (core identity)
2. profiles (PII)
3. restaurants (if owner)
4. meals (if restaurant owner)
5. orders (customer data)
6. addresses
7. meal_schedules
8. partner_payouts
9. partner_earnings
10. audit_logs (user activity)

**Export Format:** JSON with relational structure

**Access Control:**
- User can export own data only
- Admin can export any user's data
- Rate limit: 1 export per 24 hours

---

### Audit Logging Enhancement

**Current State:**
- audit_logs table exists
- Triggers on some tables
- Gaps exist

**Required Coverage:**
- All INSERT/UPDATE/DELETE on user data
- Failed auth attempts
- API access
- Role changes

**Schema Check:**
- Verify audit_logs table structure
- Ensure immutable (no UPDATE/DELETE)
- Add retention policy (90 days)

---

## PHASE 3: PRODUCTION HARDENING

### Error Boundaries

**Implementation:**
1. Global error boundary in App.tsx
2. Partner-specific error boundary
3. Sentry integration verification

### Webhook Retry Logic

**Schema:**
- failed_webhooks table
- retry_count, next_retry_at, error_message
- Exponential backoff: 1min, 5min, 15min, 1hr, 4hr, 12hr

### Capacity Management

**Already Exists:**
- restaurants.max_meals_per_day field present

**Gap:**
- Not enforced in order flow
- No availability calendar UI

---

## PHASE 4: MONITORING

### Uptime Monitoring

**Targets:**
- 99.9% uptime (8.76 hours downtime/year)
- 5-minute check interval
- Alert on 2 consecutive failures

### Performance Monitoring

**Metrics:**
- Core Web Vitals (LCP, FID, CLS)
- API response times (p50, p95, p99)
- Database query performance
- Edge Function cold starts

---

## REGRESSION RISK ANALYSIS

### High Risk Changes:
1. **analyze-meal-image auth** - Will break existing calls
2. **ProtectedRoute role check** - May block legitimate users
3. **Session timeout** - May frustrate users

### Mitigation:
- Feature flags for gradual rollout
- Comprehensive testing
- Rollback plan
- Monitoring dashboards

---

## PRODUCTION READINESS SCORE PROJECTION

| Phase | Current | Post-Implementation | Target |
|-------|---------|---------------------|--------|
| Security | 65 | 85 | 90 |
| Architecture | 75 | 80 | 85 |
| Business Logic | 70 | 85 | 90 |
| API & Integration | 60 | 80 | 85 |
| Testing & QA | 55 | 75 | 85 |
| DevOps & Monitoring | 50 | 75 | 80 |
| **TOTAL** | **64** | **80** | **86** |

**Projected Final Score: 80/100** (PRODUCTION READY)

---

## IMPLEMENTATION STATUS

- [ ] Task 1: analyze-meal-image security
- [ ] Task 2: Role-based ProtectedRoute
- [ ] Task 3: Rate limiting
- [ ] Task 4: Session timeout
- [ ] Task 5: Approval workflow completion
- [ ] Phase 2: GDPR & Audit
- [ ] Phase 3: Error boundaries & retry logic
- [ ] Phase 4: Monitoring setup

---

## GO-LIVE RECOMMENDATION

**Current:** ❌ NO - Critical security gaps

**Post Phase 1:** ⚠️ CONDITIONAL - With monitoring

**Post All Phases:** ✅ YES - Production ready

