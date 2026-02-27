-- MEDIUM PRIORITY: Implement rate limiting enforcement for API and database operations
-- Migration: 20260226000006_rate_limiting_enforcement
-- Author: Security Audit Remediation
-- Description: Comprehensive rate limiting at database level and API level

-- Create rate limiting schema
CREATE SCHEMA IF NOT EXISTS rate_limit;

-- Rate limit configuration table
CREATE TABLE IF NOT EXISTS rate_limit.config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    limit_name TEXT NOT NULL UNIQUE,
    requests_per_window INTEGER NOT NULL,
    window_minutes INTEGER NOT NULL DEFAULT 60,
    block_duration_minutes INTEGER DEFAULT 60,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert default rate limits
INSERT INTO rate_limit.config (limit_name, requests_per_window, window_minutes, block_duration_minutes, description)
VALUES 
    ('auth_login', 5, 15, 60, 'Login attempts per IP'),
    ('auth_signup', 3, 60, 1440, 'Signup attempts per IP'),
    ('api_general', 1000, 60, 60, 'General API requests per user'),
    ('api_partner', 10000, 60, 60, 'Partner API requests per key'),
    ('password_reset', 3, 60, 60, 'Password reset requests per email'),
    ('order_create', 30, 60, 30, 'Order creation per user'),
    ('meal_create', 50, 60, 30, 'Meal creation per restaurant'),
    ('export_data', 5, 60, 120, 'Data export requests per user')
ON CONFLICT (limit_name) DO UPDATE SET
    requests_per_window = EXCLUDED.requests_per_window,
    window_minutes = EXCLUDED.window_minutes,
    description = EXCLUDED.description;

-- Rate limit tracking table
CREATE TABLE IF NOT EXISTS rate_limit.tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    limit_name TEXT NOT NULL REFERENCES rate_limit.config(limit_name),
    identifier TEXT NOT NULL, -- IP address, user_id, or api_key
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    request_count INTEGER DEFAULT 0,
    blocked_until TIMESTAMP WITH TIME ZONE,
    UNIQUE(limit_name, identifier, window_start)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_rate_limit_lookup 
ON rate_limit.tracking(limit_name, identifier, window_start DESC);

CREATE INDEX IF NOT EXISTS idx_rate_limit_blocked 
ON rate_limit.tracking(blocked_until) 
WHERE blocked_until IS NOT NULL;

-- Rate limit violations log
CREATE TABLE IF NOT EXISTS rate_limit.violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    limit_name TEXT NOT NULL,
    identifier TEXT NOT NULL,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    ip_address INET,
    user_agent TEXT,
    endpoint TEXT
);

CREATE INDEX IF NOT EXISTS idx_violations_identifier 
ON rate_limit.violations(identifier, attempted_at DESC);

