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

## Order Status Semantics

- Single enum `order_status`: `pending → confirmed → preparing → ready_for_pickup → picked_up → out_for_delivery → delivered → completed` (`cancelled` at any point).
- `delivered` is set by the delivery side when the order reaches the customer. `completed` is set by the customer's explicit confirmation (`customer_confirm_order`). An order is not financially closed between the two states; do not treat `delivered` as final.
- Kitchen item statuses live in `kitchen_queue_items` (`queued → preparing → ready`) and are a separate, item-level model. `partner_update_kitchen_item_status` is the only write path and it promotes the parent status automatically: first item `preparing` promotes the order to `preparing`; when every key in `p_all_item_keys` is `ready`, an `order`-source parent is promoted to `ready_for_pickup` (a `meal_schedule` parent to `ready`). Callers MUST pass the full expected key list in `p_all_item_keys`; without it no promotion happens.
- Delivery and consumption are separate facts: delivery never writes nutrition. Consumption is the append-only, portion-aware lifecycle behind the `consumptionLifecycle` flag.

## AI Service Architecture

- Conversational AI goes through the `ai-router` edge function, which owns provider keys and per-task policies for exactly three tasks: `weekly_report`, `meal_plan`, `nutrition_coach`. Client code uses `runAiTask` from `src/lib/ai-router.ts`.
- `ai-coach` is a conversation/memory layer, not a model path: it persists threads and memories, enforces consent (`ai_data_consents`, policy `2026-07-health-ai-v1`) and idempotency, then delegates generation to `ai-router` task `nutrition_coach` via server-side fetch. Never call a provider directly from `ai-coach`.
- Vision and utility AI functions (`analyze-meal-image`, `analyze-blood-work`, `generate-ai-insight`, `similar-meals`, `predict-nutrition`, `recommend-meals`, `translate-meal`, `adaptive-goals`) call providers directly and are NOT routed through `ai-router`. They share the `_shared/security.ts` guards (authentication, `enforceRateLimit`, consent/budget where applicable). New vision tasks should follow the same shared-guard pattern; do not claim they are centrally routed.
- The phrase "all AI goes through ai-router" refers to the three conversational tasks only. Keep provider keys out of the browser in all cases.
