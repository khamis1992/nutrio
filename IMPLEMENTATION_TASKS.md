# Nutrio Fuel - Implementation Task List
## Pending Tasks & Implementation Roadmap

**Last Updated:** February 26, 2026  
**Status:** Post-Audit Implementation Phase  
**Project:** Nutrio Fuel Customer Application Ecosystem

---

## 📋 TASK LEGEND

**Priority:**
- 🔴 **P0** - Critical / Blocking
- 🟡 **P1** - High Priority
- 🟢 **P2** - Medium Priority
- ⚪ **P3** - Low Priority

**Status:**
- ⏳ Not Started
- 🔄 In Progress
- ✅ Completed
- ⏸️ On Hold

**Effort:**
- XS: < 2 hours
- S: 2-4 hours
- M: 4-8 hours
- L: 1-2 days
- XL: 2-5 days
- XXL: 1-2 weeks

---

## ✅ COMPLETED TASKS (Reference)

### Week 1: Critical System Fixes (COMPLETED)
- ✅ **SYS-001:** Atomic meal completion RPC function
- ✅ **SYS-002:** Atomic wallet payment RPC function  
- ✅ **SYS-003:** Driver assignment locking with advisory locks
- ✅ **SYS-004:** Schedule pagination indexes
- ✅ **SYS-005:** Batch query limits for meal reminders
- ✅ **SYS-006:** IP check failure handling improvements
- ✅ **SYS-007:** Sadad payment crypto fix for browser
- ✅ **MW-001:** Annual subscription billing (17% discount)
- ✅ **MW-002:** Win-back offers with 4-step cancellation flow
- ✅ **DB-MIGRATIONS:** All 5 critical migrations deployed to production

### Week 1: Frontend Integration (COMPLETED)
- ✅ **FE-001:** Update Schedule.tsx to use atomic meal completion
- ✅ **FE-002:** Update Checkout.tsx with atomic payment processing
- ✅ **FE-003:** Replace simulation banner with security badge
- ✅ **FE-004:** Create useMealCompletion hook
- ✅ **FE-005:** Create useSubscriptionManagement hook

---

## 🔴 P0 - CRITICAL TASKS (Immediate Action Required)

### Category: Frontend Integration Completion

**Task P0-001: Test Atomic Transaction Integration**
- **Status:** ⏳ Not Started
- **Effort:** M (4-8 hours)
- **Dependencies:** FE-001, FE-002 completed
- **Description:** 
  - Test meal completion under concurrent load
  - Test payment processing failure scenarios
  - Verify rollback behavior
  - Test with 100+ concurrent users
- **Acceptance Criteria:**
  - Zero race condition reports
  - 99.9% transaction success rate
  - Proper error messages displayed to users
- **Assignee:** Backend + Frontend Dev

**Task P0-002: Create CancellationFlow Component**
- **Status:** ⏳ Not Started
- **Effort:** L (1-2 days)
- **Dependencies:** MW-002 migration deployed
- **Description:**
  - Build 4-step cancellation modal
  - Step 1: Survey (reason collection)
  - Step 2: Pause offer display
  - Step 3: Discount offer display
  - Step 4: Downgrade or final cancellation
  - Integration with get_win_back_offers RPC
- **Acceptance Criteria:**
  - All 4 steps functional
  - Offer acceptance works correctly
  - Analytics tracking implemented
  - Mobile responsive
- **Assignee:** Frontend Developer

**Task P0-003: Update Subscription.tsx with Annual Toggle**
- **Status:** ⏳ Not Started
- **Effort:** M (4-8 hours)
- **Dependencies:** MW-001 migration deployed
- **Description:**
  - Add monthly/annual billing toggle
  - Show savings calculation (17% discount)
  - Display "2 months free" messaging
  - Update plan comparison cards
- **Acceptance Criteria:**
  - Toggle switches billing interval
  - Prices update dynamically
  - Savings clearly displayed
  - Mobile responsive
