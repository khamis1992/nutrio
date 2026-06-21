# Customer Journey Report — Nutrio Fuel Customer Portal

**Date:** June 15, 2026

---

## Main Customer Workflows

### 1. First-Time User — Onboarding & Sign Up
**Flow:** Landing → Onboarding Carousel → Welcome Screen → Sign Up → OTP Verification → Dashboard

**Current state:** Clean, professional green-themed landing page. "Create Free Account" and "Sign In" CTAs are clear. Sign-up form uses react-hook-form with zod validation. OTP screen has a custom numeric keypad. Password visibility toggle present.

**Improvements applied:**
- Fixed hardcoded email placeholder in forgot password flow

**Remaining concerns:**
- Onboarding carousel shows debug buttons — should be removed before launch

### 2. Returning User — Sign In
**Flow:** Welcome Screen → Sign In → Dashboard

**Current state:** Clean sign-in form with email, password, "Remember me" checkbox, "Forgot Password?" link, and biometric login support. Form validation via zod. Clear error states.

**Issues found:** None critical. Form is well-designed.

### 3. Dashboard — Daily Overview
**Flow:** Sign In → Dashboard (home)

**Current state:** The most complex page (119KB). Features:
- Personalized greeting with avatar and time-based message
- Notification bell with unread count badge and dropdown
- Quick Actions cards (Tracker, Favorites, Progress, Community)
- Active orders tracking
- Today's meal schedule with expand/collapse
- Macro nutrition distribution
- Weight progress chart
- Weekly adherence
- Water intake tracking
- Step counter
- Gamification badges and XP
- Streak tracking
- Smart AI recommendations

**Improvements applied:**
- Fixed 5 hardcoded aria-labels (Notifications, View subscription, Previous/Next day, Log activity)

**Quality:** High. Comprehensive, data-rich, visually polished. Uses framer-motion animations, custom SVG icons, and ambient background effects.

### 4. Meals — Browse & Order
**Flow:** Bottom tab "Meals" → Meal listing → Restaurant detail → Meal detail → Add to schedule

**Current state:** Meal browsing with filters, favorites. Restaurant cards with ratings. Meal detail with nutrition info.

**Improvements applied:**
- Fixed 2 hardcoded aria-labels (Back, Toggle favorites)

### 5. Schedule — Meal Calendar
**Flow:** Bottom tab "Schedule" → Calendar view → Manage scheduled meals

**Current state:** 48KB component with calendar-based meal schedule management. Handles meal types (breakfast, lunch, dinner, snack), cancellations, and modifications.

**Issues:** Already using i18n keys for meal type labels.

### 6. Profile & Account
**Flow:** Bottom tab "Profile" → Profile page → Personal Info / Settings / Subscription / Wallet / Orders / Invoices / Support / Notifications

**Current state:** Profile page is a hub with menu rows linking to all account sections. Settings page has notification preferences, subscription management, theme toggle, health apps integration.

**Improvements applied:**
- Fixed hardcoded aria-labels in PersonalInfo and Wallet

### 7. Orders — Order History
**Flow:** Profile → Orders → Order list → Order detail

**Current state:** Full order management with status tracking, OneTapReorder, ModifyOrderModal, filters. Uses EmptyState component when no orders.

### 8. Invoices — Invoice History
**Flow:** Profile → Invoices → Invoice list → Download/View

**Current state:** Invoice listing with type icons, status badges, date formatting, download capability.

**Improvements applied:**
- Refactored invoice type labels from hardcoded English to i18n keys (wallet_topup, subscription, order, partner_payout, driver_payout)
- Fixed empty state description ("Your invoices will appear here after you make purchases")
- Added missing useLanguage import
- Fixed "Go back" aria-label

### 9. Wallet — Top-Up
**Flow:** Profile → Wallet → WalletTopUpFlow → Payment

**Current state:** Thin page (2.4KB) that delegates to WalletTopUpFlow component. Handles payment success/failure callbacks.

**Improvements applied:**
- Fixed "Go back" aria-label

### 10. Support — Help & Tickets
**Flow:** Profile → Support → Ticket list / Create ticket → Messages

**Current state:** Full ticketing system with categories, priorities, file attachments, and threaded messages. Empty state with prompt to create a ticket.

**Improvements applied:**
- Refactored status labels (Open, In Progress, Resolved, Closed) to i18n keys
- Refactored category labels (General Inquiry, Order Issue, Subscription, Technical Problem, Billing, Feedback) to i18n keys
- Fixed empty state prompt translation
- Fixed ticket placeholder translation
- Fixed "Cancel" button
- Added missing useLanguage import

### 11. Notifications
**Flow:** Dashboard bell → Notifications page / Notification dropdown

**Current state:** Full notification center with type-based icons (order_update, meal_reminder, subscription_alert, general, announcement, coach_message), filter tabs, delete, and bulk actions.

**Improvements applied:**
- Refactored filter labels (All, Orders, Meals, Messages, Offers) to i18n keys
- Fixed "Delete" button text

### 12. Subscription Management
**Flow:** Profile → Subscription → Plans / Manage / Upgrade

**Current state:** Plan comparison, billing interval toggle, upgrade/downgrade flow, freeze management, rollover credits. Good use of tier metadata.

---

## Current Problems (Resolved)

| Problem | Severity | Resolution |
|---------|----------|------------|
| 20+ hardcoded English strings invisible to i18n | Critical | All converted to i18n keys with Arabic translations |
| Missing useLanguage imports causing runtime crashes | High | Added imports to InvoiceHistory and Support |
| Hardcoded aria-labels breaking screen reader i18n | High | All 15 converted to t() calls |
| Hardcoded placeholders in forms | Critical | Converted to i18n keys |

## Remaining Improvements Recommended

1. **Remove debug buttons from OnboardingCarousel** — "Go to onboarding page 1/2/3" visible in production
2. **Add per-page <title> tags** — Currently all pages share the same title
3. **Add skeleton loaders** to OrderHistory, Support, and Notifications
4. **Replace placeholder contact info** in Privacy page with real Nutrio details
5. **Add page-level error boundary** to Wallet.tsx
