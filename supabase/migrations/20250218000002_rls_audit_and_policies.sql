-- RLS Policy Audit and Security Hardening
-- Run this in Supabase SQL Editor to audit and strengthen security

-- ============================================
-- 1. ENABLE RLS ON ALL TABLES (if not already)
-- ============================================

-- Core tables
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Partner tables
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_analytics ENABLE ROW LEVEL SECURITY;

-- Driver tables
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_payouts ENABLE ROW LEVEL SECURITY;

-- Admin tables
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Referral tables
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_applications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. ORDERS TABLE - STRICT POLICIES
-- ============================================

-- Drop existing policies to recreate
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
DROP POLICY IF EXISTS "Users can create their own orders" ON orders;
DROP POLICY IF EXISTS "Partners can view their restaurant orders" ON orders;
DROP POLICY IF EXISTS "Drivers can view their assigned orders" ON orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;

-- Users can only view their own orders
CREATE POLICY "Users can view their own orders"
  ON orders FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own orders
CREATE POLICY "Users can create their own orders"
  ON orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own pending orders
CREATE POLICY "Users can update their own pending orders"
  ON orders FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending');

-- Partners can view orders for their restaurants
CREATE POLICY "Partners can view their restaurant orders"
  ON orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = orders.restaurant_id
      AND r.owner_id = auth.uid()
    )
  );

-- Drivers can view assigned orders
CREATE POLICY "Drivers can view their assigned orders"
  ON orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM drivers d
      WHERE d.id = orders.driver_id
      AND d.user_id = auth.uid()
    )
  );

-- Admins can do everything
CREATE POLICY "Admins can manage all orders"
  ON orders FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================
-- 3. SUBSCRIPTIONS TABLE
-- ============================================

DROP POLICY IF EXISTS "Users can view their own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can create their own subscriptions" ON subscriptions;

CREATE POLICY "Users can view their own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own subscriptions"
  ON subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all subscriptions"
  ON subscriptions FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================
-- 4. MEALS TABLE
-- ============================================

DROP POLICY IF EXISTS "Anyone can view active meals" ON meals;
DROP POLICY IF EXISTS "Partners can manage their meals" ON meals;

-- Anyone can view active meals
CREATE POLICY "Anyone can view active meals"
  ON meals FOR SELECT
  USING (is_active = true);

-- Partners can manage meals for their restaurants
CREATE POLICY "Partners can manage their meals"
  ON meals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = meals.restaurant_id
      AND r.owner_id = auth.uid()
    )
  );

-- Admins can manage all meals
CREATE POLICY "Admins can manage all meals"
  ON meals FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================
-- 5. RESTAURANTS TABLE
-- ============================================

DROP POLICY IF EXISTS "Anyone can view approved restaurants" ON restaurants;
DROP POLICY IF EXISTS "Partners can manage their restaurants" ON restaurants;

-- Anyone can view approved restaurants
CREATE POLICY "Anyone can view approved restaurants"
  ON restaurants FOR SELECT
  USING (approval_status = 'approved' AND is_active = true);

-- Partners can manage their own restaurants
CREATE POLICY "Partners can manage their restaurants"
  ON restaurants FOR ALL
  USING (owner_id = auth.uid());

-- Admins can manage all restaurants
CREATE POLICY "Admins can manage all restaurants"
  ON restaurants FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================
-- 6. CUSTOMER WALLETS TABLE
-- ============================================

DROP POLICY IF EXISTS "Users can view their own wallet" ON customer_wallets;

CREATE POLICY "Users can view their own wallet"
  ON customer_wallets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own wallet"
  ON customer_wallets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all wallets"
  ON customer_wallets FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================
-- 7. WALLET TRANSACTIONS TABLE
-- ============================================

DROP POLICY IF EXISTS "Users can view their own transactions" ON wallet_transactions;

CREATE POLICY "Users can view their own transactions"
  ON wallet_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customer_wallets cw
      WHERE cw.id = wallet_transactions.wallet_id
      AND cw.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all transactions"
  ON wallet_transactions FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================
-- 8. NOTIFICATIONS TABLE
-- ============================================

DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;

CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (true); -- Allow system/edge functions to create

-- ============================================
-- 9. ADDRESSES TABLE
-- ============================================

DROP POLICY IF EXISTS "Users can manage their own addresses" ON addresses;

CREATE POLICY "Users can manage their own addresses"
  ON addresses FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- 10. FAVORITES TABLE
-- ============================================

DROP POLICY IF EXISTS "Users can manage their own favorites" ON favorites;

CREATE POLICY "Users can manage their own favorites"
  ON favorites FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- 11. SECURITY FUNCTIONS
-- ============================================

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = is_admin.user_id
    AND admin_users.is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user owns restaurant
CREATE OR REPLACE FUNCTION owns_restaurant(user_id UUID, restaurant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM restaurants
    WHERE restaurants.id = owns_restaurant.restaurant_id
    AND restaurants.owner_id = owns_restaurant.user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 12. AUDIT LOG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL,
  user_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Only admins can view audit logs"
  ON security_audit_log FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================
-- 13. SECURITY RECOMMENDATIONS
-- ============================================

/*
RECOMMENDATIONS FOR PRODUCTION:

1. ENABLE AUDIT LOGGING:
   - Set up triggers to log all changes to sensitive tables
   - Monitor failed auth attempts
   - Log admin actions

2. RATE LIMITING:
   - Implement rate limiting on auth endpoints
   - Limit password reset attempts
   - Throttle API calls per user

3. ADDITIONAL SECURITY:
   - Enable MFA for admin accounts
   - Use Row Level Security for all tables
   - Validate all inputs server-side
   - Use prepared statements to prevent SQL injection
   - Enable SSL/TLS for all connections

4. MONITORING:
   - Set up alerts for suspicious activity
   - Monitor for privilege escalation attempts
   - Track failed login attempts
   - Alert on unusual data access patterns

5. COMPLIANCE:
   - Implement data retention policies
   - Enable GDPR-compliant data deletion
   - Audit data access regularly
   - Document all security procedures
*/

-- ============================================
-- 14. VERIFICATION QUERIES (run these to verify)
-- ============================================

/*
-- Check RLS is enabled on all tables:
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = true;

-- List all policies:
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public';

-- Check for tables without RLS:
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = false
AND tablename NOT IN ('schema_migrations', 'spatial_ref_sys');
*/
