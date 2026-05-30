# ASI-Evolve Analysis: Nutrio Fuel Customer App

> **Methodology**: Applied GAIR-NLP/ASI-Evolve closed-loop framework (LEARN → DESIGN → EXPERIMENT → ANALYZE) to the Nutrio Fuel customer app.

---

## 1. Methodology: What ASI-Evolve Does

ASI-Evolve is an autonomous AI research framework with a closed loop:

```
LEARN (cognition store) → DESIGN (researcher agent) → EXPERIMENT (engineer agent) → ANALYZE (analyzer agent) → repeat
```

- **3 Agents**: Researcher (proposes candidates), Engineer (runs experiments), Analyzer (distills lessons)
- **2 Memory Systems**: Cognition Store (domain knowledge), Experiment Database (trial history + UCB1 parent selection)
- **Proven Results**: +3.96 pts on MMLU, +0.97 over DeltaNet, +12.5 on AMC32 vs GRPO

We applied the same logic to Nutrio: prime with domain knowledge → analyze current state → identify testable hypotheses → propose experiments.

---

## 2. Cognition Store: Domain Knowledge for Food Delivery + Nutrition Apps

### Mobile UX Principles

| Principle | Source | Implication for Nutrio |
|-----------|--------|----------------------|
| Every 100ms latency costs ~1% conversion | Amazon | Preload critical chunks, optimize LCP |
| 53% abandon if load >3s | Google | Dashboard + Meals must load under 2s |
| Bottom sheets > modals for filters | Baymard Institute | Current MealFilters sheet is correct pattern |
| Staggered animations improve perceived speed | NNGroup | Current framer-motion stagger on meal cards is correct |
| 44px touch targets reduce errors 22% | WCAG/MIT | Already enforced — preserve |

### Nutrition & Behavior Science

| Principle | Source | Implication for Nutrio |
|-----------|--------|----------------------|
| Tracking adherence drops >60% after week 1 | JMIR 2021 | Push notifications + streak UI critical week 1-2 |
| Habit formation takes 21-66 days | Lally et al. 2010 | Subscription retention should measure to day 66 |
| Social accountability +35% retention | Health Psychology | Community features (if used) are high-value |
| Taste personalization +40% meal satisfaction | Nutrients 2023 | TasteMatchBadge + RecommendedForYou are key differentiators |
| Choice paralysis above 6 items | Iyengar & Lepper | Meal listings should prioritize, not just list |

### Food Delivery Economics

| Principle | Value | Implication for Nutrio |
|-----------|-------|----------------------|
| Reorder rate is #1 retention metric | Industry data | OrderAgainRow + OneTapReorder are highest-ROI features |
| CAC $30-50 in food delivery | Industry data | Affiliate program economics must beat CAC |
| Subscription reduces churn 40% | Recurly 2024 | Subscription upsell timing needs optimization |
| Cart abandonment avg 70% | Baymard | Checkout flow is conversion bottleneck |

---

## 3. Experiment Database: What We Would Test

| # | Experiment | Variable | Primary Metric | Guardrail |
|---|-----------|----------|---------------|-----------|
| 1 | Dashboard widget order | DailyNutritionCard vs AdaptiveGoalCard top | Time-on-dashboard, goal completion | No increase in bounce |
| 2 | Conditional widget visibility | Show/hide by subscription tier | Widget CTR, scroll depth | No drop in premium conversion |
| 3 | Meal card format | Grid vs list vs carousel | Meal detail click rate | No drop in filter usage |
| 4 | Filter UX variants | Bottom sheet vs inline chips vs sidebar | Filter usage rate, meals/session | No increase in bounce |
| 5 | Reorder prompt placement | Dashboard card vs push vs meal page banner | Reorder conversion rate | No notification opt-out spike |
| 6 | Subscription upsell timing | After 3rd order vs after 1 week vs checkout | Subscription conversion | No checkout abandonment spike |
| 7 | Streak UI design | Simple counter vs XP bar vs leaderboard | Streak >7 days rate | No dashboard complexity complaint |
| 8 | Checkout flow | Current multi-step vs 1-page vs progress bar | Checkout completion rate | No support ticket spike |
| 9 | Meal recommendation strategy | Popular-first vs taste-match vs hybrid | Add-to-cart rate | No decrease in meal discovery |
| 10 | Push cadence | 1/day vs 2/day vs meal-time only | App opens/day, opt-out rate | Opt-out <5% |
| 11 | Cancellation flow | Basic confirm vs salvage offers vs exit survey | Saved subscriptions | No CSAT drop |
| 12 | Meal pre-fetch strategy | Prefetch on hover vs preload visible vs none | Meal detail TTNV (time-to-next-view) | No bandwidth complaint |

