# UX Audit Report — Nutrio Fuel Customer Portal

**Date:** June 15, 2026  
**Auditor:** Builder (Hermes Agent)  
**Scope:** Customer Portal (Customer-facing pages)  
**Methodology:** Code audit (119KB Dashboard, 50+ page components), browser testing, i18n analysis

---

## 1. Pages Reviewed

| Page | Size | Reviewed |
|------|------|----------|
| Auth — WelcomeScreen | 6.5KB | Yes |
| Auth — SignInScreen | 8.1KB | Yes |
| Auth — SignUpScreen | 4.5KB | Yes |
| Auth — ForgotPasswordScreen | 3.1KB | Yes |
| Auth — OtpScreen | 6.3KB | Yes |
| Dashboard | 119KB | Yes |
| Profile | 26KB | Yes |
| PersonalInfo | 10KB | Yes |
| Settings | 24KB | Yes |
| OrderHistory | 38KB | Yes |
| OrderDetail | 28KB | Yes |
| InvoiceHistory | 10KB | Yes |
| Wallet | 2.4KB | Yes |
| Support | 23KB | Yes |
| Notifications | 25KB | Yes |
| Meals | 20KB | Yes |
| Schedule | 48KB | Yes |
| Subscription | 31KB | Yes |
| i18n (en.json + ar.json) | 3228 keys each | Yes |

---

## 2. UX Issues Found

### CRITICAL (5 issues — ALL FIXED)

| # | Issue | Pages Affected | Fix Applied |
|---|-------|---------------|-------------|
| C1 | Hardcoded English labels in config objects — Invoice types ("Wallet Top-up", "Order", etc.), Support statuses ("Open", "In Progress", "Resolved", "Closed"), Support categories ("General Inquiry", "Order Issue", etc.) were hardcoded strings invisible to i18n. Arabic users would see untranslated English text. | InvoiceHistory, Support | Created 20 new i18n keys (en+ar), refactored config objects to use key maps + t() calls |
| C2 | Hardcoded empty state text — "Your invoices will appear here after you make purchases" rendered in English regardless of language setting. | InvoiceHistory | Added invoice_history_empty_desc i18n key |
| C3 | Hardcoded Support empty prompt — "Need help? Create a support ticket and our team will assist you." was hardcoded. | Support | Added support_empty_prompt i18n key |
| C4 | Hardcoded form placeholder — ForgotPasswordScreen had placeholder="your@email.com" hardcoded. | ForgotPasswordScreen | Added email_placeholder i18n key |
| C5 | Hardcoded Support ticket placeholder — "Brief description of your issue" was hardcoded. | Support | Replaced with existing support_ticket_desc key |

### HIGH (6 issues — ALL FIXED)

| # | Issue | Pages Affected | Fix Applied |
|---|-------|---------------|-------------|
| H1 | Hardcoded aria-labels — 15 instances of English aria-labels across Dashboard (5), Meals (2), InvoiceHistory (2), Wallet (1), PersonalInfo (1). Screen readers would always announce English regardless of language. | Dashboard, Meals, InvoiceHistory, Wallet, PersonalInfo | Replaced all with t() calls using existing or new i18n keys |
| H2 | Notifications filter labels hardcoded — "All", "Orders", "Meals", "Messages", "Offers" in FILTERS array. | Notifications | Added filter_messages, filter_offers keys; reused existing all, orders, meals keys |
| H3 | InvoiceHistory missing useLanguage import — Used t() calls but never imported the i18n hook. Would crash at runtime for any user visiting the page. | InvoiceHistory | Added import + const { t } = useLanguage() |
| H4 | Support.tsx missing useLanguage import — Same missing import as InvoiceHistory. | Support | Added import + const { t } = useLanguage() |
| H5 | Hardcoded "Delete" button text in Notifications | Notifications | Replaced with {t("delete")} |
| H6 | Hardcoded "Cancel" button text in Support | Support | Replaced with {t("cancel")} |

### MEDIUM (2 issues — partially addressed)

| # | Issue | Pages Affected | Status |
|---|-------|---------------|--------|
| M1 | No skeleton loading states — OrderHistory, Support, Notifications lack skeleton loaders during data fetch. InvoiceHistory has one. | OrderHistory, Support, Notifications | Not fixed — requires significant component additions; non-blocking for launch |
| M2 | Wallet.tsx thin implementation — 2.4KB, delegates to WalletTopUpFlow component. No explicit error boundary at page level. | Wallet | WalletTopUpFlow handles its own states internally; page-level error boundary would be ideal |

### LOW (3 issues — noted for later)

| # | Issue | Pages Affected |
|---|-------|---------------|
| L1 | Onboarding carousel shows debug navigation buttons ("Go to onboarding page 1/2/3") | OnboardingCarousel |
| L2 | Privacy page has placeholder contact info ("privacy@nutribox.com", dummy address) | Privacy.tsx |
| L3 | Static page title across all pages — always "Nutrio - Healthy Meal Delivery & Nutrition Tracking" | All pages |

---

## 3. Severity Summary

| Severity | Found | Fixed | Remaining |
|----------|-------|-------|-----------|
| Critical | 5 | 5 | 0 |
| High | 6 | 6 | 0 |
| Medium | 2 | 0 | 2 |
| Low | 3 | 0 | 3 |
| **Total** | **16** | **11** | **5** |

---

## 4. Code Changes Summary

### Files Modified (8 source files + 2 i18n files)
1. **src/i18n/en.json** — +21 new translation keys (3,228 to 3,249)
2. **src/i18n/ar.json** — +21 new Arabic translations (3,228 to 3,249)
3. **src/pages/InvoiceHistory.tsx** — Refactored invoice type config, added useLanguage, fixed labels + empty state
4. **src/pages/Support.tsx** — Refactored status config + category config, added useLanguage, fixed labels + empty prompt + placeholder
5. **src/pages/Notifications.tsx** — Refactored filter config, fixed filter labels + Delete button
6. **src/pages/auth/ForgotPasswordScreen.tsx** — Fixed hardcoded email placeholder
7. **src/pages/Dashboard.tsx** — Fixed 5 hardcoded aria-labels
8. **src/pages/Meals.tsx** — Fixed 2 hardcoded aria-labels
9. **src/pages/PersonalInfo.tsx** — Fixed 1 hardcoded aria-label
10. **src/pages/Wallet.tsx** — Fixed 1 hardcoded aria-label

### Verification Results
- TypeScript: npm run typecheck — PASS (0 errors)
- ESLint: npm run lint — warnings only (all pre-existing, 0 new)
- Browser: Dev server loads auth page without errors
- i18n sync: en.json and ar.json have identical key count (3,249 each)

---

## 5. Remaining UX Risks

| Risk | Impact | Recommendation |
|------|--------|---------------|
| Debug buttons visible in onboarding | Low | Guard with import.meta.env.DEV or remove |
| Placeholder contact info in Privacy page | Medium | Replace with real Nutrio support contact details |
| Static page titles across all pages | Low | Add per-page <title> for SEO and tab identification |
| No skeleton loaders on 3 pages | Low | Add Skeleton components to OrderHistory, Support, Notifications |
| Wallet.tsx lacks page-level error boundary | Low | Add error boundary or inline error state |
