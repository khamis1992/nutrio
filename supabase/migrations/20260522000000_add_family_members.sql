-- Migration: Add family_members table and subscriptions columns
-- Created: 2026-05-22

CREATE TABLE IF NOT EXISTS family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  main_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  gender TEXT,
  birth_year INTEGER,
  dietary_preferences TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS max_family_members INTEGER DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS family_allowance_multiplier NUMERIC DEFAULT 1.0;

ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own family members"
  ON family_members
  FOR SELECT
  USING (auth.uid() = main_user_id);

CREATE POLICY "Users can insert their own family members"
  ON family_members
  FOR INSERT
  WITH CHECK (auth.uid() = main_user_id);

CREATE POLICY "Users can update their own family members"
  ON family_members
  FOR UPDATE
  USING (auth.uid() = main_user_id);

CREATE POLICY "Users can delete their own family members"
  ON family_members
  FOR DELETE
  USING (auth.uid() = main_user_id);

CREATE INDEX IF NOT EXISTS idx_family_members_main_user_id ON family_members(main_user_id);