---

## 4. Analyzer: Current Architecture Assessment

### Strengths (Preserve)

| Pattern | Location | Value |
|---------|----------|-------|
| Universal lazy loading | All pages via `React.lazy()` | Minimal JS on first load |
| 5-min staleTime + no refetch-on-focus | `App.tsx` QueryClient config | Reduces Supabase calls dramatically |
| PostHog autocapture + session recording | `src/lib/analytics.ts` | Already captures raw experiment data |
| `visibilitychange` refetch pattern | Wallet/Subscription hooks | Critical data refreshes reliably |
| Supabase realtime channels | `useRealtimeTable.ts` | Real-time updates without polling |
| Platform-specific design tokens | `src/lib/designTokens.ts` | iOS HIG vs Material 3 adaptation |
| 44px touch targets + haptics | `accessibility.css` + Capacitor | WCAG AA + native feel |
| RTL support (English/Arabic) | `LanguageContext` + `[dir="rtl"]` CSS | Qatar market requirement |
| Per-widget error boundaries | `DashboardErrorBoundary` | One widget crash doesn't kill dashboard |

### Weaknesses (Fix)

#### 1. No Experimentation Infrastructure
**Severity**: Critical  
**Evidence**: Zero A/B testing framework. 4 simple boolean feature flags (`usePlatformSettings.ts`) with no variant assignment, no metrics integration, no statistical engine.

**Fix**: Enable PostHog Experiments (already paying for PostHog) or add a lightweight experimentation layer.

#### 2. Dashboard Widget Bloat
**Severity**: High  
**Evidence**: 14+ widgets render unconditionally regardless of subscription tier. Free-tier user sees VIPExclusivesCard, GamificationWidget, PremiumAnalytics. Each widget has its own data fetching, skeleton states, and animation overhead.

**Fix**: Tier-gate widgets. Measure interaction rate per widget to prune bottom performers.

#### 3. Inconsistent Data Fetching
**Severity**: Medium  
**Evidence**: Two competing patterns — manual `useState` + `useRealtimeTable` (wallet, subscription) vs TanStack Query `useQuery` (notifications, meals). Manual pattern duplicates TanStack Query features.

**Fix**: Standardize on TanStack Query. Use `queryClient.setQueryData()` for realtime updates instead of separate `useState`.

#### 4. Missing Engagement Telemetry
**Severity**: High  
**Evidence**: PostHog autocapture exists but no scroll depth, time-on-widget, rage-click, or funnel step drop-off tracking. Without this, experiments can't measure what matters.

**Fix**: Add scroll depth properties to `$pageview`, widget interaction events, and funnel tracking.

#### 5. Potential Feature Creep
**Severity**: Medium  
**Evidence**: ~83 hooks, ~55 UI primitives, components for CommunityChallengeCard, RecipeShareCard, BehaviorPredictionWidget, CoachChatBubble — some may have near-zero usage but all add bundle size and maintenance cost.

**Fix**: Measure usage of every feature. Kill features <5% engagement after 30 days.

#### 6. No Perceived Performance Optimization
**Severity**: Medium  
**Evidence**: No `<link rel="modulepreload">`, no resource hints, Capacitor init blocks, splash hides after 500ms before React hydrates.

**Fix**: Preload critical chunks, add preconnect hints, extend splash until hydration complete.

