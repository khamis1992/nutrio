-- CRITICAL FIX: Enable RLS on user_nutrition_log and fix other security issues
-- Migration: 20260226000008_fix_rls_and_security_issues
-- Author: Security Audit Remediation
-- Description: Fixes security vulnerabilities identified in audit

-- Fix 1: Enable RLS on user_nutrition_log (CRITICAL - was disabled)
ALTER TABLE user_nutrition_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_nutrition_log
DROP POLICY IF EXISTS "Users can view their own nutrition logs" ON user_nutrition_log;
CREATE POLICY "Users can view their own nutrition logs"
ON user_nutrition_log FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own nutrition logs" ON user_nutrition_log;
CREATE POLICY "Users can insert their own nutrition logs"
ON user_nutrition_log FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own nutrition logs" ON user_nutrition_log;
CREATE POLICY "Users can update their own nutrition logs"
ON user_nutrition_log FOR UPDATE
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own nutrition logs" ON user_nutrition_log;
CREATE POLICY "Users can delete their own nutrition logs"
ON user_nutrition_log FOR DELETE
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all nutrition logs" ON user_nutrition_log;
CREATE POLICY "Admins can manage all nutrition logs"
ON user_nutrition_log FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Fix 2: Add data retention policy configuration
CREATE TABLE IF NOT EXISTS data_retention.policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL UNIQUE,
    retention_days INTEGER NOT NULL,
    purge_policy TEXT NOT NULL DEFAULT 'soft_delete', -- 'soft_delete', 'hard_delete', 'archive'
    archive_table TEXT,
    is_active BOOLEAN DEFAULT true,
    last_purged_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create schema for data retention
CREATE SCHEMA IF NOT EXISTS data_retention;

-- Insert default retention policies
INSERT INTO data_retention.policies (table_name, retention_days, purge_policy)
VALUES 
    ('user_ip_logs', 365, 'hard_delete'),
    ('api_logs', 90, 'hard_delete'),
    ('platform_logs', 30, 'hard_delete'),
    ('notification_queue', 7, 'hard_delete'),
    ('rate_limit.tracking', 7, 'hard_delete'),
    ('rate_limit.violations', 90, 'hard_delete'),
    ('audit.log', 2555, 'archive'), -- 7 years for compliance
    ('soft_delete.trash', 365, 'hard_delete')
ON CONFLICT (table_name) DO UPDATE SET
    retention_days = EXCLUDED.retention_days,
    purge_policy = EXCLUDED.purge_policy;

-- Create function to purge data based on policy
CREATE OR REPLACE FUNCTION data_retention.purge_old_data(
    p_dry_run BOOLEAN DEFAULT true
)
RETURNS TABLE (
    table_name TEXT,
    records_affected INTEGER,
    action_taken TEXT
) AS $$
DECLARE
    v_policy RECORD;
    v_count INTEGER;
    v_archive_table TEXT;
