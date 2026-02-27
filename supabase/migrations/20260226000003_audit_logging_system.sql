-- HIGH PRIORITY: Implement comprehensive audit logging system
-- Migration: 20260226000003_audit_logging_system
-- Author: Security Audit Remediation
-- Description: Creates comprehensive audit trail for all data modifications

-- Create audit schema
CREATE SCHEMA IF NOT EXISTS audit;

-- Main audit log table
CREATE TABLE IF NOT EXISTS audit.log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Record identification
    table_schema TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    
    -- Action details
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')),
    action_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    -- Data snapshot
    old_data JSONB,
    new_data JSONB,
    changed_fields TEXT[] GENERATED ALWAYS AS (
        CASE 
            WHEN action = 'UPDATE' THEN (
                SELECT array_agg(key)
                FROM jsonb_each(old_data) old_vals
                JOIN jsonb_each(new_data) new_vals USING (key)
                WHERE old_vals.value IS DISTINCT FROM new_vals.value
            )
            WHEN action = 'INSERT' THEN (SELECT array_agg(key) FROM jsonb_each(new_data))
            WHEN action = 'DELETE' THEN (SELECT array_agg(key) FROM jsonb_each(old_data))
            ELSE NULL
        END
    ) STORED,
    
    -- User context
    changed_by UUID REFERENCES auth.users(id),
    user_role TEXT,
    session_id TEXT,
    
    -- Request context
    ip_address INET,
    user_agent TEXT,
    request_id TEXT,
    
    -- Application context
    application TEXT DEFAULT 'unknown',
    api_endpoint TEXT
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_log_table 
ON audit.log(table_schema, table_name, action_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_record 
ON audit.log(record_id, action_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_user 
ON audit.log(changed_by, action_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp 
ON audit.log(action_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_action 
ON audit.log(action, action_timestamp DESC);

-- Partition the audit log by month for performance
-- (Note: Supabase doesn't support native partitioning in all plans, 
--  but we can implement time-based cleanup instead)

-- Create function to capture audit data
CREATE OR REPLACE FUNCTION audit.capture_change()
RETURNS TRIGGER AS $$
DECLARE
    v_old_data JSONB;
    v_new_data JSONB;
    v_record_id UUID;
    v_user_role TEXT;
    v_ip_address INET;
    v_user_agent TEXT;
BEGIN
    -- Get user role
    SELECT role INTO v_user_role
    FROM public.user_roles
    WHERE user_id = auth.uid()
    ORDER BY 
        CASE role 
            WHEN 'admin' THEN 1 
            WHEN 'restaurant' THEN 2
            WHEN 'partner' THEN 3
            ELSE 4 
        END
    LIMIT 1;
    
    -- Get IP from current setting (set by application)
    BEGIN
        v_ip_address := current_setting('app.current_ip', true)::inet;
    EXCEPTION WHEN OTHERS THEN
        v_ip_address := NULL;
    END;
    
    -- Get user agent from current setting (set by application)
    BEGIN
        v_user_agent := current_setting('app.current_user_agent', true);
    EXCEPTION WHEN OTHERS THEN
        v_user_agent := NULL;
    END;
    
    -- Handle different actions
    IF TG_OP = 'INSERT' THEN
        v_new_data := to_jsonb(NEW);
        v_record_id := NEW.id;
        v_old_data := NULL;
    ELSIF TG_OP = 'UPDATE' THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_record_id := NEW.id;
    ELSIF TG_OP = 'DELETE' THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := NULL;
        v_record_id := OLD.id;
    END IF;
    
    -- Insert audit record
    INSERT INTO audit.log (
        table_schema,
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        changed_by,
        user_role,
        ip_address,
        user_agent,
        application
    ) VALUES (
        TG_TABLE_SCHEMA,
        TG_TABLE_NAME,
        v_record_id,
        TG_OP,
        v_old_data,
        v_new_data,
        auth.uid(),
        v_user_role,
        v_ip_address,
        v_user_agent,
        COALESCE(current_setting('app.application_name', true), 'unknown')
    );
    
    -- Return appropriate record
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to enable auditing on a table
CREATE OR REPLACE FUNCTION audit.enable_auditing(p_table_name TEXT, p_schema TEXT DEFAULT 'public')
RETURNS VOID AS $$
BEGIN
    -- Create trigger for the table
    EXECUTE format('
        DROP TRIGGER IF EXISTS audit_trigger ON %I.%I;
        CREATE TRIGGER audit_trigger
            AFTER INSERT OR UPDATE OR DELETE ON %I.%I
            FOR EACH ROW EXECUTE FUNCTION audit.capture_change();
    ', p_schema, p_table_name, p_schema, p_table_name);
    
    RAISE NOTICE 'Auditing enabled for %.%', p_schema, p_table_name;
END;
$$ LANGUAGE plpgsql;

-- Create function to disable auditing on a table
CREATE OR REPLACE FUNCTION audit.disable_auditing(p_table_name TEXT, p_schema TEXT DEFAULT 'public')
RETURNS VOID AS $$
BEGIN
    EXECUTE format('
        DROP TRIGGER IF EXISTS audit_trigger ON %I.%I;
    ', p_schema, p_table_name);
    
    RAISE NOTICE 'Auditing disabled for %.%', p_schema, p_table_name;
END;
$$ LANGUAGE plpgsql;

-- Enable auditing on critical partner-related tables
SELECT audit.enable_auditing('restaurants');
SELECT audit.enable_auditing('restaurant_details');
SELECT audit.enable_auditing('partner_payouts');
SELECT audit.enable_auditing('partner_earnings');
SELECT audit.enable_auditing('staff_members');
SELECT audit.enable_auditing('staff_schedules');
SELECT audit.enable_auditing('meals');
SELECT audit.enable_auditing('orders');
SELECT audit.enable_auditing('order_items');
SELECT audit.enable_auditing('users');
SELECT audit.enable_auditing('profiles');
SELECT audit.enable_auditing('subscriptions');
SELECT audit.enable_auditing('payments');

-- Create audit query helper functions

-- Get audit trail for a specific record
CREATE OR REPLACE FUNCTION audit.get_record_history(
    p_table_name TEXT,
    p_record_id UUID,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    action_timestamp TIMESTAMP WITH TIME ZONE,
    action TEXT,
    changed_by UUID,
    user_role TEXT,
    changed_fields TEXT[],
    old_values JSONB,
    new_values JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.action_timestamp,
        al.action,
        al.changed_by,
        al.user_role,
        al.changed_fields,
        al.old_data,
        al.new_data
    FROM audit.log al
    WHERE al.table_name = p_table_name
    AND al.record_id = p_record_id
    ORDER BY al.action_timestamp DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get audit trail for a specific user
CREATE OR REPLACE FUNCTION audit.get_user_activity(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    action_timestamp TIMESTAMP WITH TIME ZONE,
    table_name TEXT,
    action TEXT,
    record_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.action_timestamp,
        al.table_name,
        al.action,
        al.record_id
    FROM audit.log al
    WHERE al.changed_by = p_user_id
    ORDER BY al.action_timestamp DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get recent changes across all tables
CREATE OR REPLACE FUNCTION audit.get_recent_changes(
    p_since TIMESTAMP WITH TIME ZONE DEFAULT now() - INTERVAL '24 hours',
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    action_timestamp TIMESTAMP WITH TIME ZONE,
    table_name TEXT,
    action TEXT,
    record_id UUID,
    changed_by UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.action_timestamp,
        al.table_name,
        al.action,
        al.record_id,
        al.changed_by
    FROM audit.log al
    WHERE al.action_timestamp >= p_since
    ORDER BY al.action_timestamp DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create data retention policy function
CREATE OR REPLACE FUNCTION audit.purge_old_logs(p_retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM audit.log
    WHERE action_timestamp < now() - (p_retention_days || ' days')::interval;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RAISE NOTICE 'Purged % audit log records older than % days', v_count, p_retention_days;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Secure audit tables
ALTER TABLE audit.log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Only admins can view audit logs"
ON audit.log FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- No one can modify audit logs (append-only)
CREATE POLICY "Audit logs are append-only"
ON audit.log FOR ALL
USING (FALSE);

-- Create view for partner-specific audit (partners can see their own restaurant changes)
CREATE OR REPLACE VIEW audit.partner_audit_view AS
SELECT 
    al.*
FROM audit.log al
WHERE 
    -- User can see their own changes
    al.changed_by = auth.uid()
    OR
    -- User can see changes to their restaurant
    (al.table_name = 'restaurants' AND al.record_id IN (
        SELECT id FROM restaurants WHERE owner_id = auth.uid()
    ))
    OR
    -- User can see changes to their restaurant details
    (al.table_name = 'restaurant_details' AND al.record_id IN (
        SELECT id FROM restaurant_details 
        WHERE restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())
    ))
    OR
    -- Admins can see everything
    public.has_role(auth.uid(), 'admin');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA audit TO authenticated;
GRANT SELECT ON audit.partner_audit_view TO authenticated;

-- Create helper function for application to set context
CREATE OR REPLACE FUNCTION audit.set_request_context(
    p_ip_address TEXT,
    p_user_agent TEXT,
    p_application TEXT DEFAULT 'web'
)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_ip', p_ip_address, false);
    PERFORM set_config('app.current_user_agent', p_user_agent, false);
    PERFORM set_config('app.application_name', p_application, false);
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE audit.log IS 'Comprehensive audit trail for all data modifications';
COMMENT ON FUNCTION audit.capture_change() IS 'Trigger function that captures all changes to audited tables';
COMMENT ON FUNCTION audit.enable_auditing(TEXT, TEXT) IS 'Enable auditing on a specific table';
COMMENT ON FUNCTION audit.disable_auditing(TEXT, TEXT) IS 'Disable auditing on a specific table';
