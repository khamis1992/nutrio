# Coach Monetization System — Full Plan

**Date**: 2026-05-27
**Status**: Plan complete — pending approval

---

## Overview

Three revenue streams in one system: coach earns from client subscriptions, platform takes a commission, both sides have transparent earnings dashboards.

```
Client pays → Platform (Sadad/Stripe) → Commission split
                                          ├── Admin commission %
                                          └── Coach payout (wallet)
```

## Database Design

### 1. New Tables

#### `coach_pricing` — coach sets their price
```sql
coach_id uuid PK → profiles(user_id)
price_per_week decimal — what client pays per week
price_per_month decimal — what client pays per month
currency text DEFAULT 'QAR'
is_active boolean DEFAULT true
created_at, updated_at timestamptz
```

#### `coach_subscriptions` — client subscriptions to coaches
```sql
id uuid PK
coach_id uuid → profiles(user_id)
client_id uuid → profiles(user_id)
plan text — 'weekly' | 'monthly'
price decimal — locked-in price at time of purchase
status text — 'active' | 'cancelled' | 'expired'
start_date, end_date timestamptz
payment_method text — 'wallet' | 'sadad' | 'card'
transaction_id text — external payment reference
created_at, updated_at timestamptz
```

#### `coach_earnings` — immutable ledger for every transaction
```sql
id uuid PK
coach_id uuid
client_id uuid
subscription_id uuid → coach_subscriptions
amount decimal — gross amount client paid
commission_pct decimal — admin commission % at time of transaction
commission_amount decimal — platform cut
net_amount decimal — coach take-home
transaction_type text — 'subscription' | 'refund' | 'bonus'
status text — 'pending' | 'settled' | 'refunded'
settled_at timestamptz — when coach can withdraw
created_at timestamptz
```

#### `platform_commission_config` — admin sets the cut
```sql
id uuid PK
commission_pct decimal DEFAULT 20 — e.g. 20%
min_payout_threshold decimal DEFAULT 100 — minimum to withdraw
updated_by uuid → auth.users
updated_at timestamptz
— Single row table (only one config at a time)
```

### 2. Modifications to Existing

- `wallet_balance` or similar — coach earnings accumulate here, auto-withdraw when threshold met
- `user_roles` — ensure 'coach' role is tracked
- `notifications` — commission earnings notifications

## Component Architecture

### Coach Side

| Component | Route | Purpose |
|---|---|---|
| `CoachPricingSection` | Inside `/coach/settings` | Set weekly/monthly price, toggle active/inactive |
| `CoachEarnings` | `/coach/earnings` (new tab) | Earnings dashboard: total earned, pending, settled, client list with amounts |
| `CoachTransactions` | Inside CoachEarnings | Transaction history with filters |

### Client Side

| Component | Route | Purpose |
|---|---|---|
| `CoachSubscriptionCard` | `/coaches/:id` or client detail | Show coach price, subscribe button |
| `SubscribeModal` | Modal | Confirm subscription, payment method selection |
| `MyCoachSubscriptions` | `/profile` tab or `/subscriptions` | View active coaching subscriptions, cancel |

### Admin Side

| Component | Route | Purpose |
|---|---|---|
| `AdminCoachCommission` | `/admin/coach-commission` | Set commission %, view all coach earnings, platform revenue |
| `AdminCoachPayouts` | Inside AdminCoachCommission | Pending payouts, manual settle/approve |
| `AdminCoachEarnings` | Inside AdminCoachCommission | All coaches earnings overview |

## UI Design (mobile-native, matches existing Nutrio patterns)

### Coach Settings — Pricing Section (added to existing CoachSettings.tsx)
```
┌──────────────────────────────────────────┐
│ 💰 Your Pricing                          │
│                                          │
│  Weekly Price                            │
│  ┌──────────────────────────────────┐    │
│  │ QAR │ 200                │       │    │
│  └──────────────────────────────────┘    │
│                                          │
│  Monthly Price (save ~17%)               │
│  ┌──────────────────────────────────┐    │
│  │ QAR │ 600                │       │    │
│  └──────────────────────────────────┘    │
│                                          │
│  💡 Suggested: QAR 150-500/week          │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │  Active: accepting new clients   │    │
│  └────────── toggle ────────────────┘    │
│                                          │
│  Your earnings are held for 7 days       │
│  before withdrawal.                      │
│  Commission: 20% (platform fee)          │
└──────────────────────────────────────────┘
```

