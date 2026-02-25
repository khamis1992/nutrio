-- Migration: Add missing columns to subscriptions table
-- Created: 2026-02-24
-- Purpose: Add rollover_credits and freeze_days_used columns for subscription management

-- Add rollover_credits column
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS rollover_credits INTEGER DEFAULT 0;

-- Add freeze_days_used column
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS freeze_days_used INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN subscriptions.rollover_credits IS 'Number of meal credits rolled over from previous period';
COMMENT ON COLUMN subscriptions.freeze_days_used IS 'Number of freeze days used in current period';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_rollover_credits ON subscriptions(rollover_credits);
CREATE INDEX IF NOT EXISTS idx_subscriptions_freeze_days_used ON subscriptions(freeze_days_used);
