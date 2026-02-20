-- Fix RLS policies for IP Management tables
-- This ensures admins can access the data properly

-- First, let's verify the has_role function works correctly
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Drop and recreate policies for blocked_ips
DROP POLICY IF EXISTS "Admins can manage blocked IPs" ON public.blocked_ips;

CREATE POLICY "Admins can manage blocked IPs"
  ON public.blocked_ips FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Drop and recreate policies for user_ip_logs
DROP POLICY IF EXISTS "Admins can view IP logs" ON public.user_ip_logs;
DROP POLICY IF EXISTS "Users can log their IPs" ON public.user_ip_logs;

CREATE POLICY "Admins can view IP logs"
  ON public.user_ip_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can log their IPs"
  ON public.user_ip_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Also update user_roles policies to ensure admins can manage roles
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Update profiles policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));