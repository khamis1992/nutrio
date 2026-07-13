-- Driver accounts are environment-specific operational data. They are created
-- through the authenticated onboarding/admin flow, never from a migration.
DO $$
BEGIN
  RAISE NOTICE 'Skipping environment-specific driver provisioning';
END
$$;
