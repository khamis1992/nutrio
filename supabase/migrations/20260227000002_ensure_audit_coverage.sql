-- Migration: Ensure comprehensive audit logging on all user data tables
-- Purpose: GDPR compliance and security monitoring

-- Verify audit schema exists
CREATE SCHEMA IF NOT EXISTS audit;

-- Enable auditing on critical tables if not already enabled
-- Using the existing audit.enable_auditing function

-- Core user data tables
DO $$
DECLARE
    tables_to_audit TEXT[] := ARRAY[
        'profiles',
        'restaurants',
        'meals',
        'orders',
        'meal_schedules',
        'subscriptions',
        'customer_wallets',
        'wallet_transactions',
        'user_addresses',
        'meal_history',
        'meal_reviews',
        'notifications',
        'drivers',
        'delivery_jobs',
        'partner_payouts',
        'partner_earnings',
        'affiliate_applications',
        'affiliate_commissions',
        'support_tickets',
        'user_roles',
        'gdpr_export_logs'
    ];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY tables_to_audit
    LOOP
        -- Check if trigger already exists
        IF NOT EXISTS (
            SELECT 1 
            FROM pg_trigger 
            WHERE tgname = 'audit_trigger' 
            AND tgrelid = (quote_ident('public') || '.' || quote_ident(t))::regclass
        ) THEN
            -- Enable auditing
            PERFORM audit.enable_auditing(t, 'public');
            RAISE NOTICE 'Enabled auditing on table: %', t;
        ELSE
            RAISE NOTICE 'Auditing already enabled on table: %', t;
        END IF;
    END LOOP;
END $$;

-- Create function to verify audit coverage
CREATE OR REPLACE FUNCTION audit.verify_audit_coverage()
RETURNS TABLE (
    schema_name TEXT,
    table_name TEXT,
    has_audit_trigger BOOLEAN,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.nspname::TEXT as schema_name,
        c.relname::TEXT as table_name,
        EXISTS (
            SELECT 1 
            FROM pg_trigger t 
            WHERE t.tgrelid = c.oid 
            AND t.tgname = 'audit_trigger'
        ) as has_audit_trigger,
        CASE 
            WHEN EXISTS (
                SELECT 1 
                FROM pg_trigger t 
                WHERE t.tgrelid = c.oid 
                AND t.tgname = 'audit_trigger'
            ) THEN 'OK'
            ELSE 'MISSING'
        END as status
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'  -- ordinary tables
    AND n.nspname = 'public'
    AND c.relname IN (
        'profiles', 'restaurants', 'meals', 'orders', 
        'meal_schedules', 'subscriptions', 'customer_wallets',
        'wallet_transactions', 'user_addresses', 'meal_history',
        'meal_reviews', 'notifications', 'drivers', 'delivery_jobs',
        'partner_payouts', 'partner_earnings', 'affiliate_applications',
        'affiliate_commissions', 'support_tickets', 'user_roles',
        'gdpr_export_logs'
    )
    ORDER BY n.nspname, c.relname;
END;
$$ LANGUAGE plpgsql;

-- Create view for audit log summary (admin use)
CREATE OR REPLACE VIEW audit.audit_summary_view AS
SELECT 
    DATE_TRUNC('day', action_timestamp) as day,
    table_name,
    action,
    COUNT(*) as action_count
FROM audit.log
WHERE action_timestamp > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', action_timestamp), table_name, action
ORDER BY day DESC, action_count DESC;

-- Add comment
COMMENT ON FUNCTION audit.verify_audit_coverage() IS 'Verifies that all critical tables have audit triggers enabled';
COMMENT ON VIEW audit.audit_summary_view IS 'Daily summary of audit log activity for monitoring';

-- Run verification
SELECT * FROM audit.verify_audit_coverage();
