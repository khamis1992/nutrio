-- Migration: Coach Chat Attachments
-- Enables file sharing between coaches and clients within chat conversations

-- Attachment metadata table
CREATE TABLE IF NOT EXISTS coach_chat_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES coach_messages(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  file_type text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fetching attachments for a message
CREATE INDEX IF NOT EXISTS idx_coach_attachments_message
  ON coach_chat_attachments(message_id);

-- Enable RLS
ALTER TABLE coach_chat_attachments ENABLE ROW LEVEL SECURITY;

-- Users who are part of the conversation can view attachments
CREATE POLICY "conversation_participants_view_attachments" ON coach_chat_attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_messages
      WHERE coach_messages.id = coach_chat_attachments.message_id
        AND (coach_messages.coach_id = auth.uid() OR coach_messages.client_id = auth.uid())
    )
  );

-- Users who are part of the conversation can insert attachments
CREATE POLICY "conversation_participants_insert_attachments" ON coach_chat_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coach_messages m
      WHERE m.id = message_id
        AND (m.coach_id = auth.uid() OR m.client_id = auth.uid())
    )
    AND uploaded_by = auth.uid()
  );

-- Create storage bucket for coach attachments
-- Note: Storage bucket creation is handled via Supabase Dashboard or Management API.
-- Run this SQL via supabase storage API or dashboard:
-- bucket name: coach-attachments
-- public: false
-- allowed mime types: image/png, image/jpeg, image/gif, image/webp, application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet

-- Storage RLS policies will be created when the bucket is provisioned.
-- Policy: authenticated users who are part of active coach_client_assignments can upload
-- Policy: authenticated users who are part of the conversation can download