- **Assignee:** Frontend Developer

**Task P0-004: Implement MealLimitUpsellBanner**
- **Status:** ⏳ Not Started
- **Effort:** S (2-4 hours)
- **Dependencies:** useSubscription hook
- **Description:**
  - Create banner component for dashboard
  - Show when meals_used > 0.8 * meals_per_month
  - Display contextual upgrade prompt
  - Track impression → click → conversion
- **Acceptance Criteria:**
  - Banner shows at correct threshold
  - Click navigates to subscription page
  - Analytics events firing
- **Assignee:** Frontend Developer

---

### Category: Testing & Validation

**Task P0-005: Integration Testing Suite**
- **Status:** ⏳ Not Started
- **Effort:** XL (2-5 days)
- **Dependencies:** All P0 frontend tasks
- **Description:**
  - Test complete meal completion flow
  - Test payment success + wallet credit
  - Test payment failure + retry mechanism
  - Test cancellation flow with all offer types
  - Test annual subscription creation
  - Test prorated upgrades
- **Acceptance Criteria:**
  - 100% test coverage for new RPC functions
  - All edge cases handled
  - Performance tests passing (< 100ms response)
- **Assignee:** QA Engineer

**Task P0-006: Performance Benchmarking**
- **Status:** ⏳ Not Started
- **Effort:** M (4-8 hours)
- **Dependencies:** P0-001 completed
- **Description:**
  - Benchmark atomic transaction performance
  - Load test with 1000 concurrent users
  - Measure query response times
  - Identify bottlenecks
- **Acceptance Criteria:**
  - < 100ms for meal completion
  - < 200ms for payment processing
  - No N+1 queries detected
- **Assignee:** Backend Engineer

---

## 🟡 P1 - HIGH PRIORITY TASKS (Next 2-4 Weeks)

### Category: Competitive Parity

**Task P1-001: Apple HealthKit Integration**
- **Status:** ⏳ Not Started
- **Effort:** XL (2-5 days)
- **Dependencies:** None
- **Description:**
  - Research HealthKit API permissions
  - Create HealthKit service module
  - Implement nutrition data sync (meals → HealthKit)
  - Implement workout data sync (HealthKit → app)
  - Add permission request flow
  - Create health integration settings page
- **Acceptance Criteria:**
  - Users can authorize HealthKit access
  - Meals automatically sync to HealthKit
  - Workout data imports correctly
  - Background sync working
- **Assignee:** Mobile Developer (iOS)
- **Business Impact:** Critical competitive feature

**Task P1-002: Google Fit Integration**
- **Status:** ⏳ Not Started
- **Effort:** XL (2-5 days)
- **Dependencies:** None
- **Description:**
  - Implement Google Fit API integration
  - OAuth flow for Google account
  - Bidirectional data sync
  - Background sync service
- **Acceptance Criteria:**
  - Android users can connect Google Fit
  - Data syncs in both directions
  - Handles offline scenarios
- **Assignee:** Mobile Developer (Android)
- **Business Impact:** Critical competitive feature

**Task P1-003: Barcode Scanning for Meal Logging**
- **Status:** ⏳ Not Started
- **Effort:** L (1-2 days)
- **Dependencies:** None
- **Description:**
  - Add barcode scanner component
  - Integrate with nutrition database API
  - Auto-fill meal nutrition from barcode
  - Fallback to manual entry
- **Acceptance Criteria:**
  - Camera permission handling
  - Accurate nutrition lookup
  - Smooth UX flow
- **Assignee:** Frontend Developer
- **Business Impact:** High - table stakes feature

**Task P1-004: Meal Reviews & Ratings System**
- **Status:** ⏳ Not Started
- **Effort:** L (1-2 days)
- **Dependencies:** None
- **Description:**
  - Create meal_reviews table (if not exists)
  - Build review form component
  - Display reviews on meal detail page
  - Aggregate rating display
  - Photo upload for reviews
