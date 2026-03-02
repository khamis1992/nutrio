-- CRITICAL SECURITY FIX: Hash API secrets and implement secure key management
-- Migration: 20260226000002_secure_api_credentials
-- Author: Security Audit Remediation
-- Description: Implements bcrypt hashing for API secrets and secure key rotation

-- Enable pgcrypto if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add new columns for hashed credentials
ALTER TABLE partners
ADD COLUMN IF NOT EXISTS api_secret_hash TEXT,
ADD COLUMN IF NOT EXISTS api_secret_salt TEXT,
ADD COLUMN IF NOT EXISTS api_key_prefix TEXT, -- First 8 chars of key for identification
ADD COLUMN IF NOT EXISTS last_rotated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rotation_due_at TIMESTAMP WITH TIME ZONE;

-- Create index for API key lookups
CREATE INDEX IF NOT EXISTS idx_partners_api_key_lookup 
ON partners(api_key) 
WHERE status = 'active';

-- Create function to hash API secrets using bcrypt
CREATE OR REPLACE FUNCTION security.hash_api_secret(plain_secret TEXT)
RETURNS TABLE(hash TEXT, salt TEXT) AS $$
DECLARE
    salt_val TEXT;
    hash_val TEXT;
BEGIN
    -- Generate random salt
    salt_val := encode(gen_random_bytes(16), 'hex');
    -- Hash with bcrypt (cost factor 10)
    hash_val := crypt(plain_secret, gen_salt('bf', 10));
    
    RETURN QUERY SELECT hash_val, salt_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to verify API secret
CREATE OR REPLACE FUNCTION security.verify_api_secret(plain_secret TEXT, stored_hash TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN stored_hash = crypt(plain_secret, stored_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to generate secure API credentials
CREATE OR REPLACE FUNCTION generate_partner_api_credentials(p_partner_id UUID)
RETURNS TABLE(api_key UUID, plain_secret TEXT) AS $$
DECLARE
    new_api_key UUID;
    new_secret TEXT;
    secret_hash TEXT;
    secret_salt TEXT;
BEGIN
    -- Generate new credentials
    new_api_key := gen_random_uuid();
    new_secret := encode(gen_random_bytes(32), 'hex');
    
    -- Hash the secret
    SELECT h.hash, h.salt INTO secret_hash, secret_salt
    FROM security.hash_api_secret(new_secret) h;
    
    -- Update partner record
    UPDATE partners
    SET 
        api_key = new_api_key,
        api_secret_hash = secret_hash,
        api_secret_salt = secret_salt,
        api_key_prefix = substring(new_api_key::text, 1, 8),
        last_rotated_at = now(),
        rotation_due_at = now() + INTERVAL '90 days',
        updated_at = now()
    WHERE id = p_partner_id;
    
    RETURN QUERY SELECT new_api_key, new_secret;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to authenticate partner API request
CREATE OR REPLACE FUNCTION authenticate_partner_api_request(
    p_api_key UUID,
    p_api_secret TEXT
)
RETURNS TABLE(
    partner_id UUID,
    name TEXT,
    permissions JSONB,
    rate_limit INTEGER,
    authenticated BOOLEAN
) AS $$
DECLARE
    v_partner RECORD;
    v_secret_hash TEXT;
BEGIN
    -- Look up partner by API key
    SELECT * INTO v_partner
    FROM partners
    WHERE api_key = p_api_key
    AND status = 'active';
    
    IF v_partner IS NULL THEN
        RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::JSONB, NULL::INTEGER, FALSE;
        RETURN;
    END IF;
    
    -- Verify secret
    IF NOT security.verify_api_secret(p_api_secret, v_partner.api_secret_hash) THEN
        -- Log failed authentication attempt
        INSERT INTO security.api_auth_failures (partner_id, attempted_at, ip_address)
        VALUES (v_partner.id, now(), inet_client_addr());
        
        RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::JSONB, NULL::INTEGER, FALSE;
        RETURN;
    END IF;
    
    -- Update last used timestamp
    UPDATE partners
    SET last_used_at = now()
    WHERE id = v_partner.id;
    
    RETURN QUERY SELECT 
        v_partner.id,
        v_partner.name,
        v_partner.permissions,
        v_partner.rate_limit,
        TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create table for API authentication failures (for monitoring)
CREATE TABLE IF NOT EXISTS security.api_auth_failures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID REFERENCES partners(id) ON DELETE CASCADE,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    ip_address INET
);

-- Create index for monitoring failed attempts
CREATE INDEX IF NOT EXISTS idx_api_auth_failures_partner 
ON security.api_auth_failures(partner_id, attempted_at DESC);

-- Create rate limiting table
CREATE TABLE IF NOT EXISTS security.api_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID REFERENCES partners(id) ON DELETE CASCADE,
    request_count INTEGER DEFAULT 0,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(partner_id, window_start)
);

