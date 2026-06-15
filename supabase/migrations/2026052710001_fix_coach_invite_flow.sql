-- Fix coach invite acceptance and add coach profile fields
-- 
-- Problem: When a coach creates an invite, the row has client_id=NULL and an invite_code.
-- The client accepts by updating client_id + status, but the existing RLS policy 
-- "clients_accept_invites" requires client_id = auth.uid() which can never match NULL.
-- Fix: Allow updates where invite_code is set (the row is an invite) and client_id is NULL.

-- 1. Add bio and specialties columns to profiles for coach profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS specialties text[] DEFAULT '{}';

-- 2. Verify the clients_request_coaches policy is complete (insert for client-initiated requests)
-- The original migration showed an incomplete policy. Recreate with proper WITH CHECK.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'coach_client_assignments' 
      AND policyname = 'clients_request_coaches'
  ) THEN
    DROP POLICY IF EXISTS "clients_request_coaches" ON public.coach_client_assignments;
  END IF;
END $$;

DO $$ BEGIN
CREATE POLICY "clients_request_coaches" ON public.coach_client_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id = auth.uid()
    AND coach_id IS NOT NULL
    AND status = 'pending'
  );
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;


-- 3. Fix invite acceptance: allow updating NULL client_id rows by invite_code
-- This policy allows clients to claim an invite row where client_id is NULL
-- The actual update will set client_id to auth.uid() via Profile.tsx handleConnectCoach
DO $$ BEGIN
CREATE POLICY "clients_accept_invites_by_code" ON public.coach_client_assignments
  FOR UPDATE
  TO authenticated
  USING (
    invite_code IS NOT NULL 
    AND client_id IS NULL 
    AND status = 'pending'
  )
  WITH CHECK (
    client_id = auth.uid()
    AND status = 'active'
  );
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

