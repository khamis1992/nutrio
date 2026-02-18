-- Database Indexes for Production Performance
-- Run this in Supabase SQL Editor

-- Orders table indexes (most critical)
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id_created_at ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_date ON orders(delivery_date);

-- Order items indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_meal_id ON order_items(meal_id);

-- Subscriptions indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Meals indexes
CREATE INDEX IF NOT EXISTS idx_meals_restaurant_id ON meals(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_meals_is_active ON meals(is_active);
CREATE INDEX IF NOT EXISTS idx_meals_dietary_tags ON meals USING gin(dietary_tags);

-- Restaurants indexes
CREATE INDEX IF NOT EXISTS idx_restaurants_approval_status ON restaurants(approval_status);
CREATE INDEX IF NOT EXISTS idx_restaurants_owner_id ON restaurants(owner_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_is_active ON restaurants(is_active);

-- Meal schedules indexes
CREATE INDEX IF NOT EXISTS idx_meal_schedules_user_id ON meal_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_schedules_scheduled_date ON meal_schedules(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_meal_schedules_order_status ON meal_schedules(order_status);

-- Wallet transactions indexes
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at) WHERE read_at IS NULL;

-- Reviews indexes
CREATE INDEX IF NOT EXISTS idx_reviews_restaurant_id ON reviews(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_reviews_meal_id ON reviews(meal_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);

-- Addresses indexes
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);

-- Favorites indexes
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_restaurant_id ON favorites(restaurant_id);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_partner_analytics_restaurant_id ON partner_analytics(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_partner_analytics_date ON partner_analytics(date);

-- Add partial index for active subscriptions (commonly queried)
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(user_id, status) 
WHERE status IN ('active', 'pending');

-- Add partial index for pending orders
CREATE INDEX IF NOT EXISTS idx_orders_pending ON orders(status, created_at) 
WHERE status IN ('pending', 'confirmed', 'preparing', 'out_for_delivery');

-- Comments explaining the indexes:
-- 1. Orders indexes: Critical for user order history, admin dashboards, driver assignments
-- 2. Subscriptions indexes: Used for validating user subscription status on every order
-- 3. Meals indexes: Critical for restaurant menu pages and filtering
-- 4. Meal schedules: Used for daily meal management and tracking
-- 5. Partial indexes: Optimize for common query patterns (active subs, pending orders)
