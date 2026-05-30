-- Migration: AI Report Cache Table
-- Caches generated report content per user per week to avoid redundant API calls.
-- At 1000 users this saves ~3500 API calls/week.

CREATE TABLE IF NOT EXISTS ai_report_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  data_hash text NOT NULL,
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_ai_report_cache_user_week
  ON ai_report_cache(user_id, week_start DESC);

ALTER TABLE ai_report_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_report_cache" ON ai_report_cache
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