- **Acceptance Criteria:**
  - Users can submit 1-5 star ratings
  - Text reviews supported
  - Photos optional
  - Reviews display correctly
- **Assignee:** Full Stack Developer
- **Business Impact:** Social proof, quality control

---

### Category: UX Improvements

**Task P1-005: Consolidate Toast Systems**
- **Status:** ⏳ Not Started
- **Effort:** M (4-8 hours)
- **Dependencies:** None
- **Description:**
  - Remove Radix Toaster
  - Standardize on Sonner
  - Update all toast calls
  - Ensure consistent styling
- **Acceptance Criteria:**
  - Only Sonner toasts appear
  - All existing functionality preserved
  - No console errors
- **Assignee:** Frontend Developer

**Task P1-006: Remove Deprecated Components**
- **Status:** ⏳ Not Started
- **Effort:** S (2-4 hours)
- **Dependencies:** None
- **Description:**
  - Delete ProgressRedesigned.tsx
  - Consolidate features into Progress.tsx
  - Update route definitions
  - Add redirects
- **Acceptance Criteria:**
  - No deprecated files in codebase
  - All routes functional
  - No breaking changes
- **Assignee:** Frontend Developer

**Task P1-007: Accessibility Improvements**
- **Status:** ⏳ Not Started
- **Effort:** L (1-2 days)
- **Dependencies:** None
- **Description:**
  - Fix amber background contrast issues
  - Increase touch targets to 44px minimum
  - Add aria-labels to icon buttons
  - Fix heading hierarchy
- **Acceptance Criteria:**
  - WCAG 2.1 AA compliance
  - Screen reader compatible
  - Keyboard navigable
- **Assignee:** Frontend Developer
- **Business Impact:** Legal compliance, inclusivity

**Task P1-008: One-Tap Reorder Feature**
- **Status:** ⏳ Not Started
- **Effort:** M (4-8 hours)
- **Dependencies:** None
- **Description:**
  - Add "Order Again" button to order history
  - Clone previous order to cart
  - Allow modification before checkout
  - Track reorder analytics
- **Acceptance Criteria:**
  - One-click reorder works
  - Cart pre-filled correctly
  - Analytics tracking
- **Assignee:** Frontend Developer
- **Business Impact:** High - retention driver

---

### Category: AI Improvements

**Task P1-009: Add "Why This Meal?" AI Explanations**
- **Status:** ⏳ Not Started
- **Effort:** M (4-8 hours)
- **Dependencies:** None
- **Description:**
  - Add tooltip explanations to AI recommendations
  - Show match score breakdown
  - Explain nutrition alignment
  - Build trust through transparency
- **Acceptance Criteria:**
  - Explanations visible on hover/tap
  - Clear, concise messaging
  - Multiple language support
- **Assignee:** Frontend Developer

**Task P1-010: Implement Skip Reason Collection**
- **Status:** ⏳ Not Started
- **Effort:** S (2-4 hours)
- **Dependencies:** None
- **Description:**
  - Add skip reason modal
  - Options: "Not hungry", "Eating out", "Don't like", "Other"
  - Store reasons for AI training
  - Use to improve recommendations
- **Acceptance Criteria:**
  - Modal appears when skipping
  - Reasons stored in database
  - Optional (not blocking)
- **Assignee:** Full Stack Developer

---

## 🟢 P2 - MEDIUM PRIORITY TASKS (Next 1-3 Months)

### Category: Community & Social

**Task P2-001: Activate Community Challenges**
- **Status:** ⏳ Not Started
- **Effort:** XL (2-5 days)
- **Dependencies:** Database tables exist
- **Description:**
  - Build Challenges page
  - Create challenge cards
  - Implement join/leave functionality
  - Progress tracking
  - Leaderboard display
- **Acceptance Criteria:**
  - Users can browse challenges
  - Join/leave works
  - Progress updates correctly
  - XP/credits awarded on completion