-- Create function to check and increment rate limit
CREATE OR REPLACE FUNCTION security.check_rate_limit(
    p_partner_id UUID,
    p_rate_limit INTEGER,
    p_window_minutes INTEGER DEFAULT 60
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_count INTEGER;
    v_window_start TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Calculate window start
    v_window_start := date_trunc('hour', now()) 
        + INTERVAL '1 hour' * (EXTRACT(MINUTE FROM now())::int / p_window_minutes);
    
    -- Get or create rate limit record
    INSERT INTO security.api_rate_limits (partner_id, request_count, window_start)
    VALUES (p_partner_id, 1, v_window_start)
    ON CONFLICT (partner_id, window_start)
    DO UPDATE SET request_count = security.api_rate_limits.request_count + 1
    RETURNING request_count INTO v_current_count;
    
    -- Return true if under limit
    RETURN v_current_count <= p_rate_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to rotate API keys automatically
CREATE OR REPLACE FUNCTION auto_rotate_api_keys()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    v_partner RECORD;
    v_new_secret TEXT;
BEGIN
    -- Find partners with keys due for rotation
    FOR v_partner IN 
        SELECT id 
        FROM partners 
        WHERE rotation_due_at < now()
        AND status = 'active'
    LOOP
        -- Generate new credentials (secret only, keep same API key)
        v_new_secret := encode(gen_random_bytes(32), 'hex');
        
        UPDATE partners
        SET 
            api_secret_hash = (SELECT hash FROM security.hash_api_secret(v_new_secret)),
            api_secret_salt = (SELECT salt FROM security.hash_api_secret(v_new_secret)),
            last_rotated_at = now(),
            rotation_due_at = now() + INTERVAL '90 days',
            updated_at = now()
        WHERE id = v_partner.id;
        
        -- Log rotation event
        INSERT INTO security.api_key_rotation_log (partner_id, rotated_at, auto_rotated)
        VALUES (v_partner.id, now(), TRUE);
        
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create rotation log table
CREATE TABLE IF NOT EXISTS security.api_key_rotation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID REFERENCES partners(id) ON DELETE CASCADE,
    rotated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    auto_rotated BOOLEAN DEFAULT FALSE
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_partners_rotation_due 
ON partners(rotation_due_at) 
WHERE status = 'active';

-- Secure new tables
ALTER TABLE security.api_auth_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.api_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.api_key_rotation_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can view auth failures" ON security.api_auth_failures;
CREATE POLICY "Only admins can view auth failures"
ON security.api_auth_failures FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Only admins can view rate limits" ON security.api_rate_limits;
CREATE POLICY "Only admins can view rate limits"
ON security.api_rate_limits FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Only admins can view rotation log" ON security.api_key_rotation_log;
CREATE POLICY "Only admins can view rotation log"
ON security.api_key_rotation_log FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Mark old plaintext column for deprecation
COMMENT ON COLUMN partners.api_secret IS 'DEPRECATED: Use api_secret_hash with security.verify_api_secret()';

-- Migration helper: Migrate existing API secrets (if any exist in plaintext)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM partners 
        WHERE api_secret IS NOT NULL 
        AND api_secret_hash IS NULL
    ) THEN
        -- Log warning - existing plaintext secrets should be rotated immediately
        RAISE NOTICE 'WARNING: Existing plaintext API secrets found. They should be rotated immediately.';
    END IF;
END $$;

-- Note: After migration, use generate_partner_api_credentials() to create new credentials
-- Never store the plain_secret after returning it to the partner


