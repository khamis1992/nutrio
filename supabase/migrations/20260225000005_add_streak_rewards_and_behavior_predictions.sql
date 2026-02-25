-- Migration: Add tables for streak rewards and behavior predictions
-- Created: 2026-02-25

-- Table for tracking claimed streak rewards
CREATE TABLE IF NOT EXISTS streak_rewards_claimed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id TEXT NOT NULL,
  streak_days INTEGER NOT NULL,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('bonus_credit', 'free_meal', 'discount', 'badge')),
  reward_value NUMERIC NOT NULL DEFAULT 0,
  claimed_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, reward_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_streak_rewards_user_id ON streak_rewards_claimed(user_id);
CREATE INDEX IF NOT EXISTS idx_streak_rewards_claimed_at ON streak_rewards_claimed(claimed_at);

-- Enable RLS
ALTER TABLE streak_rewards_claimed ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own streak rewards"
  ON streak_rewards_claimed FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own streak rewards"
  ON streak_rewards_claimed FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Table for behavior predictions (if not exists)
CREATE TABLE IF NOT EXISTS behavior_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  churn_risk_score NUMERIC NOT NULL CHECK (churn_risk_score >= 0 AND churn_risk_score <= 1),
  boredom_risk_score NUMERIC NOT NULL CHECK (boredom_risk_score >= 0 AND boredom_risk_score <= 1),
  engagement_score NUMERIC NOT NULL CHECK (engagement_score >= 0 AND engagement_score <= 100),
  recommended_action TEXT NOT NULL,
  action_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '7 days')
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_behavior_predictions_user_id ON behavior_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_behavior_predictions_created_at ON behavior_predictions(created_at);

-- Enable RLS
ALTER TABLE behavior_predictions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own behavior predictions"
  ON behavior_predictions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can insert behavior predictions"
  ON behavior_predictions FOR INSERT
  WITH CHECK (true);

-- Add comments
COMMENT ON TABLE streak_rewards_claimed IS 'Tracks which streak rewards users have claimed';
COMMENT ON TABLE behavior_predictions IS 'AI-generated behavior predictions for user retention';