- **Assignee:** Full Stack Developer
- **Business Impact:** Engagement, retention

**Task P2-002: Social Sharing of Progress**
- **Status:** ⏳ Not Started
- **Effort:** M (4-8 hours)
- **Dependencies:** None
- **Description:**
  - Add share button to progress page
  - Generate shareable images/cards
  - Support Instagram, Twitter, WhatsApp
  - Track viral growth
- **Acceptance Criteria:**
  - Clean sharing interface
  - High-quality generated images
  - Analytics tracking
- **Assignee:** Frontend Developer

---

### Category: Monetization

**Task P2-003: Checkout Add-ons Implementation**
- **Status:** ⏳ Not Started
- **Effort:** L (1-2 days)
- **Dependencies:** None
- **Description:**
  - Build AddOnSelector component
  - Display desserts, protein boosts
  - One-click add to order
  - Smart suggestions based on meal
- **Acceptance Criteria:**
  - Add-ons display correctly
  - Pricing accurate
  - Smooth checkout flow
  - +12% AOV target
- **Assignee:** Frontend Developer
- **Business Impact:** +12% AOV

**Task P2-004: Smart Reorder Suggestions**
- **Status:** ⏳ Not Started
- **Effort:** L (1-2 days)
- **Dependencies:** P1-008
- **Description:**
  - AI-powered reorder prompts
  - "Time to reorder your favorites?"
  - Based on consumption patterns
  - Push notification integration
- **Acceptance Criteria:**
  - Suggestions appear at right time
  - High conversion rate
  - Not annoying to users
- **Assignee:** Full Stack Developer

**Task P2-005: Corporate/B2B Portal (MVP)**
- **Status:** ⏳ Not Started
- **Effort:** XXL (1-2 weeks)
- **Dependencies:** None
- **Description:**
  - Build corporate account registration
  - Employee management interface
  - Bulk subscription management
  - Usage reporting dashboard
  - Invoice generation
- **Acceptance Criteria:**
  - Companies can register
  - Add/remove employees
  - View usage reports
  - Automated billing
- **Assignee:** Full Stack Team
- **Business Impact:** +25% revenue opportunity

---

### Category: AI Enhancement

**Task P2-006: Collaborative Filtering Recommendations**
- **Status:** ⏳ Not Started
- **Effort:** XL (2-5 days)
- **Dependencies:** P1-004 (reviews for training data)
- **Description:**
  - Build user-meal interaction matrix
  - Implement matrix factorization
  - "Users like you enjoyed..." feature
  - A/B test against current algorithm
- **Acceptance Criteria:**
  - Recommendations improve CTR
  - Model accuracy > 70%
  - Performance < 300ms
- **Assignee:** ML Engineer
- **Business Impact:** Personalization

**Task P2-007: NLP Text-Based Meal Logging**
- **Status:** ⏳ Not Started
- **Effort:** XL (2-5 days)
- **Dependencies:** None
- **Description:**
  - Natural language input: "I had grilled chicken salad"
  - Entity extraction for food items
  - Nutrition database lookup
  - Confidence scoring
- **Acceptance Criteria:**
  - 80%+ accuracy on common foods
  - Fast response time
  - Fallback to manual entry
- **Assignee:** ML Engineer
- **Business Impact:** UX improvement

---

## ⚪ P3 - LOW PRIORITY / FUTURE TASKS (3-6 Months)

### Category: Advanced Features

**Task P3-001: Voice Ordering**
- **Status:** ⏳ Not Started
- **Effort:** XL (2-5 days)
- **Dependencies:** None
- **Description:**
  - Speech-to-text integration
  - Intent classification
  - Voice-driven meal ordering
  - Accessibility benefit
- **Business Impact:** Low - novelty feature

