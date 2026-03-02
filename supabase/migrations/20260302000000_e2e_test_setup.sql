-- Migration: Create E2E Test Users
-- This creates test users for the E2E test suite

-- Note: We cannot directly insert into auth.users with password hashes
-- The tests will need to use Supabase Auth API to sign up users
-- This migration ensures the database is ready for E2E tests

-- Create test data entries if they don't exist
DO $$
BEGIN
    -- Ensure test restaurant exists for partner tests
    INSERT INTO restaurants (id, name, owner_id, status, commission_rate)
    SELECT 
        '00000000-0000-0000-0000-000000000001',
        'Test Restaurant',
        NULL,
        'active',
        15
    WHERE NOT EXISTS (
        SELECT 1 FROM restaurants WHERE id = '00000000-0000-0000-0000-000000000001'
    );

    -- Ensure test driver exists for driver tests  
    INSERT INTO drivers (id, user_id, full_name, phone, vehicle_type, status, approval_status)
    SELECT
        '00000000-0000-0000-0000-000000000002',
        NULL,
        'Test Driver',
        '+97412345678',
        'motorcycle',
        'active',
        'approved'
    WHERE NOT EXISTS (
        SELECT 1 FROM drivers WHERE id = '00000000-0000-0000-0000-000000000002'
    );
END $$;

-- Add comment explaining E2E test setup
COMMENT ON TABLE auth.users IS 'Test users for E2E: khamis--1992@hotmail.com / Khamees1992#';
