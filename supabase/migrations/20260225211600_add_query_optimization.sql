-- Migration: Database Query Optimization
-- Date: 2025-02-25
-- Addresses: P3-008 (Query Optimization)

-- Add missing indexes for common queries
CREATE INDEX IF NOT EXISTS idx_meals_restaurant_active 
ON meals(restaurant_id) 
WHERE is_available = true;

CREATE INDEX IF NOT EXISTS idx_orders_user_status 
ON orders(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_meal_schedules_user_date_status 
ON meal_schedules(user_id, scheduled_date, order_status);

CREATE INDEX IF NOT EXISTS idx_progress_logs_user_date 
ON progress_logs(user_id, log_date DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_type 
ON wallet_transactions(user_id, type, created_at DESC);

-- Conditionally create index for credit_transactions if table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' 
               AND table_name = 'credit_transactions') THEN
        CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_date 
        ON credit_transactions(user_id, created_at DESC);
    END IF;
END $$;

-- Create materialized view for analytics
-- Note: Extensible structure - add revenue columns as they become available
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_daily_stats AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    COUNT(DISTINCT user_id) as active_users,
    COUNT(*) as total_orders,
    0::DECIMAL as total_revenue,  -- Placeholder for when total_price column exists
    0::DECIMAL as avg_order_value  -- Placeholder for when total_price column exists
FROM orders
WHERE status NOT IN ('cancelled', 'refunded')
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_daily_stats_date 
ON analytics_daily_stats(date);

-- Function to refresh analytics
CREATE OR REPLACE FUNCTION refresh_analytics_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_daily_stats;
END;
$$;

-- Create view for slow query detection helper
CREATE OR REPLACE VIEW slow_query_candidates AS
SELECT 
    schemaname,
    tablename,
    attname as column_name,
    n_distinct,
    null_frac,
    correlation
FROM pg_stats
WHERE schemaname = 'public'
AND n_distinct < 100  -- Low cardinality columns might benefit from indexes
ORDER BY null_frac DESC;

-- Comments
COMMENT ON MATERIALIZED VIEW analytics_daily_stats IS 'Daily aggregated stats for dashboard - refresh nightly';
COMMENT ON FUNCTION refresh_analytics_stats IS 'Refresh analytics materialized view - run via cron';