**Task P3-002: Predictive Churn Model (True ML)**
- **Status:** ⏳ Not Started
- **Effort:** XXL (1-2 weeks)
- **Dependencies:** Historical data
- **Description:**
  - Train XGBoost model on churned users
  - Behavioral feature engineering
  - Risk scoring API
  - Automated intervention triggers
- **Business Impact:** High - proactive retention

**Task P3-003: Dynamic Pricing Engine**
- **Status:** ⏳ Not Started
- **Effort:** XXL (1-2 weeks)
- **Dependencies:** None
- **Description:**
  - Demand-based pricing
  - User segment pricing
  - A/B testing framework
  - Revenue optimization
- **Business Impact:** High - revenue optimization

**Task P3-004: Metabolic Adaptation Modeling**
- **Status:** ⏳ Not Started
- **Effort:** XXL (1-2 weeks)
- **Dependencies:** P1-001, P1-002 (wearable data)
- **Description:**
  - Bayesian optimization per user
  - Individual metabolism learning
  - Personalized calorie adjustments
  - Science-based nutrition
- **Business Impact:** Very High - true AI differentiation

**Task P3-005: Conversational AI Nutrition Coach**
- **Status:** ⏳ Not Started
- **Effort:** XXL (1-2 weeks)
- **Dependencies:** GPT-4 API access
- **Description:**
  - Chat interface for nutrition advice
  - Context-aware using user data
  - Proactive guidance
  - 24/7 availability
- **Business Impact:** Very High - no competitor has this

---

### Category: Technical Debt

**Task P3-006: Implement Job Queue for Batch Operations**
- **Status:** ⏳ Not Started
- **Effort:** XL (2-5 days)
- **Dependencies:** None
- **Description:**
  - Add Redis/Bull queue
  - Migrate batch jobs to queue
  - Retry logic
  - Monitoring dashboard
- **Business Impact:** Scale preparation

**Task P3-007: Implement Caching Layer**
- **Status:** ⏳ Not Started
- **Effort:** L (1-2 days)
- **Dependencies:** None
- **Description:**
  - Redis caching for frequent queries
  - Cache restaurant data
  - Cache meal details
  - Cache user preferences
- **Business Impact:** Performance

**Task P3-008: Database Query Optimization**
- **Status:** ⏳ Not Started
- **Effort:** L (1-2 days)
- **Dependencies:** None
- **Description:**
  - Audit slow queries
  - Add missing indexes
  - Optimize N+1 patterns
  - Materialized views for analytics
- **Business Impact:** Scale preparation

---

## 📊 IMPLEMENTATION TIMELINE

### Week 1 (Current): Critical Fixes
- ✅ Migrations deployed
- ✅ Basic frontend integration
- ⏳ **P0-001:** Testing & validation
- ⏳ **P0-002:** CancellationFlow component

### Week 2: Frontend Completion
- ⏳ **P0-003:** Annual billing toggle
- ⏳ **P0-004:** Meal limit upsell banner
- ⏳ **P1-005:** Toast consolidation
- ⏳ **P1-006:** Remove deprecated components

### Week 3-4: Competitive Parity Sprint
- ⏳ **P1-001:** Apple HealthKit
- ⏳ **P1-002:** Google Fit
- ⏳ **P1-003:** Barcode scanning
- ⏳ **P1-004:** Meal reviews

### Month 2: UX & Engagement
- ⏳ **P1-007:** Accessibility improvements
- ⏳ **P1-008:** One-tap reorder
- ⏳ **P2-001:** Community challenges
- ⏳ **P2-003:** Checkout add-ons

### Month 3: AI Enhancement
- ⏳ **P1-009:** AI explanations
- ⏳ **P1-010:** Skip reason collection
- ⏳ **P2-006:** Collaborative filtering
- ⏳ **P2-007:** NLP meal logging

### Month 4-6: Advanced Features
- ⏳ **P2-005:** B2B portal MVP
- ⏳ **P3-002:** Predictive churn model
- ⏳ **P3-004:** Metabolic modeling
- ⏳ **P3-005:** AI nutrition coach

