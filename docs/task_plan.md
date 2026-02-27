# Task Plan: Customer Portal Workflow Optimization

## Goal
Transform the Customer Portal from a 6.5/10 experience to a 9/10 experience by addressing critical UX gaps in onboarding, subscription conversion, and order tracking within 90 days.

## Phases
- [ ] Phase 1: Critical Fixes (30 Days) - Onboarding, Subscription, Tracking
- [ ] Phase 2: Structural Improvements (60 Days) - Self-Service, Automation
- [ ] Phase 3: Optimization (90 Days) - Intelligence, Retention

## Phase 1 Breakdown
- [ ] 1.1 Onboarding Progress Indicator
- [ ] 1.2 Skip for Now Option
- [ ] 1.3 Auto-Save Recovery
- [ ] 1.4 Split Step 3 into Sub-steps
- [ ] 1.5 Subscription Gate Component
- [ ] 1.6 Subscription Quiz Wizard
- [ ] 1.7 Quota Warning Banner
- [ ] 1.8 Order Status Constants
- [ ] 1.9 Order Tracking Hub
- [ ] 1.10 Push Notification Service
- [ ] 1.11 Notification Preferences

## Phase 2 Breakdown
- [ ] 2.1 Order Cancellation Flow
- [ ] 2.2 Address Validation Enhancement
- [ ] 2.3 Auto Driver Assignment (Edge Function)
- [ ] 2.4 Auto Invoice Email (Edge Function)

## Phase 3 Breakdown
- [ ] 3.1 Smart Meal Suggestions
- [ ] 3.2 NPS Survey Component
- [ ] 3.3 Analytics Dashboard

## Database Migrations
- [ ] Migration: Notification Preferences
- [ ] Migration: NPS Responses
- [ ] Migration: Cancel Order RPC
- [ ] Migration: Delivery Queue

## Key Decisions Made
- Use soft gate instead of hard paywall for subscription
- Split onboarding step 3 to reduce friction
- Auto-save to localStorage with 24-hour recovery window
- Unified order status constants across app
- Auto-assign drivers by zone scoring

## Dependencies
- Push notifications require native platform setup (Capacitor)
- Edge functions require Supabase CLI deployment
- Invoice emails require Resend API key

## Status
**Currently in Phase 0** - Plan created, awaiting approval to begin implementation
