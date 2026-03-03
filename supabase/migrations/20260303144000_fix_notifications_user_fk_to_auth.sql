-- Align notifications.user_id with app auth user ids
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'notifications'
      AND constraint_name = 'notifications_user_id_fkey'
  ) THEN
    ALTER TABLE public.notifications
      DROP CONSTRAINT notifications_user_id_fkey;
  END IF;
END $$;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