BEGIN
    FOR v_policy IN 
        SELECT * FROM data_retention.policies WHERE is_active = true
    LOOP
        v_count := 0;
        
        IF v_policy.table_name = 'user_ip_logs' THEN
            IF p_dry_run THEN
                SELECT COUNT(*) INTO v_count
                FROM user_ip_logs
                WHERE created_at < now() - (v_policy.retention_days || ' days')::interval;
            ELSE
                DELETE FROM user_ip_logs
                WHERE created_at < now() - (v_policy.retention_days || ' days')::interval;
                GET DIAGNOSTICS v_count = ROW_COUNT;
            END IF;
            
        ELSIF v_policy.table_name = 'api_logs' THEN
            IF p_dry_run THEN
                SELECT COUNT(*) INTO v_count
                FROM api_logs
                WHERE created_at < now() - (v_policy.retention_days || ' days')::interval;
            ELSE
                DELETE FROM api_logs
                WHERE created_at < now() - (v_policy.retention_days || ' days')::interval;
                GET DIAGNOSTICS v_count = ROW_COUNT;
            END IF;
            
        ELSIF v_policy.table_name = 'platform_logs' THEN
            IF p_dry_run THEN
                SELECT COUNT(*) INTO v_count
                FROM platform_logs
                WHERE created_at < now() - (v_policy.retention_days || ' days')::interval;
            ELSE
                DELETE FROM platform_logs
                WHERE created_at < now() - (v_policy.retention_days || ' days')::interval;
                GET DIAGNOSTICS v_count = ROW_COUNT;
            END IF;
            
        ELSIF v_policy.table_name = 'notification_queue' THEN
            IF p_dry_run THEN
                SELECT COUNT(*) INTO v_count
                FROM notification_queue
                WHERE created_at < now() - (v_policy.retention_days || ' days')::interval;
            ELSE
                DELETE FROM notification_queue
                WHERE created_at < now() - (v_policy.retention_days || ' days')::interval;
                GET DIAGNOSTICS v_count = ROW_COUNT;
            END IF;
            
        ELSIF v_policy.purge_policy = 'archive' THEN
            -- For audit logs, archive to cold storage (simplified - in production use S3/etc)
            v_archive_table := v_policy.table_name || '_archive_' || to_char(now(), 'YYYY_MM');
            
            IF p_dry_run THEN
                SELECT COUNT(*) INTO v_count
                FROM audit.log
                WHERE action_timestamp < now() - (v_policy.retention_days || ' days')::interval;
            ELSE
                -- Create archive table if not exists
                EXECUTE format('
                    CREATE TABLE IF NOT EXISTS %I (LIKE audit.log INCLUDING ALL);
                ', v_archive_table);
                
                -- Move old records to archive
                EXECUTE format('
                    INSERT INTO %I SELECT * FROM audit.log
                    WHERE action_timestamp < now() - (%L || '' days'')::interval;
                ', v_archive_table, v_policy.retention_days);
                
                -- Delete from main table
                DELETE FROM audit.log
                WHERE action_timestamp < now() - (v_policy.retention_days || ' days')::interval;
                GET DIAGNOSTICS v_count = ROW_COUNT;
            END IF;
        END IF;
        
        RETURN QUERY SELECT v_policy.table_name, v_count, 
            CASE WHEN p_dry_run THEN 'dry_run' ELSE v_policy.purge_policy END;
        
        -- Update last purged timestamp
        IF NOT p_dry_run THEN
            UPDATE data_retention.policies
            SET last_purged_at = now()
            WHERE id = v_policy.id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 3: Add failed authentication attempt tracking
CREATE TABLE IF NOT EXISTS security.failed_auth_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT,
    ip_address INET NOT NULL,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    failure_reason TEXT,
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_failed_auth_ip 
ON security.failed_auth_attempts(ip_address, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_failed_auth_email 
ON security.failed_auth_attempts(email, attempted_at DESC);

-- Function to log failed auth attempt
CREATE OR REPLACE FUNCTION security.log_failed_auth(
    p_email TEXT,
    p_failure_reason TEXT DEFAULT 'invalid_credentials'
)
RETURNS VOID AS $$
DECLARE
    v_ip_address INET;
BEGIN
    BEGIN
        v_ip_address := current_setting('app.current_ip', true)::inet;
    EXCEPTION WHEN OTHERS THEN
        v_ip_address := NULL;
    END;
    
    INSERT INTO security.failed_auth_attempts (
        email,
        ip_address,
        failure_reason,
        user_agent
    ) VALUES (
        p_email,
        v_ip_address,
        p_failure_reason,
        current_setting('app.current_user_agent', true)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if IP should be blocked due to failed attempts
CREATE OR REPLACE FUNCTION security.should_block_ip(p_ip_address INET)
RETURNS BOOLEAN AS $$
DECLARE
    v_recent_failures INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_recent_failures
    FROM security.failed_auth_attempts
    WHERE ip_address = p_ip_address
    AND attempted_at > now() - INTERVAL '15 minutes';
    
    -- Block if more than 5 failures in 15 minutes
    RETURN v_recent_failures >= 5;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add RLS to new tables
ALTER TABLE data_retention.policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.failed_auth_attempts ENABLE ROW LEVEL SECURITY;

-- Only admins can manage retention policies
DROP POLICY IF EXISTS "Only admins can manage retention policies" ON data_retention.policies;
CREATE POLICY "Only admins can manage retention policies"
ON data_retention.policies FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can view failed auth attempts
DROP POLICY IF EXISTS "Only admins can view failed auth attempts" ON security.failed_auth_attempts;
CREATE POLICY "Only admins can view failed auth attempts"
ON security.failed_auth_attempts FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Comments
COMMENT ON TABLE data_retention.policies IS 'Data retention for GDPR/privacy compliance';
COMMENT ON TABLE security.failed_auth_attempts IS 'Log of failed authentication attempts for security monitoring';
COMMENT ON security.log_failed_auth IS 'Log a failed authentication attempt';
COMMENT ON security.should_block_ip IS 'Check if IP should be blocked due to excessive failures';


