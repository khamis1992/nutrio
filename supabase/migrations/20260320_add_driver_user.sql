-- Migration: Setup driver@nutriofuel.com as a registered driver
-- Run this in Supabase Dashboard > SQL Editor

-- Step 1: First create the user (if not exists) via the Supabase Dashboard:
-- Go to Authentication > Users > Add User > Create user with:
-- Email: driver@nutriofuel.com
-- Password: 123456789
-- Email confirm: ON

-- Step 2: After creating the user, get their ID and run:
-- Replace '<USER_ID>' with the actual user ID from step 1

-- For this example, we'll use a placeholder - update after creating user

DO $$
DECLARE
  driver_user_id UUID;
BEGIN
  -- Find the driver user by email
  SELECT id INTO driver_user_id 
  FROM auth.users 
  WHERE email = 'driver@nutriofuel.com';

  IF driver_user_id IS NULL THEN
    RAISE NOTICE 'Driver user driver@nutriofuel.com not found. Please create the user first in Supabase Dashboard > Authentication > Users > Add User';
  ELSE
    RAISE NOTICE 'Found driver user: %', driver_user_id;
    
    -- Insert driver record if not exists
    INSERT INTO drivers (user_id, full_name, phone, vehicle_type, approval_status, is_online, is_active, total_deliveries, wallet_balance)
    VALUES (driver_user_id, 'Test Driver', '+97412345678', 'car', 'approved', false, true, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Add driver role
    INSERT INTO user_roles (user_id, role)
    VALUES (driver_user_id, 'driver')
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Driver setup complete!';
  END IF;
END $$;

-- Verify the setup:
-- SELECT * FROM drivers WHERE user_id = (SELECT id FROM auth.users WHERE email = 'driver@nutriofuel.com');
