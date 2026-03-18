-- User Integrations Table for Google Fit OAuth
CREATE TABLE IF NOT EXISTS user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('google_fit', 'apple_health', 'garmin', 'fitbit')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at INTEGER NOT NULL,
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

CREATE INDEX idx_user_integrations_user_provider ON user_integrations(user_id, provider);

ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own integrations" ON user_integrations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own integrations" ON user_integrations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own integrations" ON user_integrations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own integrations" ON user_integrations FOR DELETE USING (auth.uid() = user_id);

-- Add columns to workout_sessions
ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS confirmed BOOLEAN DEFAULT false;
ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';