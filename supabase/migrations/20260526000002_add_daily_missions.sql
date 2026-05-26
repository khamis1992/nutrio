-- Daily Missions table for gamification system
CREATE TABLE IF NOT EXISTS user_daily_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  mission_date date NOT NULL,
  missions jsonb NOT NULL DEFAULT '{}'::jsonb,
  claimed_bonus boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, mission_date)
);

ALTER TABLE user_daily_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_daily_missions" ON user_daily_missions
  FOR ALL
  TO authenticated
  USING (user_id = (SELECT user_id FROM profiles WHERE user_id = auth.uid()));

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_daily_missions_user_date ON user_daily_missions(user_id, mission_date);
