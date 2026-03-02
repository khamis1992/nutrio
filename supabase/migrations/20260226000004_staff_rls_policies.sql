-- MEDIUM PRIORITY: Add staff member RLS policies and improve access control
-- Migration: 20260226000004_staff_rls_policies
-- Author: Security Audit Remediation
-- Description: Implements proper RLS policies for staff member access to restaurant data

-- First, add user_id column to staff_members table to link staff to auth.users
ALTER TABLE staff_members
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_staff_members_user_id 
ON staff_members(user_id) 
WHERE user_id IS NOT NULL;

-- Create index for restaurant lookups
CREATE INDEX IF NOT EXISTS idx_staff_members_restaurant_user 
ON staff_members(restaurant_id, user_id) 
WHERE is_active = true;

-- Create function to check if user is staff member of a restaurant
CREATE OR REPLACE FUNCTION public.is_restaurant_staff(p_restaurant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM staff_members 
        WHERE restaurant_id = p_restaurant_id 
        AND user_id = auth.uid()
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user has specific staff permission
CREATE OR REPLACE FUNCTION public.has_staff_permission(
    p_restaurant_id UUID,
    p_permission TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM staff_members sm
        JOIN staff_roles sr ON sm.role_id = sr.id
        WHERE sm.restaurant_id = p_restaurant_id 
        AND sm.user_id = auth.uid()
        AND sm.is_active = true
        AND sr.permissions @> jsonb_build_array(p_permission)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get staff member's permissions
CREATE OR REPLACE FUNCTION public.get_staff_permissions(p_restaurant_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_permissions JSONB;
BEGIN
    SELECT sr.permissions INTO v_permissions
    FROM staff_members sm
    JOIN staff_roles sr ON sm.role_id = sr.id
    WHERE sm.restaurant_id = p_restaurant_id 
    AND sm.user_id = auth.uid()
    AND sm.is_active = true;
    
    RETURN COALESCE(v_permissions, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing restaurant policies to recreate with staff access
DROP POLICY IF EXISTS "Partners can view their own restaurants" ON restaurants;
DROP POLICY IF EXISTS "Partners can manage their own restaurants" ON restaurants;
DROP POLICY IF EXISTS "Admins can manage all restaurants" ON restaurants;
DROP POLICY IF EXISTS "Staff can view assigned restaurants" ON restaurants;

-- Create comprehensive restaurant policies

-- 1. Public can view approved restaurants
DROP POLICY IF EXISTS "Anyone can view approved restaurants" ON restaurants;
CREATE POLICY "Anyone can view approved restaurants"
ON restaurants FOR SELECT
USING (approval_status = 'approved' AND is_active = true);

-- 2. Owners can view their restaurants
DROP POLICY IF EXISTS "Owners can view their restaurants" ON restaurants;
CREATE POLICY "Owners can view their restaurants"
ON restaurants FOR SELECT
USING (owner_id = auth.uid());

-- 3. Staff can view their assigned restaurants
DROP POLICY IF EXISTS "Staff can view assigned restaurants" ON restaurants;
CREATE POLICY "Staff can view assigned restaurants"
ON restaurants FOR SELECT
USING (public.is_restaurant_staff(id));

-- 4. Admins can view all restaurants
DROP POLICY IF EXISTS "Admins can view all restaurants" ON restaurants;
CREATE POLICY "Admins can view all restaurants"
ON restaurants FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- 5. Owners can update their restaurants
DROP POLICY IF EXISTS "Owners can update their restaurants" ON restaurants;
CREATE POLICY "Owners can update their restaurants"
ON restaurants FOR UPDATE
USING (owner_id = auth.uid());

-- 6. Staff with 'manage_restaurant' permission can update
DROP POLICY IF EXISTS "Staff with permission can update restaurants" ON restaurants;
CREATE POLICY "Staff with permission can update restaurants"
ON restaurants FOR UPDATE
USING (public.has_staff_permission(id, 'manage_restaurant'));

-- 7. Admins can manage all restaurants
DROP POLICY IF EXISTS "Admins can manage all restaurants" ON restaurants;
CREATE POLICY "Admins can manage all restaurants"
ON restaurants FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Update meals table policies to include staff access
DROP POLICY IF EXISTS "Partners can manage meals for their restaurants" ON meals;
DROP POLICY IF EXISTS "Anyone can view meals" ON meals;
DROP POLICY IF EXISTS "Admins can manage all meals" ON meals;

-- Recreate meals policies with staff access
DROP POLICY IF EXISTS "Anyone can view meals from approved restaurants" ON meals;
CREATE POLICY "Anyone can view meals from approved restaurants"
ON meals FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM restaurants 
        WHERE id = meals.restaurant_id 
        AND approval_status = 'approved'
    )
);

DROP POLICY IF EXISTS "Owners can manage their restaurant meals" ON meals;
CREATE POLICY "Owners can manage their restaurant meals"
ON meals FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM restaurants 
        WHERE id = meals.restaurant_id 
        AND owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Staff can manage meals with permission" ON meals;
CREATE POLICY "Staff can manage meals with permission"
ON meals FOR ALL
USING (
    public.has_staff_permission(
        (SELECT restaurant_id FROM meals WHERE id = meals.id),
        'manage_menu'
    )
);

DROP POLICY IF EXISTS "Admins can manage all meals" ON meals;
CREATE POLICY "Admins can manage all meals"
ON meals FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Update orders table policies for staff access
DROP POLICY IF EXISTS "Partners can view orders for their restaurants" ON orders;

DROP POLICY IF EXISTS "Partners and staff can view restaurant orders" ON orders;
CREATE POLICY "Partners and staff can view restaurant orders"
ON orders FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM restaurants 
        WHERE id = orders.restaurant_id 
        AND (owner_id = auth.uid() OR public.is_restaurant_staff(orders.restaurant_id))
    )
);

