# Remaining Recommendations — Nutrio Fuel Customer Portal

**Date:** June 15, 2026

---

## Features Needing Backend/Database Support

| Feature | What's Needed | Existing Infrastructure |
|---------|--------------|------------------------|
| Customer statement of account | New edge function to aggregate all invoices, payments, credits into monthly PDF | `send-invoice-email` generates individual PDFs — could be extended |
| Automated payment reminders | Scheduled edge function to check upcoming renewals and send push/email | `process-subscription-renewal` handles renewal — add notification dispatch |
| Document storage & management | Document upload for customers (beyond blood work) — contracts, receipts, ID | No existing document management system for customers |
| Order modification self-service | Allow customers to modify pending orders (swap meals, change delivery time) | `ModifyOrderModal` component exists — needs backend validation |

## Features Needing Business Approval

| Feature | Decision Required |
|---------|------------------|
| WhatsApp support button placement | Where should it appear? Floating on all pages or just Support page? What hours? |
| Privacy page contact info | What email, phone, and address to display? |
| Auto-renewal notification timing | How many days before renewal should customers be notified? |
| Invoice PDF design/branding | What branding elements, legal text, and QR payment info to include? |
| Referral program surface | Should affiliate program be more prominent on Dashboard? |

## Features for Future Planning

| Feature | Rationale | Phase |
|---------|-----------|-------|
| Dark mode polish | ThemeContext supports toggle already — needs per-component audit for contrast | Phase 3 |
| Customer activity timeline | Builds trust, shows value delivered, reduces "what happened?" questions | Phase 2 |
| Profile completion score | Gamifies data entry, improves data quality for AI recommendations | Phase 2 |
| Family account dashboard | Unified view for family plan members — reduces support complexity | Phase 3 |
| Meal preference learning | AI learns from order history to improve recommendations | Phase 3 |
| Social sharing of achievements | Streaks, badges, weight loss milestones — viral growth loop | Phase 3 |