-- Function to check and enforce rate limit
CREATE OR REPLACE FUNCTION rate_limit.check_and_increment(
    p_limit_name TEXT,
    p_identifier TEXT,
    p_increment BOOLEAN DEFAULT true
)
RETURNS TABLE (
    allowed BOOLEAN,
    remaining INTEGER,
    reset_at TIMESTAMP WITH TIME ZONE,
    blocked_until TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    v_config RECORD;
    v_tracking RECORD;
    v_window_start TIMESTAMP WITH TIME ZONE;
    v_new_count INTEGER;
BEGIN
    -- Get config
    SELECT * INTO v_config
    FROM rate_limit.config
    WHERE limit_name = p_limit_name AND is_active = true;
    
    IF v_config IS NULL THEN
        -- No limit configured, allow
        RETURN QUERY SELECT TRUE, NULL::INTEGER, NULL::TIMESTAMP WITH TIME ZONE, NULL::TIMESTAMP WITH TIME ZONE;
        RETURN;
    END IF;
    
    -- Calculate window start
    v_window_start := date_trunc('minute', now()) 
        - (EXTRACT(MINUTE FROM now())::int % v_config.window_minutes || ' minutes')::interval;
    
    -- Get or create tracking record
    SELECT * INTO v_tracking
    FROM rate_limit.tracking
    WHERE limit_name = p_limit_name
    AND identifier = p_identifier
    AND window_start = v_window_start;
    
    IF v_tracking IS NULL THEN
        -- New window
        INSERT INTO rate_limit.tracking (limit_name, identifier, window_start, request_count)
        VALUES (p_limit_name, p_identifier, v_window_start, CASE WHEN p_increment THEN 1 ELSE 0 END)
        RETURNING * INTO v_tracking;
    ELSIF v_tracking.blocked_until IS NOT NULL AND v_tracking.blocked_until > now() THEN
        -- Currently blocked
        RETURN QUERY SELECT 
            FALSE, 
            0, 
            v_window_start + (v_config.window_minutes || ' minutes')::interval,
            v_tracking.blocked_until;
        RETURN;
    ELSIF p_increment THEN
        -- Increment counter
        UPDATE rate_limit.tracking
        SET request_count = request_count + 1
        WHERE id = v_tracking.id
        RETURNING * INTO v_tracking;
    END IF;
    
    -- Check if limit exceeded
    IF v_tracking.request_count > v_config.requests_per_window THEN
        -- Block the identifier
        UPDATE rate_limit.tracking
        SET blocked_until = now() + (v_config.block_duration_minutes || ' minutes')::interval
        WHERE id = v_tracking.id;
        
        -- Log violation
        INSERT INTO rate_limit.violations (limit_name, identifier, endpoint)
        VALUES (p_limit_name, p_identifier, current_setting('app.current_endpoint', true));
        
        RETURN QUERY SELECT 
            FALSE, 
            0, 
            v_window_start + (v_config.window_minutes || ' minutes')::interval,
            now() + (v_config.block_duration_minutes || ' minutes')::interval;
        RETURN;
    END IF;
    
    -- Allowed
    RETURN QUERY SELECT 
        TRUE, 
        v_config.requests_per_window - v_tracking.request_count,
        v_window_start + (v_config.window_minutes || ' minutes')::interval,
        NULL::TIMESTAMP WITH TIME ZONE;
END;
$$ LANGUAGE plpgsql;

-- Function to check rate limit without incrementing (for pre-flight checks)
CREATE OR REPLACE FUNCTION rate_limit.check_only(
    p_limit_name TEXT,
    p_identifier TEXT
)
RETURNS TABLE (
    allowed BOOLEAN,
    remaining INTEGER,
    reset_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    v_result RECORD;
BEGIN
    SELECT * INTO v_result
    FROM rate_limit.check_and_increment(p_limit_name, p_identifier, false);
    
    RETURN QUERY SELECT v_result.allowed, v_result.remaining, v_result.reset_at;
END;
$$ LANGUAGE plpgsql;

-- Function to manually block an identifier
CREATE OR REPLACE FUNCTION rate_limit.block_identifier(
    p_limit_name TEXT,
    p_identifier TEXT,
    p_duration_minutes INTEGER DEFAULT 60
)
RETURNS VOID AS $$
DECLARE
    v_config RECORD;
    v_window_start TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get config for window calculation
    SELECT * INTO v_config
    FROM rate_limit.config
    WHERE limit_name = p_limit_name;
    
    v_window_start := date_trunc('minute', now()) 
        - (EXTRACT(MINUTE FROM now())::int % COALESCE(v_config.window_minutes, 60) || ' minutes')::interval;
    
    INSERT INTO rate_limit.tracking (limit_name, identifier, window_start, blocked_until)
    VALUES (p_limit_name, p_identifier, v_window_start, now() + (p_duration_minutes || ' minutes')::interval)
    ON CONFLICT (limit_name, identifier, window_start)
    DO UPDATE SET blocked_until = now() + (p_duration_minutes || ' minutes')::interval;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to unblock an identifier
CREATE OR REPLACE FUNCTION rate_limit.unblock_identifier(
    p_limit_name TEXT,
    p_identifier TEXT
)
RETURNS VOID AS $$
BEGIN
    UPDATE rate_limit.tracking
    SET blocked_until = NULL
    WHERE limit_name = p_limit_name
    AND identifier = p_identifier
    AND blocked_until > now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old tracking records
CREATE OR REPLACE FUNCTION rate_limit.cleanup_old_records()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM rate_limit.tracking
    WHERE window_start < now() - INTERVAL '7 days';
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    -- Also clean old violations
    DELETE FROM rate_limit.violations
    WHERE attempted_at < now() - INTERVAL '30 days';
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to enforce rate limits on authentication
CREATE OR REPLACE FUNCTION rate_limit.auth_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_ip_address TEXT;
    v_result RECORD;
BEGIN
    -- Get IP address from current setting
    BEGIN
        v_ip_address := current_setting('app.current_ip', true);
    EXCEPTION WHEN OTHERS THEN
        v_ip_address := 'unknown';
    END;
    
    IF TG_OP = 'INSERT' THEN
        -- Check signup rate limit
        SELECT * INTO v_result
        FROM rate_limit.check_and_increment('auth_signup', v_ip_address);
        
        IF NOT v_result.allowed THEN
            RAISE EXCEPTION 'Rate limit exceeded. Please try again later.'
                USING HINT = format('Blocked until: %s', v_result.blocked_until);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get rate limit status for current user/IP
CREATE OR REPLACE FUNCTION rate_limit.get_status(p_limit_name TEXT DEFAULT NULL)
RETURNS TABLE (
    limit_name TEXT,
    identifier TEXT,
    current_count INTEGER,
    limit_value INTEGER,
    remaining INTEGER,
    reset_at TIMESTAMP WITH TIME ZONE,
    is_blocked BOOLEAN,
    blocked_until TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    v_identifier TEXT;
BEGIN
    -- Use user_id if authenticated, otherwise use IP
    IF auth.uid() IS NOT NULL THEN
        v_identifier := auth.uid()::text;
    ELSE
        BEGIN
            v_identifier := current_setting('app.current_ip', true);
        EXCEPTION WHEN OTHERS THEN
            v_identifier := 'unknown';
        END;
    END IF;
    
    RETURN QUERY
    SELECT 
        rt.limit_name,
        rt.identifier,
        rt.request_count as current_count,
        rc.requests_per_window as limit_value,
        rc.requests_per_window - rt.request_count as remaining,
        rt.window_start + (rc.window_minutes || ' minutes')::interval as reset_at,
        rt.blocked_until IS NOT NULL AND rt.blocked_until > now() as is_blocked,
        rt.blocked_until
    FROM rate_limit.tracking rt
    JOIN rate_limit.config rc ON rt.limit_name = rc.limit_name
    WHERE rt.identifier = v_identifier
    AND rt.window_start = (
        SELECT MAX(window_start) 
        FROM rate_limit.tracking 
        WHERE limit_name = rt.limit_name AND identifier = v_identifier
    )
    AND (p_limit_name IS NULL OR rt.limit_name = p_limit_name)
    ORDER BY rt.limit_name;
END;
$$ LANGUAGE plpgsql STABLE;

-- Secure rate limit tables
ALTER TABLE rate_limit.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit.tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit.violations ENABLE ROW LEVEL SECURITY;

-- Only admins can manage config
CREATE POLICY "Only admins can manage rate limit config"
ON rate_limit.config FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Users can view their own tracking
CREATE POLICY "Users can view their rate limit status"
ON rate_limit.tracking FOR SELECT
USING (
    identifier = auth.uid()::text
    OR identifier = current_setting('app.current_ip', true)
);

-- Admins can view all tracking
CREATE POLICY "Admins can view all rate limit tracking"
ON rate_limit.tracking FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can view violations
CREATE POLICY "Only admins can view violations"
ON rate_limit.violations FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Comments
COMMENT ON TABLE rate_limit.config IS 'Rate limiting configuration for different endpoints';
COMMENT ON TABLE rate_limit.tracking IS 'Active rate limit tracking per identifier';
COMMENT ON FUNCTION rate_limit.check_and_increment IS 'Check rate limit and increment counter if allowed';
COMMENT ON FUNCTION rate_limit.check_only IS 'Check rate limit without incrementing (for pre-flight)';

-- Example usage in application code:
-- SELECT * FROM rate_limit.check_and_increment('api_general', auth.uid()::text);
-- SELECT * FROM rate_limit.check_and_increment('auth_login', '192.168.1.1');
