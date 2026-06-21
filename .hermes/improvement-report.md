# Customer Portal Improvement Report — Nutrio Fuel

**Date:** June 15, 2026  
**Reviewer:** Builder (Product Manager / UX Strategist / Engineer)  
**Scope:** Full customer portal product review

---

## 1. Current Strengths

| Area | Assessment |
|------|-----------|
| **Visual design** | Polished, professional. Custom SVG icons, framer-motion animations, ambient backgrounds, consistent emerald-green brand palette. Feels premium. |
| **Dashboard** | Exceptionally comprehensive. Weight tracking, macros, meal schedule, active orders, water/steps, gamification, streaks, AI recommendations — all on one screen. |
| **Auth flow** | Clean, multi-step with proper validation (zod), OTP verification, biometric support, password visibility toggle, forgot password. |
| **Mobile-first** | 430px max-width, keyboard-aware dock, touch-friendly targets, scroll-to-top on navigation. |
| **i18n foundation** | 3,257 keys synced between English and Arabic. RTL-aware arrow icons, tab bar, layout. |
| **Supabase backend** | 48 edge functions powering AI insights, payments, notifications, subscriptions, fleet operations. |
| **Feature depth** | Subscription management, wallet/Sadad payments, order tracking, support tickets, affiliate program, family plans, coach messaging, health/blood work, recovery partners, community. |
| **Component architecture** | shadcn/ui + Tailwind, consistent design tokens, reusable EmptyState/MenuRow/CardSection. |

## 2. Current Weaknesses

| # | Weakness | Severity | Detail |
|---|----------|----------|--------|
| W1 | **Profile hub missing navigation** | **Critical** | Order History, Invoice History, Settings had NO navigation links from the Profile hub — they were orphan pages reachable only by typing URLs |
| W2 | **Duplicate navigation** | High | "Payments" and "Offers & Coupons" both navigated to /wallet — confusing and non-functional |
| W3 | **Offers & Coupons has no page** | High | Menu item exists with i18n keys but no dedicated page existed — linked to wallet instead |
| W4 | **No per-page titles** | Medium | All pages share "Nutrio - Healthy Meal Delivery & Nutrition Tracking" — bad for tab identification, history, bookmarks |
| W5 | **Onboarding debug buttons visible** | Medium | "Go to onboarding page 1/2/3" buttons visible in production — looks unprofessional |
| W6 | **Privacy page has placeholder data** | Medium | "privacy@nutribox.com" and dummy address — needs real company info |
| W7 | **No document upload visibility** | Medium | Blood work upload exists at /health/blood-work but not surfaced in Profile or Dashboard |
| W8 | **Missing skeleton loaders on 3 pages** | Low | OrderHistory, Support, Notifications lack skeleton states |

## 3. Missing Features

| Feature | Backend Support | Priority | Notes |
|---------|----------------|----------|-------|
| Download invoice as PDF | ✅ `send-invoice-email` edge function exists | High | InvoiceHistory lists invoices but no visible download button for all entries |
| WhatsApp support button | ✅ `send-whatsapp-proxy`, `process-whatsapp-notifications` | Medium | WhatsApp integration exists in backend — not surface in UI |
| Customer statement of account | ❌ No endpoint | Future | Would need new edge function |
| Auto-renewal reminder notifications | ✅ `process-subscription-renewal` exists | Medium | Backend can send — need UI visibility for upcoming renewals |
| Contract/agreement view | ❌ Not in scope for meal delivery | N/A | Not applicable to Nutrio's business model |
| Vehicle/fleet tracking | ❌ Fleet portal handles this | N/A | Separate portal |

## 4. UX Problems (Identified & Fixed)

| Problem | Status |
|---------|--------|
| 20+ hardcoded English strings invisible to Arabic i18n | ✅ Fixed |
| Missing useLanguage imports causing runtime crashes | ✅ Fixed |
| 15 hardcoded aria-labels for screen readers | ✅ Fixed |
| Hardcoded form placeholders | ✅ Fixed |
| Hardcoded empty state text | ✅ Fixed |
| Profile hub missing 5 critical navigation links | ✅ Fixed |
| Duplicate Payments/Offers navigation | ✅ Fixed |

## 5. Workflow Problems

| Workflow | Problem | Resolution |
|----------|---------|------------|
| View order history | Not reachable from Profile hub | Added to Finance section |
| View invoices | Not reachable from Profile hub | Added to Finance section |
| Manage subscription | Only reachable from Dashboard widget | Added to Finance section |
| Change settings | Not reachable from Profile hub | Added to Support & Account section |
| View notifications | Only reachable from Dashboard bell | Added to Support & Account section |
| View offers/coupons | Link existed but no page | Replaced with functional navigation items |

## 6. Business Operation Improvements

| Opportunity | Impact | Status |
|------------|--------|--------|
| Self-service invoice viewing | Reduces "where's my invoice?" calls | ✅ Functional — now properly linked |
| Self-service order history | Reduces "what did I order?" calls | ✅ Functional — now properly linked |
| Subscription self-management | Reduces plan change/upgrade calls | ✅ Functional — now properly linked |
| Settings self-service | Reduces "how do I change X?" calls | ✅ Functional — now properly linked |
| WhatsApp support integration | Reduce support ticket friction | Backend ready — needs UI work |
| Upcoming payment alerts | Reduce missed payments | Backend ready — needs UI surface |

## 7. Recommended Improvements Summary

| Priority | Count | Description |
|----------|-------|-------------|
| **Critical** (before go-live) | 4 | All fixed: navigation gaps, duplicate links, hardcoded English |
| **High** (strongly recommended) | 5 | Per-page titles, debug button removal, real privacy contact, WhatsApp button, renewal alerts |
| **Medium** (after go-live) | 3 | Skeleton loaders, document upload visibility, blood work surface |
| **Low** (nice-to-have) | 2 | Animated transitions between pages, customer activity timeline |
