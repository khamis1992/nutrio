-- Migration: Coach Private Notes
-- Allows coaches to store private observations about their clients

CREATE TABLE IF NOT EXISTS coach_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fetching a coach's notes for a specific client in chronological order
CREATE INDEX IF NOT EXISTS idx_coach_notes_coach_client
  ON coach_notes(coach_id, client_id, created_at DESC);

-- Enable RLS
ALTER TABLE coach_notes ENABLE ROW LEVEL SECURITY;

-- Coaches can read their own notes
DO $$ BEGIN
CREATE POLICY "coaches_read_own_notes" ON coach_notes
  FOR SELECT
  TO authenticated
  USING (coach_id = auth.uid());
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;


-- Coaches can insert notes for their clients
DO $$ BEGIN
CREATE POLICY "coaches_insert_notes" ON coach_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (coach_id = auth.uid());
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;


-- Coaches can update their own notes
DO $$ BEGIN
CREATE POLICY "coaches_update_own_notes" ON coach_notes
  FOR UPDATE
  TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;


-- Coaches can delete their own notes
DO $$ BEGIN
CREATE POLICY "coaches_delete_own_notes" ON coach_notes
  FOR DELETE
  TO authenticated
  USING (coach_id = auth.uid());
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

