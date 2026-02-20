# Nutrio Fuel: Subscription Marketplace Design

**Date:** 2026-02-21  
**Status:** Approved  

## Overview

Transform Nutrio Fuel into an all-inclusive subscription marketplace where customers pay a flat subscription fee to access meals from ALL partner restaurants. This document outlines the business model, technical changes, and implementation roadmap.

---

## Business Model

### Customer Experience
- Pay a flat monthly subscription fee
- Browse ALL partner restaurants in one unified app
- Order any meal - no per-meal payment, just subscription limits
- Tiers:
  - **Basic**: 5 meals/week
  - **Standard**: 10 meals/week
  - **Premium**: 15 meals/week
  - **VIP**: Unlimited

### Restaurant Partner Experience
- Self-register online with restaurant details
- Admin reviews and approves application
- Admin sets per-meal payout rate (e.g., 25 QAR per meal)
- Add meals to menu (no pricing - all included in subscription)
- Get paid weekly based on: meals prepared × payout rate

### Revenue Flow
```
Customer → Nutrio Fuel (subscription fee)
Nutrio Fuel → Restaurant (per-meal payout)
Nutrio Fuel retains the margin
```

---

## Restaurant Onboarding Flow

### 5-Step Registration Wizard

**Step 1: Restaurant Info**
- Name, description
- Cuisine type
- Dietary tags (keto, vegan, gluten-free, etc.)

**Step 2: Location & Hours**
- Address (with map pin)
- Phone number, email
- Operating hours

**Step 3: Media Upload**
- Logo upload (required)
- Restaurant photos (optional)

**Step 4: Kitchen Details**
- Average prep time per meal
- Daily meal capacity
- Bank account info for payouts

**Step 5: Review & Submit**
- Summary of all information
- Terms and conditions acceptance
- Submit for approval

### Admin Approval Workflow

1. Restaurant submitted → status: `pending_approval`
2. Admin receives notification in dashboard
3. Admin reviews restaurant details
4. Admin sets per-meal payout rate
5. Admin approves → restaurant goes live
6. Or admin rejects → restaurant notified with reason

### Meal Management (Post-Approval)

- Partners add meals WITHOUT pricing
- Required fields: name, description, prep time, calories, macros, diet tags
- AI image analysis (existing feature) helps auto-populate nutrition info
- Meal availability can be toggled on/off

---

## Database Changes

### Modified Tables

#### `restaurants`
Add columns:
```sql
payout_rate DECIMAL(10,2) -- Per-meal payout amount (set by admin)
bank_account JSONB -- {bank_name, account_number, account_holder}
daily_capacity INTEGER -- Max meals that can be prepared per day
approval_status VARCHAR(20) DEFAULT 'pending' -- pending/approved/rejected
rejection_reason TEXT -- If rejected, reason provided by admin
```

#### `meals`
- Deprecate `price` column (keep for backwards compatibility but hide from UI)
- Add `cost_to_platform DECIMAL(10,2)` for internal tracking

### New Tables

#### `subscription_plans`
```sql
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL, -- Basic, Standard, Premium, VIP
  meals_per_week INTEGER, -- NULL for unlimited
  price DECIMAL(10,2) NOT NULL,
  is_unlimited BOOLEAN DEFAULT FALSE,
  features JSONB, -- Additional perks
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `referrals`
```sql
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES auth.users(id),
  referee_id UUID REFERENCES auth.users(id),
  referral_code VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending/completed/rewarded
  reward_meals INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

#### `meal_orders` (extend existing orders)
Add columns to track restaurant fulfillment:
```sql
restaurant_id UUID REFERENCES restaurants(id),
payout_amount DECIMAL(10,2), -- Amount to pay restaurant
payout_status VARCHAR(20) DEFAULT 'pending', -- pending/paid
payout_date TIMESTAMP
```

---

## UI Changes

### Customer-Facing

**Meals Page**
- Single unified view of ALL restaurant meals
- Filters: restaurant, diet tag, meal type, calories
- No prices displayed - show "Included in your plan"
- Meal cards show: image, name, restaurant name, calories, prep time

