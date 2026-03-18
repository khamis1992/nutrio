-- Add snack tracking columns
-- subscription_plans: how many snacks are included in the plan
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS snacks_per_month INTEGER DEFAULT 0;

-- subscriptions: track snack allocation and usage per month
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS snacks_per_month INTEGER,
  ADD COLUMN IF NOT EXISTS snacks_used_this_month INTEGER DEFAULT 0;

-- When a subscription is created/renewed, copy the plan's snacks_per_month
-- into the subscription row so it can be tracked independently.
-- Backfill existing active subscriptions from their plan.
UPDATE subscriptions s
SET snacks_per_month = COALESCE(
  (SELECT sp.snacks_per_month FROM subscription_plans sp WHERE sp.tier = s.tier LIMIT 1),
  0
)
WHERE s.snacks_per_month IS NULL;