### Coach Earnings Dashboard (`/coach/earnings` — new tab)
```
┌──────────────────────────────────────────┐
│ 💰 Earnings                  This Month  │
│                                          │
│ ┌──────────────┬──────────────┐         │
│ │ Total Earned │  Available   │         │
│ │  QAR 2,400   │  QAR 1,920  │         │
│ │  gross       │  to withdraw │         │
│ ├──────────────┼──────────────┤         │
│ │ Pending      │  This Month  │         │
│ │  QAR 480     │  QAR 1,920  │         │
│ └──────────────┴──────────────┘         │
│                                          │
│  Active Subscribers                      │
│  ┌──────────────────────────────────┐    │
│  │ 👤 Sarah M.   QAR 200/wk  Active│    │
│  │    Started May 15 · 2 weeks     │    │
│  ├──────────────────────────────────┤    │
│  │ 👤 Ahmed K.   QAR 600/mo  Active│    │
│  │    Started May 1 · 1 month      │    │
│  └──────────────────────────────────┘    │
│                                          │
│  Transaction History                     │
│  ┌──────────────────────────────────┐    │
│  │ May 20  +QAR 160  Sarah M.      │    │
│  │          Weekly subscription     │    │
│  │ May 15  +QAR 480  Ahmed K.      │    │
│  │          Monthly subscription    │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

### Admin Commission Page (`/admin/coach-commission`)
```
┌──────────────────────────────────────────┐
│ 💼 Coach Platform Revenue                │
│                                          │
│  Commission Rate                         │
│  ┌──────────────────────────────────┐    │
│  │       20%                    ──  │    │
│  └────────── slider ────────────────┘    │
│                                          │
│  Platform Revenue                        │
│  ┌──────────────┬──────────────┐         │
│  │ This Month   │  All Time    │         │
│  │  QAR 2,880   │  QAR 12,400  │         │
│  └──────────────┴──────────────┘         │
│                                          │
│  Per-Coach Breakdown                     │
│  ┌──────────────────────────────────┐    │
│  │ Ali (3 clients)  QAR 1,440      │    │
│  │   Avg price: QAR 240/wk         │    │
│  │   Your cut:  QAR 288            │    │
│  ├──────────────────────────────────┤    │
│  │ Fatima (5 clients) QAR 2,400    │    │
│  │   Avg price: QAR 200/wk         │    │
│  │   Your cut:  QAR 480            │    │
│  └──────────────────────────────────┘    │
│                                          │
│  Pending Payouts (to coaches)            │
│  ┌──────────────────────────────────┐    │
│  │ Ali · QAR 960 available          │    │
│  │   [Mark as Paid]                 │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

## Flow

### Subscription Purchase Flow
1. Client views coach profile → sees price → taps "Subscribe"
2. Confirm modal shows: price, billing cycle, platform fee note
3. Payment processed via Sadad/Stripe → `coach_subscriptions` row created
4. `coach_earnings` ledger entry created: gross = full price, commission = X%, net = coach take
5. Both coach and admin get notifications
6. Coach-client relationship becomes active

### Weekly/Monthly Billing
- Cron job or edge function runs daily
- Checks for active weekly subscriptions past 7 days → auto-renews
- Checks for monthly subscriptions past 30 days → auto-renews
- Failed payments → subscription paused, both parties notified

### Coach Withdrawal
- Coach sees "Available to withdraw" balance in earnings dashboard
- Must exceed `min_payout_threshold` (default QAR 100)
- "Withdraw" button → admin approval flow (or auto-approve if trusted)
- Funds transferred to coach wallet → withdrawable to bank

## Files to Create

| File | Purpose |
|---|---|
| `supabase/migrations/20260528_coach_monetization.sql` | All tables + RLS + triggers |
| `src/components/coach/CoachPricingSection.tsx` | Price setting UI |
| `src/components/coach/CoachEarningsPage.tsx` | Coach earnings dashboard |
| `src/components/coach/CoachTransactionHistory.tsx` | Transaction list |
| `src/components/coach/SubscribeModal.tsx` | Client subscription confirmation |
| `src/pages/admin/AdminCoachCommission.tsx` | Admin commission management |
| `src/hooks/useCoachPricing.ts` | Fetch/save coach pricing |
| `src/hooks/useCoachEarnings.ts` | Earnings data for coach |
| `src/hooks/useCoachSubscriptions.ts` | Client subscription management |
| `src/hooks/useAdminCoachRevenue.ts` | Admin revenue overview |
| `supabase/functions/process-coach-billing/index.ts` | Edge function for auto-renewal |

## Files to Modify

| File | Changes |
|---|---|
| `src/pages/coach/CoachSettings.tsx` | Add CoachPricingSection |
| `src/components/coach/CoachPortalLayout.tsx` | Add Earnings tab |
| `src/components/coach/CoachBottomTabBar.tsx` | Add Earnings tab (5-tab) |
| `src/App.tsx` | Add `/coach/earnings`, `/admin/coach-commission` routes |
| `src/pages/coach/CoachClientDetail.tsx` | Add subscribe button |
| `src/admin/routes.tsx` (if exists) or `src/App.tsx` | Admin route |

## Design Tokens (consistent with Nutrio)

- Pricing cards: `rounded-[24px] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80`
- Amount text: `text-2xl font-extrabold text-slate-950`
- Positive amounts: `text-emerald-600`
- Pending amounts: `text-amber-600`
- Commission badge: `bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5`
- Section headers: `text-[15px] font-extrabold tracking-[-0.02em] text-slate-950`

## Estimated Effort

| Phase | Complexity | Est. Lines |
|---|---|---|
| Phase 1: Database + Pricing | Medium | ~200 |
| Phase 2: Coach Earnings Dashboard | Medium | ~350 |
| Phase 3: Client Subscribe Flow | Medium | ~250 |
| Phase 4: Admin Commission Panel | Medium | ~300 |
| Phase 5: Billing Edge Function | High | ~200 |
| Phase 6: Integration + Polish | Low | ~100 |
| **Total** | | **~1,400 lines** |

## Open Questions

1. Payment provider — Sadad (existing) or new Stripe integration?
2. Payout method — manual admin approval or automatic to coach wallet?
3. Commission model — flat % or tiered (higher-earning coaches pay less)?
4. Free trial period for new coach-client relationships?