#### 7. Dead Cache Layer
**Severity**: Low  
**Evidence**: `src/lib/cache.ts` has Redis tier permanently stubbed (`isRedisAvailable = false`). Memory cache has no invalidation strategy tied to realtime events.

**Fix**: Wire up Redis or remove the layer. TanStack Query's built-in cache handles most use cases.

---

## 5. Improvement Plan

### Phase 1 — Instrumentation (Week 1)

**Goal**: Make the app measurable for all future experiments.

| Task | Details | Effort |
|------|---------|--------|
| Enable PostHog Experiments | Configure feature flags + experiments in PostHog dashboard, add `posthog.featureFlags` integration to `analytics.ts` | 2h |
| Add scroll depth tracking | Fire `$pageview` with `scrollDepth` property at 25%/50%/75%/100% thresholds | 1h |
| Add widget interaction events | `widget_view`, `widget_interact`, `widget_dismiss` for dashboard widgets | 2h |
| Add funnel tracking | `funnel: signup → onboarding_complete → first_order → subscription_start` | 1h |
| Add rage-click detection | `dead_click` event when user clicks same element >3 times in 2s | 1h |

### Phase 2 — Quick Wins (Week 2)

**Goal**: Low-effort, high-impact improvements.

| Task | Details | Effort |
|------|---------|--------|
| Tier-gate dashboard widgets | Hide VIPExclusivesCard, GamificationWidget, PremiumAnalytics from free/basic tiers | 1h |
| Preload critical chunks | Add `<link rel="modulepreload">` for `Dashboard`, `Meals`, `Auth` in `index.html` | 30m |
| Add preconnect hints | `<link rel="preconnect">` to Supabase API, PostHog API domains | 15m |
| Standardize data hooks | Migrate wallet + subscription hooks to TanStack Query with realtime `setQueryData` | 3h |
| Remove dead cache code | Remove `cache.ts` Redis stubs or implement proper Redis caching | 1h |
| Meal detail pre-fetching | `queryClient.prefetchQuery()` on meal card hover/focus | 1h |
| Extend splash screen | Wait for React hydration + first paint before hiding splash (not just 500ms) | 30m |

### Phase 3 — A/B Experiments (Weeks 3-4)

**Goal**: Run controlled experiments on highest-impact variables.

| Experiment | Variant A (control) | Variant B | Success Metric | Duration |
|------------|-------------------|-----------|----------------|----------|
| Widget ordering | DailyNutritionCard at top | AdaptiveGoalCard at top | Goal application rate | 1 week |
| Meal card layout | Current grid with macros | List view with larger images | Meal detail CTR | 1 week |
| Push notification cadence | Current (2/day default) | Meal-time only (3/day, no promo) | App opens, opt-out rate | 2 weeks |
| Checkout flow | Current multi-step | Simplified single-page | Completion rate | 1 week |
| Reorder placement | Dashboard card only | Dashboard + meal page banner | Reorder conversion | 1 week |
| Filter UI | Current bottom sheet | Inline chips (no sheet) | Filter usage, session depth | 1 week |

### Phase 4 — Advanced (Month 2)

| Task | Details | Effort |
|------|---------|--------|
| Personalized onboarding | Branch onboarding flow by goal (lose weight / gain muscle / maintain) with custom macro presets and meal recommendations | 1 week |
| ML meal ranking | Weighted scoring: `0.4 × taste_match + 0.3 × nutrition_alignment + 0.2 × popularity + 0.1 × diversity` replacing static sort | 1 week |
| Cancellation salvage experiment | A/B test: exit survey vs discount offer vs pause offer vs control | 2 weeks |
| Predictive preload | Preload user's most common next-page based on navigation patterns | 3 days |
| Redis caching (if needed) | Wire up Redis for meal/restaurant data if Supabase read load is high | 3 days |

---

## 6. Success Metrics Dashboard

