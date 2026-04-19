-- Google Fit Integration: User OAuth Tokens Table
-- Enables storing Google Fit OAuth tokens for automatic workout sync

CREATE TABLE IF NOT EXISTS user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('google_fit', 'apple_health', 'garmin', 'fitbit')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at INTEGER NOT NULL, -- Unix timestamp
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, provider)
);

-- Index for quick lookups
CREATE INDEX idx_user_integrations_user_provider ON user_integrations(user_id, provider);

-- RLS policies
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

-- Users can only see their own integrations
CREATE POLICY "Users can view own integrations" ON user_integrations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own integrations" ON user_integrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integrations" ON user_integrations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own integrations" ON user_integrations
  FOR DELETE USING (auth.uid() = user_id);

-- Add confirmed column to workout_sessions if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workout_sessions' AND column_name = 'confirmed'
  ) THEN
    ALTER TABLE workout_sessions ADD COLUMN confirmed BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Add source column to track workout origin
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workout_sessions' AND column_name = 'source'
  ) THEN
    ALTER TABLE workout_sessions ADD COLUMN source TEXT DEFAULT 'manual' 
      CHECK (source IN ('manual', 'google_fit', 'apple_health', 'garmin', 'auto_detected'));
  END IF;
END $$;