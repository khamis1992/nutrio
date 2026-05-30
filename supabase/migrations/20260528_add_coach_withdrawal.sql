-- Migration: Coach Withdrawal Requests
-- Enables coaches to request bank payouts via IBAN transfer (manual admin approval)

CREATE TABLE IF NOT EXISTS coach_withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount decimal NOT NULL CHECK (amount > 0),
  bank_name text NOT NULL,
  iban text NOT NULL,
  account_holder text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processed')),
  admin_notes text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for coach's withdrawal history
CREATE INDEX IF NOT EXISTS idx_coach_withdrawals_coach
  ON coach_withdrawal_requests(coach_id, status, created_at DESC);

-- Index for admin review (pending requests across all coaches)
CREATE INDEX IF NOT EXISTS idx_coach_withdrawals_pending
  ON coach_withdrawal_requests(status, created_at)
  WHERE status = 'pending';

-- Enable RLS
ALTER TABLE coach_withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Coaches can view their own withdrawal requests
CREATE POLICY "coaches_view_own_withdrawals" ON coach_withdrawal_requests
  FOR SELECT
  TO authenticated
  USING (coach_id = auth.uid());

-- Coaches can insert their own withdrawal requests
CREATE POLICY "coaches_insert_withdrawals" ON coach_withdrawal_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (coach_id = auth.uid());

-- Admins can update any withdrawal request (approve/reject/mark processed)
CREATE POLICY "admins_manage_withdrawals" ON coach_withdrawal_requests
  FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND "role" = 'admin'));

-- Admins can view all withdrawal requests
CREATE POLICY "admins_view_withdrawals" ON coach_withdrawal_requests
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND "role" = 'admin'));

-- Add withdrawal notification type if it doesn't exist
DO $$
BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'coach_withdrawal';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Trigger: notify coach when admin changes withdrawal status
CREATE OR REPLACE FUNCTION notify_coach_withdrawal_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('approved', 'rejected') THEN
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      NEW.coach_id,
      'coach_withdrawal',
      CASE NEW.status
        WHEN 'approved' THEN 'Withdrawal approved'
        ELSE 'Withdrawal rejected'
      END,
      CASE NEW.status
        WHEN 'approved' THEN 'Your withdrawal of ' || NEW.amount::text || ' QAR has been approved and is being processed.'
        ELSE 'Your withdrawal of ' || NEW.amount::text || ' QAR was rejected. Reason: ' || COALESCE(NEW.admin_notes, 'No reason given.')
      END,
      jsonb_build_object('withdrawal_id', NEW.id, 'amount', NEW.amount, 'status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_coach_withdrawal_status ON coach_withdrawal_requests;
CREATE TRIGGER trigger_coach_withdrawal_status
  AFTER UPDATE ON coach_withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION notify_coach_withdrawal_status();
