-- Administrative roles are environment-specific and must not be granted to a
-- named account from a production migration. Provision the initial admin with
-- the audited environment setup procedure after applying the schema.
DO $$
BEGIN
  RAISE NOTICE 'Skipping environment-specific admin role provisioning';
END
$$;
