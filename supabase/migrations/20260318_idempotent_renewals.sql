-- Migration: Add idempotency tracking for subscription renewals
-- Date: 2026-03-18

-- Table to track processed renewals (prevents duplicate processing)
CREATE TABLE IF NOT EXISTS subscription_renewal_processed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  renewal_date DATE NOT NULL,
  credits_added INTEGER,
  rollover_credits INTEGER,
  status VARCHAR(50) NOT NULL DEFAULT 'success',
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_renewal_processed_subscription 
  ON subscription_renewal_processed(subscription_id, renewal_date);

CREATE INDEX IF NOT EXISTS idx_renewal_processed_idempotency 
  ON subscription_renewal_processed(idempotency_key);

-- Enable RLS
ALTER TABLE subscription_renewal_processed ENABLE ROW LEVEL SECURITY;

-- RLS policy: Service role can do everything
CREATE POLICY "Service role full access" ON subscription_renewal_processed
  FOR ALL USING (true) WITH CHECK (true);