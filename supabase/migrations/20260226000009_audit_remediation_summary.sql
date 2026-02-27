-- SECURITY AUDIT REMEDIATION SUMMARY
-- Migration: 20260226000009_audit_remediation_summary
-- Author: Security Audit Remediation
-- Description: Summary and verification of all security fixes applied

-- This migration documents all security fixes applied as part of the audit remediation

DO $$
BEGIN
    RAISE NOTICE '=================================================';
    RAISE NOTICE '  SECURITY AUDIT REMEDIATION SUMMARY';
    RAISE NOTICE '=================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'CRITICAL FIXES (R1, R3):';
    RAISE NOTICE '  - R1: Banking data encryption implemented via pgcrypto';
    RAISE NOTICE '    * Tables: security.encryption_config, encrypted columns in restaurant_details';
    RAISE NOTICE '    * Functions: security.encrypt_sensitive_data(), security.decrypt_sensitive_data()';
    RAISE NOTICE '    * View: restaurant_details_secure (access-controlled decryption)';
    RAISE NOTICE '';
    RAISE NOTICE '  - R3: API secrets hashing with bcrypt';
    RAISE NOTICE '    * Columns: api_secret_hash, api_secret_salt in partners table';
    RAISE NOTICE '    * Functions: security.hash_api_secret(), security.verify_api_secret()';
    RAISE NOTICE '    * Auto-rotation: 90-day rotation cycle implemented';
    RAISE NOTICE '';
    RAISE NOTICE 'HIGH PRIORITY FIXES (R2, R4):';
    RAISE NOTICE '  - R2: Comprehensive audit logging system';
    RAISE NOTICE '    * Schema: audit';
    RAISE NOTICE '    * Table: audit.log with triggers on critical tables';
    RAISE NOTICE '    * Functions: audit.capture_change(), audit.enable_auditing()';
    RAISE NOTICE '    * Tables audited: restaurants, orders, partner_payouts, etc.';
    RAISE NOTICE '';
    RAISE NOTICE '  - R4: Security monitoring foundations';
    RAISE NOTICE '    * Table: security.failed_auth_attempts';
    RAISE NOTICE '    * Functions: security.log_failed_auth(), security.should_block_ip()';
    RAISE NOTICE '';
    RAISE NOTICE 'MEDIUM PRIORITY FIXES (R5, R6, R7, R8, R9):';
    RAISE NOTICE '  - R6: Soft delete mechanism';
    RAISE NOTICE '    * Schema: soft_delete';
    RAISE NOTICE '    * Tables: soft_delete.trash, soft_delete.metadata';
    RAISE NOTICE '    * Applied to: restaurants, meals, staff_members, etc.';
    RAISE NOTICE '';
    RAISE NOTICE '  - R7: Staff RLS policies';
    RAISE NOTICE '    * Functions: is_restaurant_staff(), has_staff_permission()';
    RAISE NOTICE '    * Updated policies on: restaurants, meals, orders, staff tables';
    RAISE NOTICE '';
    RAISE NOTICE '  - R8: Rate limiting enforcement';
    RAISE NOTICE '    * Schema: rate_limit';
    RAISE NOTICE '    * Tables: rate_limit.config, rate_limit.tracking, rate_limit.violations';
    RAISE NOTICE '    * Functions: rate_limit.check_and_increment(), rate_limit.block_identifier()';
    RAISE NOTICE '';
    RAISE NOTICE '  - R9: Data retention policies';
    RAISE NOTICE '    * Schema: data_retention';
    RAISE NOTICE '    * Table: data_retention.policies';
    RAISE NOTICE '    * Function: data_retention.purge_old_data()';
    RAISE NOTICE '';
    RAISE NOTICE 'LOW PRIORITY FIXES (R10):';
    RAISE NOTICE '  - R10: Performance indexes';
    RAISE NOTICE '    * Composite indexes on: restaurants, orders, partner_earnings, etc.';
    RAISE NOTICE '    * Partial indexes for: pending orders, active subscriptions, etc.';
    RAISE NOTICE '';
    RAISE NOTICE 'ADDITIONAL FIXES:';
    RAISE NOTICE '  - Enabled RLS on user_nutrition_log (was disabled - CRITICAL)';
    RAISE NOTICE '  - Added user_id column to staff_members for authentication';
    RAISE NOTICE '  - Updated all policies to respect deleted_at (soft delete)';
    RAISE NOTICE '';
    RAISE NOTICE '=================================================';
    RAISE NOTICE '  VERIFICATION CHECKLIST';
    RAISE NOTICE '=================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'To verify fixes, run these queries:';
    RAISE NOTICE '';
    RAISE NOTICE '1. Check encryption is enabled:';
    RAISE NOTICE '   SELECT * FROM pg_extension WHERE extname = ''pgcrypto'';';
    RAISE NOTICE '';
    RAISE NOTICE '2. Check audit triggers are active:';
    RAISE NOTICE '   SELECT tgname, tgrelid::regclass';
    RAISE NOTICE '   FROM pg_trigger';
    RAISE NOTICE '   WHERE tgname = ''audit_trigger'';';
    RAISE NOTICE '';
    RAISE NOTICE '3. Check RLS is enabled on all tables:';
    RAISE NOTICE '   SELECT tablename, rowsecurity';
    RAISE NOTICE '   FROM pg_tables';
    RAISE NOTICE '   WHERE schemaname = ''public''';
    RAISE NOTICE '   AND rowsecurity = false;';
    RAISE NOTICE '';
    RAISE NOTICE '4. Check soft delete columns exist:';
    RAISE NOTICE '   SELECT table_name, column_name';
    RAISE NOTICE '   FROM information_schema.columns';
    RAISE NOTICE '   WHERE column_name = ''deleted_at'';';
    RAISE NOTICE '';
    RAISE NOTICE '5. Check rate limiting config:';
    RAISE NOTICE '   SELECT * FROM rate_limit.config;';
    RAISE NOTICE '';
    RAISE NOTICE '=================================================';