---

## 🎯 SPRINT PLANNING RECOMMENDATIONS

### Sprint 1 (Week 1-2): Stability & Testing
**Focus:** Ensure atomic transaction layer is production-ready
**Tasks:** P0-001, P0-002, P0-003, P0-005
**Team:** 1 Backend, 2 Frontend, 1 QA
**Goal:** Zero critical bugs, 99.9% uptime

### Sprint 2 (Week 3-4): Competitive Parity
**Focus:** Wearable integration and core features
**Tasks:** P1-001, P1-002, P1-003, P1-004
**Team:** 2 Mobile, 1 Backend, 1 Frontend
**Goal:** Feature parity with MyFitnessPal

### Sprint 3 (Month 2): Engagement
**Focus:** UX improvements and community features
**Tasks:** P1-007, P1-008, P2-001, P2-003
**Team:** 2 Frontend, 1 Backend, 1 Designer
**Goal:** -25% drop-off, +15% engagement

### Sprint 4 (Month 3): AI Foundation
**Focus:** Data collection and ML preparation
**Tasks:** P1-009, P1-010, P2-006, P2-007
**Team:** 1 ML Engineer, 2 Full Stack
**Goal:** AI training data pipeline

---

## 📈 SUCCESS METRICS BY PHASE

### Phase 1: Stability (Week 1-2)
- [ ] 99.9% transaction success rate
- [ ] < 100ms API response times
- [ ] Zero race condition reports
- [ ] 100% test coverage on new RPCs

### Phase 2: Competitive Parity (Week 3-6)
- [ ] 40% user wearable integration adoption
- [ ] 30% barcode scanning usage
- [ ] 25% meal review submission rate
- [ ] Feature parity score: 90% vs. MyFitnessPal

### Phase 3: Engagement (Month 2)
- [ ] 25% drop-off reduction
- [ ] 15% DAU/MAU increase
- [ ] 20% community challenge participation
- [ ] 12% AOV increase from add-ons

### Phase 4: AI Transformation (Month 3-6)
- [ ] AI Maturity Level 3 (Reactive ML)
- [ ] 25% AI Coach weekly active usage
- [ ] 3 B2B pilot customers
- [ ] Predictive churn model accuracy > 80%

---

## 🚨 RISK MITIGATION

| Risk | Mitigation | Owner |
|------|-----------|-------|
| HealthKit integration complexity | Start with basic nutrition sync only | Mobile Lead |
| AI model accuracy concerns | A/B test with rule-based fallback | ML Lead |
| B2B sales cycle length | Pilot with 3 existing customers | Product Manager |
| Scale bottlenecks | Implement monitoring early | Backend Lead |
| Team capacity constraints | Prioritize P0/P1, defer P2/P3 | Engineering Manager |

---

## 📞 TASK ASSIGNMENT TRACKER

| Task ID | Description | Assignee | Start Date | Due Date | Status |
|---------|-------------|----------|------------|----------|--------|
| P0-001 | Test Atomic Transactions | TBD | - | - | ⏳ |
| P0-002 | CancellationFlow Component | TBD | - | - | ⏳ |
| P0-003 | Annual Billing Toggle | TBD | - | - | ⏳ |
| P0-004 | Meal Limit Upsell Banner | TBD | - | - | ⏳ |
| P1-001 | Apple HealthKit | TBD | - | - | ⏳ |
| P1-002 | Google Fit | TBD | - | - | ⏳ |
| P1-003 | Barcode Scanning | TBD | - | - | ⏳ |
| P1-004 | Meal Reviews | TBD | - | - | ⏳ |

---

**Next Action:** Assign owners to P0 tasks and begin Sprint 1 planning

**Document Owner:** Product Management  
**Review Cycle:** Weekly during implementation  
**Last Updated:** February 26, 2026