| Category | Metric | Current | Target | How to Measure |
|----------|--------|---------|--------|----------------|
| **Performance** | Dashboard LCP | Unknown | <2.0s | PostHog Web Vitals |
| **Performance** | Meal card TTNV (click to render) | Unknown | <300ms | Custom PostHog event |
| **Engagement** | Dashboard scroll depth | Unknown | >75% scroll | PostHog scroll tracking |
| **Engagement** | Widget interaction rate | Unknown | >40% per widget | Custom PostHog events |
| **Conversion** | Checkout completion | Unknown | >80% | PostHog funnel |
| **Conversion** | Subscription conversion (free→paid) | Unknown | >5% of active users | PostHog funnel |
| **Retention** | Day 7 retention | Unknown | >60% | PostHog retention |
| **Retention** | Day 30 retention | Unknown | >40% | PostHog retention |
| **Retention** | Reorder rate | Unknown | >50% of orders are reorders | PostHog events |
| **Notification** | Push opt-out rate | Unknown | <5% | PostHog events |
| **Quality** | Error rate (Sentry) | Unknown | <0.1% of sessions | Sentry dashboard |
| **Quality** | Crash-free sessions | Unknown | >99.5% | Sentry dashboard |

---

## 7. Widget Audit — Measure or Kill

Each widget should meet one of: >5% of users interact with it, or it drives a measurable conversion event. Otherwise, remove it.

| Widget | Tier Required | Hypothesized Engagement | Action |
|--------|--------------|------------------------|--------|
| AdaptiveGoalCard | All | High | **Measure**, optimize placement |
| DailyNutritionCard | All | High | **Measure**, optimize layout |
| ActiveOrderBanner | All (when active) | Medium | **Keep**, critical UX |
| OrderAgainRow | All | High | **Measure**, optimize placement |
| StreakRecoveryBanner | All | Medium | **Measure**, A/B test design |
| GamificationWidget | Premium | Low | **Kill** or premium-gate only |
| VIPExclusivesCard | VIP only | Medium | **Keep** for VIP, hide for others |
| RolloverExpiryNudge | Premium | Medium | **Measure**, only above threshold |
| CommunityChallengeCard | All | Low | **Measure** for 30 days, kill if <5% |
| RecipeShareCard | All | Low | **Measure** for 30 days, kill if <5% |
| ReferralMilestonesWidget | Affiliate | Low | **Measure**, hide unless affiliate |
| BehaviorPredictionWidget | All | Low | **Measure** for 30 days, kill if <5% |
| CoachChatBubble (FAB) | All | Low | **Measure** for 30 days |
| LogMealDialog | All | Medium | **Keep**, integrate with tracker |

---

## 8. Architecture Recommendations

### Data Layer

```
Current:  useState + realtime (wallet/sub)  |  TanStack Query (notifications/meals)
                              ↓
Target:   TanStack Query unified
          ├── useQuery for initial fetch
          ├── queryClient.setQueryData() for realtime updates
          └── staleTime: 5min, realtime invalidates cache
```

### Experimentation Layer

```
Current:  4 boolean feature flags in platform_settings table
                              ↓
Target:   PostHog Experiments
          ├── Feature flags with targeting rules (user %, tier, geo)
          ├── A/B test variants with statistical significance
          ├── Automatic winning variant rollout
          └── Fallback: GrowthBook if PostHog experiments insufficient
```

### Dashboard Rendering

```
Current:  All 14 widgets render unconditionally
                              ↓
Target:   Tier-gated + engagement-gated
          ├── Free tier: 6 widgets (DailyNutritionCard, AdaptiveGoalCard,
          │               ActiveOrderBanner, OrderAgainRow, StreakRecoveryBanner,
          │               LogMealDialog FAB)
          ├── Premium: +3 (RolloverExpiryNudge, MealMealPlanGen, BehaviorPrediction)
          └── VIP: +2 (VIPExclusivesCard, PrioritySupport)
```

---

## 9. References

- ASI-Evolve: https://github.com/GAIR-NLP/ASI-Evolve
- ASI-Evolve Paper: https://arxiv.org/abs/2603.29640
- PostHog Experiments: https://posthog.com/docs/experiments
- Google Web Vitals: https://web.dev/vitals/
- Nutrio codebase: `src/` — all file paths referenced above are within this repo
