-- LOW PRIORITY: Add missing composite indexes for performance optimization
-- Migration: 20260226000007_performance_indexes
-- Author: Security Audit Remediation
-- Description: Adds composite and partial indexes to optimize common query patterns

-- Restaurant-related composite indexes

-- Index for restaurant queries with owner and status
CREATE INDEX IF NOT EXISTS idx_restaurants_owner_status 
ON restaurants(owner_id, approval_status) 
WHERE deleted_at IS NULL;

-- Index for restaurant search with location
CREATE INDEX IF NOT EXISTS idx_restaurants_location_status 
ON restaurants(location, approval_status) 
WHERE is_active = true AND deleted_at IS NULL;

-- Index for partner earnings queries (common reporting pattern)
CREATE INDEX IF NOT EXISTS idx_partner_earnings_restaurant_date 
ON partner_earnings(restaurant_id, created_at DESC);

-- Index for partner earnings by status and date
CREATE INDEX IF NOT EXISTS idx_partner_earnings_status_date 
ON partner_earnings(status, created_at DESC) 
WHERE status = 'pending';

-- Index for partner payouts
CREATE INDEX IF NOT EXISTS idx_partner_payouts_restaurant_date 
ON partner_payouts(restaurant_id, period_start DESC, period_end DESC);

-- Index for payouts by status
CREATE INDEX IF NOT EXISTS idx_partner_payouts_status_created 
ON partner_payouts(status, created_at DESC);

-- Order-related composite indexes

-- Index for restaurant order queries
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status 
ON orders(restaurant_id, status, created_at DESC);

-- Index for user order history
CREATE INDEX IF NOT EXISTS idx_orders_user_status 
ON orders(user_id, status, created_at DESC);

-- Index for pending orders
CREATE INDEX IF NOT EXISTS idx_orders_pending 
ON orders(created_at DESC) 
WHERE status IN ('pending', 'confirmed', 'preparing');

-- Meal-related composite indexes

-- Index for restaurant meals with availability
CREATE INDEX IF NOT EXISTS idx_meals_restaurant_active 
ON meals(restaurant_id, created_at DESC) 
WHERE deleted_at IS NULL;

-- Staff-related composite indexes

-- Index for active staff by restaurant
CREATE INDEX IF NOT EXISTS idx_staff_members_restaurant_active 
ON staff_members(restaurant_id, hire_date DESC) 
WHERE is_active = true;

-- Index for staff schedules
CREATE INDEX IF NOT EXISTS idx_staff_schedules_date 
ON staff_schedules(schedule_date, start_time) 
WHERE status = 'scheduled';

-- User-related composite indexes

-- Index for user roles lookup
CREATE INDEX IF NOT EXISTS idx_user_roles_user_lookup 
ON user_roles(user_id, role);

-- Index for user IP logs
CREATE INDEX IF NOT EXISTS idx_user_ip_logs_user_action 
ON user_ip_logs(user_id, action, created_at DESC);

-- Index for blocked IPs
CREATE INDEX IF NOT EXISTS idx_blocked_ips_active_lookup 
ON blocked_ips(ip_address) 
WHERE is_active = true;

-- Subscription-related indexes

-- Index for active subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_active 
ON subscriptions(user_id, status) 
WHERE status IN ('active', 'pending');

-- Index for subscription renewal dates
CREATE INDEX IF NOT EXISTS idx_subscriptions_renewal 
ON subscriptions(current_period_end) 
WHERE status = 'active';

-- Audit log indexes (for the new audit system)

-- Index for audit log queries by table and time
CREATE INDEX IF NOT EXISTS idx_audit_log_table_time 
ON audit.log(table_schema, table_name, action_timestamp DESC);

-- Index for audit log by user
CREATE INDEX IF NOT EXISTS idx_audit_log_user_time 
ON audit.log(changed_by, action_timestamp DESC);

-- Index for audit log by record
CREATE INDEX IF NOT EXISTS idx_audit_log_record_time 
ON audit.log(record_id, action_timestamp DESC);

-- Rate limiting indexes

-- Index for rate limit cleanup
CREATE INDEX IF NOT EXISTS idx_rate_limit_tracking_cleanup 
ON rate_limit.tracking(window_start) 
WHERE window_start < now() - INTERVAL '1 day';

-- Soft delete indexes

-- Index for trash cleanup
CREATE INDEX IF NOT EXISTS idx_soft_delete_trash_cleanup 
ON soft_delete.trash(permanently_delete_at) 
WHERE permanently_delete_at < now() AND restored_at IS NULL;

-- Partial indexes for common filter patterns

-- Index for restaurants pending approval
CREATE INDEX IF NOT EXISTS idx_restaurants_pending_approval 
ON restaurants(created_at DESC) 
WHERE approval_status = 'pending';

-- Index for featured listings by restaurant
CREATE INDEX IF NOT EXISTS idx_featured_listings_restaurant 
ON featured_listings(restaurant_id, start_date DESC, end_date DESC) 
WHERE is_active = true;

-- Index for inventory items
CREATE INDEX IF NOT EXISTS idx_inventory_items_restaurant 
ON inventory_items(restaurant_id, current_quantity) 
WHERE current_quantity <= minimum_quantity;

-- Index for restaurant reviews
CREATE INDEX IF NOT EXISTS idx_restaurant_reviews_restaurant_rating 
ON restaurant_reviews(restaurant_id, rating DESC, created_at DESC);

-- Index for meal schedules
CREATE INDEX IF NOT EXISTS idx_meal_schedules_date_restaurant 
ON meal_schedules(schedule_date, restaurant_id) 
WHERE status = 'active';

-- Index for deliveries
CREATE INDEX IF NOT EXISTS idx_deliveries_status_driver 
ON deliveries(status, driver_id) 
WHERE status IN ('assigned', 'picked_up', 'in_transit');

-- Index for wallet transactions
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_recent 
ON wallet_transactions(user_id, created_at DESC);

-- Analyze tables after index creation
ANALYZE restaurants;
ANALYZE partner_earnings;
ANALYZE partner_payouts;
ANALYZE orders;
ANALYZE meals;
ANALYZE staff_members;
ANALYZE user_roles;
ANALYZE subscriptions;
ANALYZE audit.log;

-- Add comments
COMMENT ON INDEX idx_restaurants_owner_status IS 'Optimizes queries for partner dashboard';
COMMENT ON INDEX idx_partner_earnings_restaurant_date IS 'Optimizes partner earnings reports';
COMMENT ON INDEX idx_orders_restaurant_status IS 'Optimizes restaurant order management';
COMMENT ON INDEX idx_subscriptions_user_active IS 'Optimizes subscription status checks';
