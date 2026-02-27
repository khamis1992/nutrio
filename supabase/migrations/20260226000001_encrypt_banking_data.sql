-- CRITICAL SECURITY FIX: Encrypt banking data in restaurant_details table
-- Migration: 20260226000001_encrypt_banking_data
-- Author: Security Audit Remediation
-- Description: Implements column-level encryption for sensitive banking information

-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create schema for security functions
CREATE SCHEMA IF NOT EXISTS security;

-- Create master encryption key configuration table
-- NOTE: In production, the encryption key should be stored in a secure vault (AWS KMS, HashiCorp Vault, etc.)
-- This is a placeholder - replace with actual key management
CREATE TABLE IF NOT EXISTS security.encryption_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_name TEXT NOT NULL UNIQUE,
    key_value TEXT NOT NULL, -- In production, fetch from secure vault
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert placeholder - THIS SHOULD BE REPLACED WITH ACTUAL KEY FROM SECURE STORAGE
-- WARNING: In production, never store encryption keys in the database
INSERT INTO security.encryption_config (key_name, key_value)
VALUES ('banking_data_key', 'YOUR_SECURE_32_BYTE_KEY_HERE')
ON CONFLICT (key_name) DO NOTHING;

-- Create encryption function
CREATE OR REPLACE FUNCTION security.encrypt_sensitive_data(plain_text TEXT)
RETURNS BYTEA AS $$
DECLARE
    encryption_key TEXT;
BEGIN
    -- Fetch key from config (in production, fetch from vault)
    SELECT key_value INTO encryption_key 
    FROM security.encryption_config 
    WHERE key_name = 'banking_data_key';
    
    IF encryption_key IS NULL OR encryption_key = 'YOUR_SECURE_32_BYTE_KEY_HERE' THEN
        RAISE EXCEPTION 'Encryption key not configured properly';
    END IF;
    
    RETURN pgp_sym_encrypt(plain_text, encryption_key, 'cipher-algo=aes256');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create decryption function
CREATE OR REPLACE FUNCTION security.decrypt_sensitive_data(encrypted_data BYTEA)
RETURNS TEXT AS $$
DECLARE
    encryption_key TEXT;
