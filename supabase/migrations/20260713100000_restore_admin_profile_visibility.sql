-- Restore the read policy required by the admin user directory and dashboard.
-- Profile writes remain governed by the existing owner-specific policies.

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'));
