-- Grant admin role to khamis-1992@hotmail.com
-- This user will have full admin access to the dashboard

-- First, get the user ID from auth.users
DO $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Find the user by email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = 'khamis-1992@hotmail.com';
  
  IF target_user_id IS NOT NULL THEN
    -- Insert admin role if not exists
    INSERT INTO public.user_roles (user_id, role)
    VALUES (target_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Admin role granted to user: % (ID: %)', 'khamis-1992@hotmail.com', target_user_id;
  ELSE
    RAISE NOTICE 'User not found: khamis-1992@hotmail.com';
  END IF;
END $$;

-- Verify the role was added
SELECT 
  u.email,
  ur.role,
  ur.created_at
FROM public.user_roles ur
JOIN auth.users u ON ur.user_id = u.id
WHERE u.email = 'khamis-1992@hotmail.com';
