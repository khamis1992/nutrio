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

-- Coaches can only see their own client assignments
CREATE POLICY "coaches_view_own_assignments" ON coach_client_assignments
  FOR SELECT
  TO authenticated
  USING (coach_id = (SELECT user_id FROM profiles WHERE user_id = auth.uid()));

-- Clients can see who their coaches are
CREATE POLICY "clients_view_own_assignments" ON coach_client_assignments
  FOR SELECT
  TO authenticated
  USING (client_id = (SELECT user_id FROM profiles WHERE user_id = auth.uid()));

-- Only clients can accept invites (via invite code)
CREATE POLICY "clients_accept_invites" ON coach_client_assignments
  FOR UPDATE
  TO authenticated
  USING (client_id = (SELECT user_id FROM profiles WHERE user_id = auth.uid()));

-- Coaches insert assignment rows (sending invites)
CREATE POLICY "coaches_insert_assignments" ON coach_client_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (coach_id = (SELECT user_id FROM profiles WHERE user_id = auth.uid()));

-- Only coaches can delete their assignments
CREATE POLICY "coaches_delete_assignments" ON coach_client_assignments
  FOR DELETE
  TO authenticated
  USING (coach_id = (SELECT user_id FROM profiles WHERE user_id = auth.uid()));

-- Clients can request coaches (client-initiated discovery)
CREATE POLICY "clients_request_coaches" ON coach_client_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (client_id = (SELECT user_id FROM profiles WHERE user_id = auth.uid()));
