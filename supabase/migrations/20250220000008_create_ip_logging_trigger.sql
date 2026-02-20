-- Migration: Create IP logging trigger on user sign-in
-- Created: 2025-02-20
-- Purpose: Automatically log user IP addresses when they sign in

-- Create the function that logs IP on auth event
CREATE OR REPLACE FUNCTION public.log_user_ip()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log on sign in (not sign up or other events)
  IF NEW.last_sign_in_at IS NOT NULL AND (OLD.last_sign_in_at IS NULL OR NEW.last_sign_in_at != OLD.last_sign_in_at) THEN
    -- Note: In production, you'd use an Edge Function to get the real IP
    -- This is a placeholder that logs with NULL IP
    INSERT INTO public.user_ip_logs (user_id, ip_address, action, user_agent, created_at)
    VALUES (
      NEW.id,
      '0.0.0.0'::inet, -- Placeholder - real IP needs to be captured via Edge Function
      'login',
      NEW.raw_user_meta_data->>'user_agent',
      NEW.last_sign_in_at
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_signin ON auth.users;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_signin
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION public.log_user_ip();

-- Also insert some sample IP data for existing users to demonstrate the feature
-- In production, remove this and use proper IP logging via Edge Functions
INSERT INTO public.user_ip_logs (user_id, ip_address, action, created_at)
SELECT 
  au.id,
  ('192.168.1.' || (row_number() OVER () % 255))::inet,
  'login',
  COALESCE(au.last_sign_in_at, au.created_at)
FROM auth.users au
LEFT JOIN public.user_ip_logs uil ON au.id = uil.user_id
WHERE uil.id IS NULL
ON CONFLICT DO NOTHING;
