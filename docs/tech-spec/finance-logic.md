# 💰 Financial & Subscription Logic: Wallet, SADAD, and Credits

Nutrio manages a hybrid financial model combining a credit-based wallet for a la carte lapped meals and a tiered subscription model for recurring access and quotas.

---

## 1. Wallet & SADAD Integration Flow
The wallet balances are handled with strict transactional integrity to prevent "phantom credits."

### 🔄 The Top-up Sequence:
1. **Selection**: User selects a top-up package in `Wallet.tsx`.
2. **Initiation**: Frontend calls `initiateSADADPayment()` $\rightarrow$ sends request to SADAD gateway.
3. **Payment State**: The system creates a `payment_transaction` record with status `pending`.
4. **The Callback**: SADAD invokes the `payment_callback` Supabase Edge Function upon successful payment.
5. **SADAD Verification**: The Edge Function verifies the transaction hash against the SADAD API.
6. **Balance Update**: On success, the system executes a PostgreSQL transaction:
   - `UPDATE user_wallets SET balance = balance + amount`
   - `UPDATE payment_transactions SET status = 'completed'`
7. **UI Update**: The `useWalletBalance` hook, listening via a Supabase Realtime subscription, updates the UI instantly.

---

## 2. Subscription Tiers & Quota Management
Subscriptions are managed through a logic layer that controls feature access and meal counts.

### 📋 Tier Hierarchy
Nutrio supports multiple tiers: *Basic, Standard, Premium, VIP, Healthy, Fresh, Weekly Boost, Elite*.
- **Meal Quota**: Each tier defines a monthly meal count (e.g., 60 meals/mo).
- **Feature Access**: High-tier plans unlock the `SADAD` rollover and the `AI Health Suite`.

### 🔄 The Rollover System
To prevent user frustration, Nutrio implements "Rollover Credits":
- **Calculation**: At the end of the billing cycle, `unused_credits = plan_limit - actual_consumed`.
- **Carry-over**: The system adds `unused_credits` to the next month's quota.
- **Limit**: Rollovers are capped at a maximum of 2x the monthly plan limit to prevent infinite accumulation.

### 🛡️ The Subscription Gate
The app implements a `SubscriptionGate` component:
- **Check**: `user_subscriptions` table $\rightarrow$ `expiry_date` and `status`.
- **Action**: If `status == 'expired'`, the component redirects the user to `/subscription/plans` and displays an "Expiry Banner."

---

## 3. Checkout & Credit Deduction
When a user schedules a meal or buys from the marketplace:
1. **Validation**: System checks `wallet_balance` $\rightarrow$ `meal_price`.
2. **Deduction**: `UPDATE user_wallets SET balance = balance - cost`.
3. **Log**: An entry is created in `wallet_transactions` for auditability.
4. **Failure**: If balance is insufficient, the `Buy Meal Credit` modal is triggered.
