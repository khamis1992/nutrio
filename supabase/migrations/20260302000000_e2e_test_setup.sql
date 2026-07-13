-- E2E fixtures must be seeded only in an isolated test environment. Production
-- migrations must not create synthetic restaurants, drivers, or auth accounts.
DO $$
BEGIN
  RAISE NOTICE 'Skipping E2E fixtures in schema migration';
END
$$;
