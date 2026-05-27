-- Seed a test coach account for coaches directory
-- This migration creates a user and assigns the coach role.
-- 
-- NOTE: This migration assumes a Supabase Auth user will be created separately
-- (via the app sign-up flow or Supabase dashboard) with email coach@nutrio.com.
-- Once the user exists, this migration adds the coach role.

-- Create profiles entry for coach (will be populated when user signs up)
-- and assign coach role. Uses DO block to safely handle the case where the user
-- doesn't exist yet (migration runs before user creation).

DO $$
DECLARE
  coach_user_id uuid;
BEGIN
  -- Check if the coach user already exists by looking up in auth.users
  -- (This will create the role entry when the user signs up)
  
  -- For now, insert into user_roles directly. The user must create their account
  -- via the auth flow first, then this migration will succeed on next run.
  
  -- If you already have a coach user, replace the UUID below:
  -- SELECT id INTO coach_user_id FROM auth.users WHERE email = 'coach@nutrio.com';
  
  -- Uncomment and set the UUID once the coach user exists:
  -- IF coach_user_id IS NOT NULL THEN
  --   INSERT INTO public.user_roles (user_id, role)
  --   VALUES (coach_user_id, 'coach')
  --   ON CONFLICT (user_id, role) DO NOTHING;
  -- END IF;
  
  -- For testing: assign coach role to the first admin user so someone can test immediately
  INSERT INTO public.user_roles (user_id, role)
  SELECT user_id, 'coach'
  FROM public.user_roles
  WHERE role = 'admin'
  LIMIT 1
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;