END $$;

-- Create verification view
CREATE OR REPLACE VIEW security.audit_remediation_status AS
WITH checks AS (
    -- Check pgcrypto
    SELECT 'pgcrypto_enabled' as check_name,
           EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') as passed,
           'pgcrypto extension must be enabled' as description
    
    UNION ALL
    
    -- Check audit triggers
    SELECT 'audit_triggers_active',
           EXISTS(SELECT 1 FROM pg_trigger WHERE tgname = 'audit_trigger'),
           'Audit triggers must be active on critical tables'
    
    UNION ALL
    
    -- Check banking encryption columns
    SELECT 'banking_encryption_columns',
           EXISTS(SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'restaurant_details' 
                  AND column_name = 'bank_account_number_encrypted'),
           'Banking data encryption columns must exist'
    
    UNION ALL
    
    -- Check API secret hashing
    SELECT 'api_secret_hash_column',
           EXISTS(SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'partners' 
                  AND column_name = 'api_secret_hash'),
           'API secret hash column must exist'
    
    UNION ALL
    
    -- Check soft delete columns
    SELECT 'soft_delete_columns',
           EXISTS(SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'restaurants' 
                  AND column_name = 'deleted_at'),
           'Soft delete columns must exist'
    
    UNION ALL
    
    -- Check staff user_id column
    SELECT 'staff_user_id_column',
           EXISTS(SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'staff_members' 
                  AND column_name = 'user_id'),
           'Staff user_id column must exist for RLS'
    
    UNION ALL
    
    -- Check rate limiting tables
    SELECT 'rate_limiting_configured',
           EXISTS(SELECT 1 FROM rate_limit.config),
           'Rate limiting configuration must exist'
    
    UNION ALL
    
    -- Check RLS on user_nutrition_log
    SELECT 'user_nutrition_log_rls',
           EXISTS(SELECT 1 FROM pg_tables 
                  WHERE tablename = 'user_nutrition_log' 
                  AND rowsecurity = true),
           'RLS must be enabled on user_nutrition_log'
    
    UNION ALL
    
    -- Check data retention policies
    SELECT 'data_retention_configured',
           EXISTS(SELECT 1 FROM data_retention.policies),
           'Data retention policies must be configured'
)
SELECT 
    check_name,
    passed,
    CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END as status,
    description
FROM checks
ORDER BY check_name;

-- Grant access to verification view
GRANT SELECT ON security.audit_remediation_status TO authenticated;

COMMENT ON VIEW security.audit_remediation_status IS 'View to verify all security audit remediation fixes are in place';

-- Usage:
-- SELECT * FROM security.audit_remediation_status;
-- All checks should return passed = true