**Order Flow**
- Check subscription meal limit before confirming
- Show "X meals remaining this week"
- Select delivery time slot
- No payment step for active subscribers

**Subscription Page**
- Clear tier comparison
- Current usage display
- Upgrade/downgrade options

### Partner-Facing

**PartnerOnboarding.tsx**
- Expand to 5-step wizard (from current 4)
- Add kitchen details step
- Add bank info fields

**PartnerMenu.tsx**
- Remove all price input fields
- Simplify to: name, description, nutrition, diet tags, availability

**PartnerDashboard.tsx**
- Replace "Revenue" with "Meals Served"
- Add "Earnings" section (meals × payout rate)
- Weekly payout summary

**PartnerPayouts.tsx**
- Show payout history
- Weekly breakdown by meals served
- Payout rate display

### Admin-Facing

**AdminRestaurants.tsx**
- Pending approval queue
- Approve/reject with payout rate setting
- Restaurant performance metrics

---

## Referral Program (Zero-Cost Growth)

### How It Works

- Every user gets a unique referral code (e.g., NUTRIO-XKJM)
- Referrer earns: 1 free meal added to their weekly limit per successful signup
- New user gets: 1 free meal added to their first week
- Free meals don't roll over - use it or lose it

### Implementation

**Profile Page**
- Display referral code
- Share buttons: WhatsApp, Copy Link
- Stats: "You've earned X free meals"

**Subscription/Wallet Page**
- Show earned free meals
- Apply to current week's limit

**Backend**
- Generate unique code on user signup
- Track referral completions
- Add reward meals to subscription

### Why This Works

- Zero cost (just 1 extra meal margin per referral)
- Qatar market is relationship-driven
- Word of mouth is powerful in small communities
- Easy to share via WhatsApp (dominant in Qatar)

### Additional Low-Cost Marketing

1. **Partner QR Codes**: Restaurants display Nutrio QR codes at their location
2. **First-Week Trial**: Offer 3 free meals for first-time subscribers
3. **Instagram Integration**: Partner restaurants tag @nutriofuel in healthy meal posts
4. **Gym Partnerships**: Leave flyers at fitness centers (target audience alignment)

---

## Implementation Roadmap

### Phase 1: Restaurant Onboarding (Priority)
**Duration: 3-4 days**

- [ ] Enhance PartnerOnboarding.tsx with 5-step wizard
- [ ] Add database columns to restaurants table
- [ ] Create admin approval workflow
- [ ] Update PartnerMenu.tsx to remove price fields
- [ ] Test full onboarding flow

### Phase 2: Subscription Model Update
**Duration: 3-4 days**

- [ ] Create subscription_plans table
- [ ] Update meals table (add cost_to_platform)
- [ ] Modify customer meals page (unified view, no prices)
- [ ] Update order flow to check meal limits
- [ ] Update subscription page UI

### Phase 3: Referral System
**Duration: 2 days**

- [ ] Create referrals table
- [ ] Generate referral codes for existing users
- [ ] Add referral UI to profile page
- [ ] Implement referral tracking
- [ ] Add reward meal logic

### Phase 4: Partner Dashboard Updates
**Duration: 1-2 days**

- [ ] Update PartnerDashboard with meals served/earnings
- [ ] Update PartnerPayouts with new calculation logic
- [ ] Test payout reporting

### Phase 5: Admin Enhancements
**Duration: 1 day**

- [ ] Add pending restaurants queue
- [ ] Approve/reject with payout rate
- [ ] Restaurant analytics

---

## Success Metrics

- Restaurant onboarding completion rate > 80%
- Time from registration to first meal listed < 48 hours
- Customer subscription conversion rate > 15%
- Referral-driven signups > 30% of new customers
- Partner retention rate > 90% after 3 months

---

## Open Questions / Future Considerations

1. **Meal Sourcing Priority**: How to handle when multiple restaurants can fulfill same order?
2. **Capacity Management**: What happens when a restaurant hits daily capacity?
3. **Payout Frequency**: Weekly vs bi-weekly vs monthly?
4. **Minimum Payout**: Threshold before processing payout?
5. **Quality Control**: How to handle customer complaints about specific restaurants?