BEGIN
    -- Fetch key from config (in production, fetch from vault)
    SELECT key_value INTO encryption_key 
    FROM security.encryption_config 
    WHERE key_name = 'banking_data_key';
    
    IF encryption_key IS NULL OR encryption_key = 'YOUR_SECURE_32_BYTE_KEY_HERE' THEN
        RAISE EXCEPTION 'Encryption key not configured properly';
    END IF;
    
    RETURN pgp_sym_decrypt(encrypted_data, encryption_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add encrypted columns to restaurant_details
ALTER TABLE restaurant_details 
ADD COLUMN IF NOT EXISTS bank_account_number_encrypted BYTEA,
ADD COLUMN IF NOT EXISTS bank_iban_encrypted BYTEA,
ADD COLUMN IF NOT EXISTS bank_swift_encrypted BYTEA,
ADD COLUMN IF NOT EXISTS bank_name_encrypted BYTEA;

-- Migrate existing data (encrypt current plaintext values)
DO $$
BEGIN
    -- Only migrate if there's data and encrypted columns are null
    IF EXISTS (
        SELECT 1 FROM restaurant_details 
        WHERE bank_account_number IS NOT NULL 
        AND bank_account_number_encrypted IS NULL
    ) THEN
        UPDATE restaurant_details
        SET 
            bank_account_number_encrypted = security.encrypt_sensitive_data(bank_account_number),
            bank_iban_encrypted = security.encrypt_sensitive_data(COALESCE(bank_iban, '')),
            bank_swift_encrypted = security.decrypt_sensitive_data(COALESCE(swift_code, '')),
            bank_name_encrypted = security.encrypt_sensitive_data(COALESCE(bank_name, ''))
        WHERE bank_account_number IS NOT NULL 
        AND bank_account_number_encrypted IS NULL;
    END IF;
END $$;

-- Create view for secure access to banking data
CREATE OR REPLACE VIEW restaurant_details_secure AS
SELECT 
    id,
    restaurant_id,
    cuisine_type,
    dietary_tags,
    alternate_phone,
    website_url,
    operating_hours,
    avg_prep_time_minutes,
    max_meals_per_day,
    -- Decrypt banking data for authorized users only
    CASE 
        WHEN auth.uid() IN (
            SELECT owner_id FROM restaurants WHERE id = restaurant_details.restaurant_id
        ) OR public.has_role(auth.uid(), 'admin')
        THEN security.decrypt_sensitive_data(bank_account_number_encrypted)
        ELSE NULL
    END as bank_account_number,
    CASE 
        WHEN auth.uid() IN (
            SELECT owner_id FROM restaurants WHERE id = restaurant_details.restaurant_id
        ) OR public.has_role(auth.uid(), 'admin')
        THEN security.decrypt_sensitive_data(bank_iban_encrypted)
        ELSE NULL
    END as bank_iban,
    CASE 
        WHEN auth.uid() IN (
            SELECT owner_id FROM restaurants WHERE id = restaurant_details.restaurant_id
        ) OR public.has_role(auth.uid(), 'admin')
        THEN security.decrypt_sensitive_data(bank_swift_encrypted)
        ELSE NULL
    END as swift_code,
    CASE 
        WHEN auth.uid() IN (
            SELECT owner_id FROM restaurants WHERE id = restaurant_details.restaurant_id
        ) OR public.has_role(auth.uid(), 'admin')
        THEN security.decrypt_sensitive_data(bank_name_encrypted)
        ELSE NULL
    END as bank_name,
    onboarding_step,
    onboarding_completed,
    terms_accepted,
    terms_accepted_at,
    created_at,
    updated_at
FROM restaurant_details;

-- Create function to update encrypted banking data
CREATE OR REPLACE FUNCTION update_restaurant_banking_info(
    p_restaurant_id UUID,
    p_bank_name TEXT,
    p_bank_account_number TEXT,
    p_bank_iban TEXT,
    p_swift_code TEXT
)
RETURNS VOID AS $$
BEGIN
    -- Verify user has permission
    IF NOT EXISTS (
        SELECT 1 FROM restaurants 
        WHERE id = p_restaurant_id 
        AND (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    ) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;
    
    UPDATE restaurant_details
    SET 
        bank_name_encrypted = security.encrypt_sensitive_data(p_bank_name),
        bank_account_number_encrypted = security.encrypt_sensitive_data(p_bank_account_number),
        bank_iban_encrypted = security.encrypt_sensitive_data(p_bank_iban),
        bank_swift_encrypted = security.encrypt_sensitive_data(p_swift_code),
        updated_at = now()
    WHERE restaurant_id = p_restaurant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Secure the encryption functions - only allow specific roles
REVOKE ALL ON FUNCTION security.encrypt_sensitive_data(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION security.decrypt_sensitive_data(BYTEA) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION security.encrypt_sensitive_data(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION security.decrypt_sensitive_data(BYTEA) TO authenticated;

-- Disable RLS on security schema tables for admin-only access
ALTER TABLE security.encryption_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can access encryption config"
ON security.encryption_config
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Mark plaintext columns for deprecation
COMMENT ON COLUMN restaurant_details.bank_account_number IS 'DEPRECATED: Use bank_account_number_encrypted via secure view';
COMMENT ON COLUMN restaurant_details.bank_iban IS 'DEPRECATED: Use bank_iban_encrypted via secure view';
COMMENT ON COLUMN restaurant_details.swift_code IS 'DEPRECATED: Use bank_swift_encrypted via secure view';
COMMENT ON COLUMN restaurant_details.bank_name IS 'DEPRECATED: Use bank_name_encrypted via secure view';

-- Note: After thorough testing, remove plaintext columns with:
-- ALTER TABLE restaurant_details DROP COLUMN bank_account_number;
-- ALTER TABLE restaurant_details DROP COLUMN bank_iban;
-- ALTER TABLE restaurant_details DROP COLUMN swift_code;
-- ALTER TABLE restaurant_details DROP COLUMN bank_name;
