# SQL Commands to Create Missing Tables

Please run the following SQL commands in your Supabase SQL editor to create the missing tables:

## 1. Create Enum Types

```sql
-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('user', 'partner', 'admin');

-- Create enum for subscription status
CREATE TYPE public.subscription_status AS ENUM ('active', 'cancelled', 'expired', 'pending');

-- Create enum for subscription plan
CREATE TYPE public.subscription_plan AS ENUM ('weekly', 'monthly');

-- Create enum for order status
CREATE TYPE public.order_status AS ENUM ('pending', 'confirmed', 'preparing', 'delivered', 'cancelled');

-- Create enum for restaurant approval status
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');

-- Create enum for health goal
CREATE TYPE public.health_goal AS ENUM ('lose', 'gain', 'maintain');

-- Create enum for activity level
CREATE TYPE public.activity_level AS ENUM ('sedentary', 'light', 'moderate', 'active', 'very_active');

-- Create enum for gender
CREATE TYPE public.gender_type AS ENUM ('male', 'female');
```

## 2. Create User Roles Table

```sql
-- USER ROLES TABLE (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- User Roles policies
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
```

## 3. Create Security Functions

```sql
-- SECURITY DEFINER FUNCTION for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
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

-- Function to get current user's primary role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role 
      WHEN 'admin' THEN 1 
      WHEN 'partner' THEN 2 
      ELSE 3 
    END
  LIMIT 1
$$;
```

## 4. Create Profiles Table

```sql
-- PROFILES TABLE
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  gender gender_type,
  age INTEGER CHECK (age >= 13 AND age <= 120),
  height_cm NUMERIC(5,2) CHECK (height_cm > 0 AND height_cm < 300),
  current_weight_kg NUMERIC(5,2) CHECK (current_weight_kg > 0 AND current_weight_kg < 500),
  target_weight_kg NUMERIC(5,2) CHECK (target_weight_kg > 0 AND target_weight_kg < 500),
  health_goal health_goal,
  activity_level activity_level,
  daily_calorie_target INTEGER,
  protein_target_g INTEGER,
  carbs_target_g INTEGER,
  fat_target_g INTEGER,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
```

## 5. Create IP Management Tables

```sql
-- Blocked IPs table
CREATE TABLE blocked_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address INET NOT NULL UNIQUE,
  reason TEXT,
  blocked_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User IP logs table
CREATE TABLE user_ip_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address INET NOT NULL,
  country_code TEXT,
  country_name TEXT,
  city TEXT,
  action TEXT NOT NULL CHECK (action IN ('signup', 'login')),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_blocked_ips_ip ON blocked_ips (ip_address);
CREATE INDEX idx_blocked_ips_active ON blocked_ips (is_active);
CREATE INDEX idx_user_ip_logs_user ON user_ip_logs (user_id);
CREATE INDEX idx_user_ip_logs_ip ON user_ip_logs (ip_address);
CREATE INDEX idx_user_ip_logs_created ON user_ip_logs (created_at DESC);

-- RLS Policies
ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ip_logs ENABLE ROW LEVEL SECURITY;

-- Admin-only access to blocked_ips
CREATE POLICY "Admins can manage blocked IPs"
  ON blocked_ips FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Admin-only read access to user_ip_logs
CREATE POLICY "Admins can view IP logs"
  ON user_ip_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Users can insert their own IP logs
CREATE POLICY "Users can log their IPs"
  ON user_ip_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

## 6. Create IP Check Functions

```sql
-- Function to check if IP is blocked
CREATE OR REPLACE FUNCTION is_ip_blocked(p_ip INET)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM blocked_ips 
    WHERE ip_address = p_ip AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 7. Assign Admin Role to User

After creating the tables, run this to assign the admin role to admin@nutrio.com:

```sql
-- First, find the user ID for admin@nutrio.com
SELECT id FROM auth.users WHERE email = 'admin@nutrio.com';

-- Then, insert the admin role (replace USER_ID with the actual ID from the previous query)
INSERT INTO public.user_roles (user_id, role) 
VALUES ('USER_ID', 'admin');
```

Please run these SQL commands in your Supabase SQL editor in the order listed above.