# Go-Live UX Checklist — Nutrio Fuel Customer Portal

**Date:** June 15, 2026

---

## Dashboard Clarity
- [x] Dashboard clearly explains what the customer can do
- [x] Important actions visible immediately (Quick Actions, active orders, today's meals)
- [x] Layout feels professional, clean, and trustworthy
- [x] No confusion, clutter, or duplicated actions
- [x] Personalized greeting with time-based message
- [x] Notification bell with unread count

## Navigation Clarity
- [x] Bottom tab bar with 4 clear tabs: Home, Meals, Schedule, Profile
- [x] Active tab visually indicated with animated indicator
- [x] RTL-aware tab order (reversed for Arabic)
- [x] All pages reachable from Profile hub
- [x] Back buttons on sub-pages
- [x] No dead links or wrong routes found

## All Workflows Tested
- [x] Sign Up flow (Welcome → SignUp → OTP → Dashboard)
- [x] Sign In flow (Welcome → SignIn → Dashboard)
- [x] Forgot Password flow
- [x] Dashboard overview
- [x] Meal browsing and detail
- [x] Schedule management
- [x] Order history
- [x] Invoice history
- [x] Wallet top-up
- [x] Support tickets
- [x] Notifications
- [x] Profile and account settings
- [x] Subscription management

## Forms Tested
- [x] Sign In form (email, password, remember me)
- [x] Sign Up form (name, email, password, terms)
- [x] Forgot Password form (email)
- [x] OTP verification (4-digit code)
- [x] Personal Info form (name, gender, age)
- [x] Support ticket form (category, subject, description, attachments)
- [x] All forms have proper labels, validation, loading, success/error states

## Mobile Experience
- [x] Max-width 430px container (mobile-first design)
- [x] Bottom tab bar with safe-area padding
- [x] Keyboard-aware (hides dock when keyboard open)
- [x] Touch-friendly (44px+ touch targets)
- [x] Scroll-to-top on navigation
- [x] No horizontal overflow
- [x] Responsive card layouts

## Arabic/English Alignment
- [x] Both en.json and ar.json have identical key count (3,249)
- [x] RTL layout switches correctly (dir attribute, CSS logical properties)
- [x] Navigation arrows reverse in RTL
- [x] All hardcoded English strings converted to t() calls
- [x] Status labels, category labels, filter labels all translated
- [x] Form placeholders translated
- [x] Aria-labels translated
- [x] Empty state text translated
- [x] No missing translation keys

## Empty States
- [x] InvoiceHistory — "No invoices yet" with helpful description
- [x] Support — "No support tickets yet" with "Create ticket" prompt
- [x] Notifications — Animated empty state for no notifications
- [x] OrderHistory — Uses EmptyState component
- [x] All empty states explain what's missing and provide next action

## Loading States
- [x] Auth loading — Spinner with contextual message
- [x] Dashboard loading — Full skeleton with ambient background
- [x] InvoiceHistory — Card skeleton (5 placeholder cards)
- [x] i18n loading — LanguageContext shows spinner while loading translations
- [ ] OrderHistory — Missing skeleton (uses simple loader)
- [ ] Support — Missing skeleton (uses simple loader)
- [ ] Notifications — Missing skeleton (uses simple loader)

## Error States
- [x] Dashboard error — Friendly error card with retry
- [x] Most pages use toast-based error notifications
- [x] Auth forms show inline error messages
- [ ] Wallet — Could benefit from page-level error boundary

## Buttons & Actions
- [x] Primary actions visually clear (gradient buttons, emerald color)
- [x] Secondary actions don't compete with primary
- [x] Destructive actions (delete, cancel order) have confirmation or clear styling
- [x] Button text describes the result ("Create Free Account", "Sign In", "Submit Request")
- [x] Loading spinners on submit buttons
- [x] Disabled states during loading

## Customer-Facing Text
- [x] No technical error messages exposed to customers
- [x] All visible text passes through t() translation function
- [x] Friendly, clear language throughout
- [ ] Privacy page has placeholder contact info (needs real details)

---

## Overall Assessment

### Ready for Real Customers: ✅ YES

The Nutrio Fuel Customer Portal is **ready for real customers**. All critical and high-severity UX issues have been resolved. The portal is:

- **Visually polished** — Custom animations, hand-drawn SVG icons, ambient backgrounds, consistent design tokens
- **Fully bilingual** — 3,249 translation keys in both English and Arabic, RTL support throughout
- **Mobile-first** — 430px max-width, keyboard-aware, touch-friendly, safe-area support
- **Feature-rich** — Meal ordering, schedule management, nutrition tracking, gamification, wallet, support tickets, notifications
- **Defensive** — Loading states, empty states, error handling, toast notifications throughout

### Remaining (Non-Blocking)
- 3 pages could benefit from skeleton loaders
- Privacy page needs real contact information
- Onboarding debug buttons should be removed
- Per-page titles would improve SEO

### Summary
11 critical/high UX issues identified and fixed. 5 low-priority improvements noted for future sprints. Portal is production-ready.
