-- Fix app_role enum to include 'restaurant' role
-- The frontend code uses 'restaurant' as the role for partners
-- but the enum only had 'partner' which is inconsistent

-- Add 'restaurant' value to app_role enum if not exists
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'restaurant';

-- Also ensure 'partner' exists for backward compatibility
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'partner';

-- Verify the enum values
SELECT enumlabel AS role_values
FROM pg_enum 
WHERE enumtypid = 'public.app_role'::regtype
ORDER BY enumsortorder;
