-- Coach Portal: client assignments and coach role support

-- Coach-client assignments table
CREATE TABLE IF NOT EXISTS coach_client_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  client_id uuid REFERENCES profiles(user_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked')),
  invite_code text UNIQUE,
  can_view_macros boolean NOT NULL DEFAULT true,
  can_view_weight boolean NOT NULL DEFAULT true,
  can_view_meal_adherence boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(coach_id, client_id)
);

-- Indexes for lookups
CREATE INDEX IF NOT EXISTS idx_coach_assignments_coach ON coach_client_assignments(coach_id, status);
CREATE INDEX IF NOT EXISTS idx_coach_assignments_client ON coach_client_assignments(client_id, status);
CREATE INDEX IF NOT EXISTS idx_coach_assignments_invite_code ON coach_client_assignments(invite_code) WHERE invite_code IS NOT NULL;

-- Enable RLS
ALTER TABLE coach_client_assignments ENABLE ROW LEVEL SECURITY;

-- Note: All policies use auth.uid() directly to avoid circular RLS recursion
-- with the profiles table (which has a policy querying coach_client_assignments).

-- Coaches can see their own assignments
CREATE POLICY "coaches_view_own_assignments" ON coach_client_assignments
  FOR SELECT TO authenticated USING (coach_id = auth.uid());

-- Clients can see who their coaches are
CREATE POLICY "clients_view_own_assignments" ON coach_client_assignments
  FOR SELECT TO authenticated USING (client_id = auth.uid());

-- Clients can accept invites
CREATE POLICY "clients_accept_invites" ON coach_client_assignments
  FOR UPDATE TO authenticated USING (client_id = auth.uid());

-- Coaches insert assignment rows
CREATE POLICY "coaches_insert_assignments" ON coach_client_assignments
  FOR INSERT TO authenticated WITH CHECK (coach_id = auth.uid());

-- Coaches can delete their assignments
CREATE POLICY "coaches_delete_assignments" ON coach_client_assignments
  FOR DELETE TO authenticated USING (coach_id = auth.uid());

-- Coaches can update their own assignments (accept/reject)
CREATE POLICY "coaches_update_own_assignments" ON coach_client_assignments
  FOR UPDATE TO authenticated USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

-- Clients can request coaches (client-initiated discovery)
CREATE POLICY "clients_request_coaches" ON coach_client_assignments
  FOR INSERT TO authenticated
  WITH CHECK ((client_id = auth.uid()) AND (coach_id IS NOT NULL) AND (status = 'pending'::text));

-- Clients can accept by invite code
CREATE POLICY "clients_accept_invites_by_code" ON coach_client_assignments
  FOR UPDATE TO authenticated
  USING ((invite_code IS NOT NULL) AND (client_id IS NULL) AND (status = 'pending'::text))
  WITH CHECK ((client_id = auth.uid()) AND (status = 'active'::text));

-- Global read policy for authenticated users (needed for profile lookups)
CREATE POLICY "Users can view their own assignments" ON coach_client_assignments
  FOR SELECT TO authenticated USING ((coach_id = auth.uid()) OR (client_id = auth.uid()));

-- Coaches can read profiles of their clients (active or pending)
-- Uses SECURITY DEFINER function to avoid circular RLS recursion
CREATE OR REPLACE FUNCTION is_coach_of(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM coach_client_assignments
    WHERE coach_id = auth.uid() AND client_id = p_user_id AND status IN ('active', 'pending')
  );
$$;

CREATE POLICY "coaches_view_client_profiles" ON profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_coach_of(user_id));