-- Update staff_members table policies
DROP POLICY IF EXISTS "Partners can manage their staff" ON staff_members;

DROP POLICY IF EXISTS "Owners can manage their restaurant staff" ON staff_members;
CREATE POLICY "Owners can manage their restaurant staff"
ON staff_members FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM restaurants 
        WHERE id = staff_members.restaurant_id 
        AND owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Staff with HR permission can manage staff" ON staff_members;
CREATE POLICY "Staff with HR permission can manage staff"
ON staff_members FOR ALL
USING (
    public.has_staff_permission(restaurant_id, 'manage_staff')
);

DROP POLICY IF EXISTS "Admins can manage all staff" ON staff_members;
CREATE POLICY "Admins can manage all staff"
ON staff_members FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Update staff_schedules table policies
DROP POLICY IF EXISTS "Partners can manage staff schedules" ON staff_schedules;

DROP POLICY IF EXISTS "Owners can manage staff schedules" ON staff_schedules;
CREATE POLICY "Owners can manage staff schedules"
ON staff_schedules FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM staff_members sm
        JOIN restaurants r ON sm.restaurant_id = r.id
        WHERE sm.id = staff_schedules.staff_member_id
        AND r.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Staff can view their own schedules" ON staff_schedules;
CREATE POLICY "Staff can view their own schedules"
ON staff_schedules FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM staff_members
        WHERE id = staff_schedules.staff_member_id
        AND user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Staff with scheduling permission can manage schedules" ON staff_schedules;
CREATE POLICY "Staff with scheduling permission can manage schedules"
ON staff_schedules FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM staff_members sm
        WHERE sm.id = staff_schedules.staff_member_id
        AND public.has_staff_permission(sm.restaurant_id, 'manage_schedules')
    )
);

-- Create default staff roles if they don't exist
INSERT INTO staff_roles (name, description, permissions)
VALUES 
    ('Manager', 'Restaurant manager with full access', '["manage_restaurant", "manage_menu", "manage_staff", "manage_schedules", "view_analytics", "manage_orders"]'::jsonb),
    ('Chef', 'Kitchen staff with menu and order access', '["manage_menu", "manage_orders", "view_schedules"]'::jsonb),
    ('Server', 'Front of house staff', '["view_schedules", "manage_orders"]'::jsonb),
    ('Driver', 'Delivery driver', '["view_schedules", "update_deliveries"]'::jsonb)
ON CONFLICT (name) DO UPDATE 
SET permissions = EXCLUDED.permissions;

-- Create helper function to add staff member with user link
CREATE OR REPLACE FUNCTION public.add_staff_member_with_user(
    p_restaurant_id UUID,
    p_email TEXT,
    p_first_name TEXT,
    p_last_name TEXT,
    p_role_name TEXT,
    p_hire_date DATE DEFAULT CURRENT_DATE
)
RETURNS UUID AS $$
DECLARE
    v_staff_id UUID;
    v_user_id UUID;
    v_role_id UUID;
BEGIN
    -- Get user_id from email
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = p_email;
    
    -- Get role_id
    SELECT id INTO v_role_id
    FROM staff_roles
    WHERE name = p_role_name;
    
    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Role % not found', p_role_name;
    END IF;
    
    -- Insert staff member
    INSERT INTO staff_members (
        restaurant_id,
        user_id,
        first_name,
        last_name,
        email,
        role_id,
        hire_date
    ) VALUES (
        p_restaurant_id,
        v_user_id,
        p_first_name,
        p_last_name,
        p_email,
        v_role_id,
        p_hire_date
    )
    RETURNING id INTO v_staff_id;
    
    RETURN v_staff_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view for staff with their permissions
CREATE OR REPLACE VIEW staff_members_with_permissions AS
SELECT 
    sm.*,
    sr.name as role_name,
    sr.permissions,
    r.name as restaurant_name,
    r.owner_id
FROM staff_members sm
JOIN staff_roles sr ON sm.role_id = sr.id
JOIN restaurants r ON sm.restaurant_id = r.id;

-- Secure the view
ALTER VIEW staff_members_with_permissions OWNER TO postgres;

-- Add RLS to the view (uses underlying table policies)
COMMENT ON VIEW staff_members_with_permissions IS 'Staff members with their role permissions - access controlled by underlying staff_members policies';

-- Comments
COMMENT ON public.is_restaurant_staff(UUID) IS 'Check if current user is an active staff member of the specified restaurant';
COMMENT ON public.has_staff_permission(UUID, TEXT) IS 'Check if current staff member has a specific permission';
COMMENT ON COLUMN staff_members.user_id IS 'Link to auth.users for staff member login and RLS policies';


