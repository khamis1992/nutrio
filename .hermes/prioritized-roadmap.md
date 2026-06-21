# Prioritized Roadmap — Nutrio Fuel Customer Portal

**Date:** June 15, 2026

---

## Phase 0: Before Go-Live (NOW) ✅ COMPLETE

| # | Task | Effort | Status |
|---|------|--------|--------|
| 1 | Fix hardcoded English labels in InvoiceHistory, Support, Notifications config objects | 2h | ✅ Done |
| 2 | Fix hardcoded empty state text (InvoiceHistory, Support) | 30m | ✅ Done |
| 3 | Fix hardcoded form placeholders (ForgotPassword, Support) | 15m | ✅ Done |
| 4 | Fix hardcoded aria-labels (Dashboard, Meals, InvoiceHistory, Wallet, PersonalInfo) | 30m | ✅ Done |
| 5 | Add missing useLanguage imports (InvoiceHistory, Support) | 15m | ✅ Done |
| 6 | Add Order History, Invoice History, Subscription, Settings, Notifications to Profile hub | 1h | ✅ Done |
| 7 | Fix duplicate Payments/Offers navigation in Profile | 15m | ✅ Done |
| 8 | Add 30 new i18n keys with Arabic translations | 30m | ✅ Done |
| 9 | Verify TypeScript compilation and browser rendering | 30m | ✅ Done |

**Phase 0 total effort:** ~5.5 hours (all completed)

---

## Phase 1: Post-Launch (Week 1-2)

| # | Task | Effort | Priority |
|---|------|--------|----------|
| 1 | **Remove debug buttons from OnboardingCarousel** — Guard with `import.meta.env.DEV` or delete | 30m | High |
| 2 | **Add per-page `<title>` tags** — Use `react-helmet-async` for dynamic page titles (e.g., "Dashboard - Nutrio", "Orders - Nutrio") | 2h | High |
| 3 | **Replace Privacy page placeholder data** — Real company email, phone, address | 15m | High |
| 4 | **Add skeleton loaders to OrderHistory, Support, Notifications** | 3h | Medium |
| 5 | **Surface blood work & health dashboard from Profile** — Add "Health Dashboard" menu item to "For Your Health" section | 30m | Medium |
| 6 | **Add WhatsApp support button** — Leverage existing `send-whatsapp-proxy` edge function. Add floating WhatsApp button on Support page. | 2h | Medium |
| 7 | **Add subscription renewal date to Dashboard** — Show "Next renewal: June 30" in subscription widget | 1h | Medium |

**Phase 1 total effort:** ~9 hours

---

## Phase 2: Growth (Month 1-2)

| # | Task | Effort | Priority |
|---|------|--------|----------|
| 1 | **Payment due reminders** — Surface upcoming payment dates in notification center. Backend `process-subscription-renewal` already handles renewal logic. | 3h | High |
| 2 | **Invoice PDF download** — Add download button to all invoice entries in InvoiceHistory. `send-invoice-email` edge function already generates PDFs. | 2h | Medium |
| 3 | **Customer activity timeline** — Show recent actions on Dashboard (last order, last payment, last support ticket update). | 4h | Medium |
| 4 | **Profile completion score** — Show percentage complete with missing fields highlighted. Drives data quality. | 2h | Medium |
| 5 | **Quick payment shortcut** — "Pay Now" button on Dashboard when wallet balance is low. | 2h | Low |
| 6 | **Arabic text review pass** — Native Arabic speaker review of all 3,257 translations for natural phrasing. | 4h | Medium |

**Phase 2 total effort:** ~17 hours

---

## Phase 3: Advanced (Month 3+)

| # | Task | Effort | Priority |
|---|------|--------|----------|
| 1 | **Customer statement of account** — Monthly PDF statement showing all charges, payments, credits. Requires new edge function. | 1w | Future |
| 2 | **Automated renewal notifications** — Push/email notifications 7 days and 1 day before subscription renewal. | 3h | Future |
| 3 | **Smart meal recommendations v2** — Based on order history, dietary preferences, and health goals. Backend `smart-meal-allocator` exists. | 1w | Future |
| 4 | **Family account dashboard** — Unified view for family plan members. `FamilyPlansCard` component exists. | 1w | Future |
| 5 | **Dark mode polish** — Full dark mode audit. ThemeContext already supports toggle. | 1w | Future |
