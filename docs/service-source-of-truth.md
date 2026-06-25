# Nutrio Customer Service Source Of Truth

This file documents the canonical client data sources. New customer-facing code should use the services/hooks listed here instead of writing directly to multiple tables.

## Nutrition Log

- Canonical write path: `src/lib/meal-log-service.ts`
- Canonical tables: `progress_logs` for daily totals, `meal_history` for item-level history
- Scheduled meals may continue using database RPCs such as `complete_meal_atomic` when they need to update schedule state and nutrition totals atomically.

## Water

- Canonical table: `water_entries`
- Unit: milliliters
- Canonical service: `src/lib/water-service.ts`
- Compatibility hook: `src/hooks/useWaterIntake.ts` returns glass-based values for older UI, but reads/writes `water_entries`.
- Avoid new customer code against `water_intake`.

## Body Metrics

- Canonical table: `body_measurements`
- Canonical hooks: `src/hooks/useBodyMeasurements.ts`, `src/hooks/useBodyMetrics.ts`
- `profiles.current_weight_kg` is a profile cache updated after weight logs.
- Avoid new customer code against `user_body_metrics` or `weight_logs`.

## Health And Wearables

- Canonical aggregate table: `health_daily_metrics`
- Canonical service: `src/lib/health-service.ts`
- Shared types: `src/lib/health-types.ts`
- Google Fit / Health Connect workout fetch and persistence: `src/lib/google-fit-workout-service.ts`
- Existing hooks are adapters for UI compatibility and should delegate to the service layer.

## Subscription

- Canonical subscription state: `subscriptions`
- Wallet/subscription credits should not be inferred from UI labels.

## Wallet

- Canonical wallet balance: `customer_wallets`
- Canonical movement history: `wallet_transactions`

## Rewards

- Canonical XP/level: `profiles.xp`, `profiles.level`
- Canonical badges: `user_badges`

## Recommendation Labels

- `Next best action`: behavior, consistency, hydration, tracking, and habit guidance.
- `Smart next meal`: meal or restaurant recommendation matched to remaining nutrition budget.
