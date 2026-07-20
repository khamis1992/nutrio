# Competitive Gap Post-Deploy Verification Runbook

Date: 2026-07-20  
Owner: Engineering and Release Management  
Scope: Family, Corporate Benefits, and Subscription Schedule Operations

## Release posture

The three schema migrations below are applied to the linked Supabase project.
The web code remains guarded by default-off feature flags. Do not enable Family
or Corporate Benefits until the authenticated fixture and device gates below
pass. Migration `248000` depends on the corporate event ledger in `247000`.

## Applied order

1. `20260720246000_family_profiles_and_safeguards.sql`
2. `20260720247000_corporate_benefits_foundation.sql`
3. `20260720248000_secure_subscription_schedule_operations.sql`

Never apply `248000` without `247000`. Use a Supabase development branch or a
linked staging project first; do not use the production project as the first
execution environment.

## Preflight

- Record the current remote migration list and schema-only backup.
- Confirm the central admin MFA migration is present.
- Confirm `schedule_meals_atomic(uuid,jsonb,uuid)`,
  `cancel_meal_schedule(uuid,text)`, and
  `admin_cancel_meal_schedule(uuid,text)` exist before applying `248000`.
- Keep `competitive-family-accounts` and
  `competitive-corporate-benefits` disabled.
- Confirm no delivery or subscription reconciliation job is running during the
  migration window.

## Database verification

Run these pgTAP contracts on the upgraded staging schema:

```text
supabase/tests/family-profiles-and-safeguards.sql
supabase/tests/corporate-benefits-foundation.sql
supabase/tests/subscription-schedule-operations.sql
```

Then execute fixture journeys with two unrelated customers and one AAL2 admin:

1. Owner can create and update a family profile; another customer cannot read,
   update, deactivate, assign, or schedule for it.
2. Minor profile requires guardian consent and a child relationship.
3. Family allergy conflict and exhausted allowance reject without creating a
   schedule or consuming subscription quota.
4. Replaying the same request ID returns the original schedules and cannot
   change the beneficiary.
5. AAL1 admin calls to every corporate admin RPC fail; AAL2 calls succeed.
6. Employee consent, sponsored scheduling, and invoice generation are replay
   safe and expose no individual meal or health data to sponsor output.
7. Cancelling a sponsored schedule creates one reversal, restores the original
   corporate allowance only when its period is still active, restores the exact
   subscription quota, and refunds add-ons once.
8. Cancelling again returns `already_cancelled` without a second quota change,
   wallet credit, corporate reversal, or audit event.
9. Delivery edits reject cross-user addresses and in-progress jobs, reroute the
   branch, and recalculate the delivery fee.

After verification, regenerate `src/integrations/supabase/types.ts` from the
verified remote schema and rerun typecheck, lint, tests, and production build.

## Web and APK gates

- Test Arabic and English at 375px and with large system text.
- Test offline retry with the same request ID.
- Test Android back, keyboard, safe area, dock clearance, and notification deep
  links on one Samsung and one stock Android device.
- Capture the Family selector, corporate consent, allowance rejection,
  cancellation confirmation, and delivery edit states.

## Activation

1. Enable Family for internal staff only.
2. Monitor schedule mismatch, allergen rejection, allowance exhaustion,
   cancellation replay, wallet refund, and delivery repricing errors.
3. Expand Family to an invited cohort after 48 hours without reconciliation
   defects.
4. Repeat the same staged activation for Corporate Benefits with one contracted
   sponsor and reconciled invoice cycle.

## Rollback

- First disable both feature flags; this removes new entry points without data
  loss.
- Do not drop the new tables or columns during an incident.
- If an RPC is defective, restore its previous public wrapper while keeping the
  legacy implementations private and preserve all audit and benefit events.
- Reconcile subscription quota, wallet transactions, corporate reversals, and
  partner earnings before resuming activation.
