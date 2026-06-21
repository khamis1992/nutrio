# Implemented Improvements — Nutrio Fuel Customer Portal

**Date:** June 15, 2026  
**Session:** Product improvement review + UX audit

---

## Changes Summary

### Files Modified (10 source files + 2 i18n files)

| # | File | Change | Reason |
|---|------|--------|--------|
| 1 | `src/i18n/en.json` | +30 new translation keys | Missing labels for invoice types, support statuses/categories, notification filters, profile menu items, form placeholders, empty states, aria labels |
| 2 | `src/i18n/ar.json` | +30 new Arabic translations | All new keys have professional Arabic translations |
| 3 | `src/pages/InvoiceHistory.tsx` | Refactored invoice type config to use i18n key maps + `t()` calls. Added `useLanguage` import. Fixed empty state text. Fixed aria-labels. | Hardcoded English labels ("Wallet Top-up", "Order", etc.) invisible to Arabic users. Missing import would crash at runtime. |
| 4 | `src/pages/Support.tsx` | Refactored status config + category config to use i18n key maps + `t()` calls. Added `useLanguage` import. Fixed empty state prompt. Fixed ticket placeholder. Fixed aria-label. | Hardcoded English statuses ("Open", "In Progress", etc.) and categories ("General Inquiry", "Order Issue", etc.) invisible to Arabic users. |
| 5 | `src/pages/Notifications.tsx` | Refactored filter config to use i18n key maps + `t()` calls. Fixed "Delete" button text. | Hardcoded filter labels ("All", "Orders", "Meals", "Messages", "Offers"). |
| 6 | `src/pages/auth/ForgotPasswordScreen.tsx` | Fixed `placeholder="your@email.com"` → `placeholder={t("email_placeholder")}` | Hardcoded English placeholder in Arabic mode. |
| 7 | `src/pages/Dashboard.tsx` | Fixed 5 hardcoded `aria-label` attributes → `aria-label={t("key")}` | Screen readers would always announce English. |
| 8 | `src/pages/Meals.tsx` | Fixed 2 hardcoded `aria-label` attributes | Same screen reader i18n issue. |
| 9 | `src/pages/PersonalInfo.tsx` | Fixed 1 hardcoded `aria-label` | Same screen reader i18n issue. |
| 10 | `src/pages/Wallet.tsx` | Fixed 1 hardcoded `aria-label` | Same screen reader i18n issue. |
| 11 | `src/pages/Profile.tsx` | Added 7 new lucide-react icon imports. Replaced duplicate "Offers & Coupons" (→ /wallet) with "Order History" (→ /orders). Added "Invoice History" (→ /invoices), "Subscription" (→ /subscription), "Notifications" (→ /notifications), "Settings" (→ /settings) menu items. | Critical navigation gaps: 5 customer-facing pages were defined as routes but had ZERO navigation links from the Profile hub. Customers could not find these pages. |

### New i18n Keys Added (30 total)

**Invoice types:** `invoice_type_wallet_topup`, `invoice_type_order`, `invoice_type_partner_payout`, `invoice_type_driver_payout`, `invoice_type_subscription`

**Support statuses:** `status_open`, `status_resolved`, `status_closed`

**Support categories:** `category_general`, `category_order_issue`, `category_subscription`, `category_technical`, `category_billing`, `category_feedback`

**Filters:** `filter_messages`, `filter_offers`

**Profile menu:** `order_history_menu`, `order_history_subtitle`, `invoice_history_menu`, `subscription_menu`, `subscription_subtitle`, `notifications_menu`, `notifications_subtitle`, `settings_menu`, `settings_subtitle`

**Empty states & prompts:** `invoice_history_empty_desc`, `support_empty_prompt`

**Forms:** `email_placeholder`

**Aria:** `view_subscription_aria`, `toggle_favorites_aria`

**Actions:** `confirm`, `close`, `no_data`, `try_again`

### Verification

- ✅ `npm run typecheck` — PASS (0 TypeScript errors)
- ✅ `npm run lint` — Warnings only (0 new, all pre-existing)
- ✅ Browser dev server — Zero JS errors on page load
- ✅ i18n key count — en.json = ar.json = 3,257 keys (perfect sync)

---

## Before/After: Profile Hub Navigation

### Before (6 working links, 2 duplicates)
```
For Your Health:
  Personal Info → /personal-info
  Goals → /nutrition-goals
  Health Info → /body-metrics
  Dietary Preferences → /dietary
  Connect with Coach

Finance:
  Payments → /wallet
  Offers & Coupons → /wallet  ← DUPLICATE, no dedicated page

Support & Account:
  Language
  Help Center → /faq
  Contact Us → /support
  Privacy & Security → /privacy
  Logout
```

### After (11 functional links, 0 duplicates)
```
For Your Health:
  Personal Info → /personal-info
  Goals → /nutrition-goals
  Health Info → /body-metrics
  Dietary Preferences → /dietary
  Connect with Coach

Finance:
  Payments → /wallet
  Order History → /orders          ← NEW
  Invoice History → /invoices      ← NEW
  Subscription → /subscription      ← NEW

Support & Account:
  Language
  Notifications → /notifications    ← NEW
  Settings → /settings              ← NEW
  Help Center → /faq
  Contact Us → /support
  Privacy & Security → /privacy
  Logout
```
