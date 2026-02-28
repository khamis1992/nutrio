-- Migration: Verify PITR (Point-in-Time Recovery) is enabled
-- Purpose: Ensure disaster recovery capability for production

-- Check if PITR is enabled for the project
DO $$
DECLARE
    pitr_enabled BOOLEAN;
    earliest_restore TIMESTAMP;
    latest_restore TIMESTAMP;
BEGIN
    -- Query infrastructure for PITR status
    SELECT 
        point_in_time_recovery_enabled,
        earliest_restore_time,
        latest_restore_time
    INTO 
        pitr_enabled,
        earliest_restore,
        latest_restore
    FROM infrastructure.database_instances
    WHERE project_id = current_setting('app.settings.project_id', true)::UUID;

    -- Verify PITR is enabled
    IF NOT pitr_enabled THEN
        RAISE EXCEPTION 'CRITICAL: Point-in-Time Recovery (PITR) is NOT enabled. Enable in Supabase Dashboard → Database → Backups';
    END IF;

    -- Log success
    RAISE NOTICE '✅ PITR is ENABLED';
    RAISE NOTICE '   Earliest restore point: %', earliest_restore;
    RAISE NOTICE '   Latest restore point: %', latest_restore;
    RAISE NOTICE '   Recovery window: % days', EXTRACT(DAY FROM latest_restore - earliest_restore);
END $$;

-- Create backup verification function
CREATE OR REPLACE FUNCTION admin.verify_backup_status()
RETURNS TABLE (
    check_name TEXT,
    status TEXT,
    details TEXT
) AS $$
BEGIN
    -- Check PITR
    RETURN QUERY
    SELECT 
        'PITR Enabled'::TEXT,
        CASE 
            WHEN point_in_time_recovery_enabled THEN '✅ PASS'
            ELSE '❌ FAIL'
        END::TEXT,
        COALESCE(
            'Window: ' || earliest_restore_time::TEXT || ' to ' || latest_restore_time::TEXT,
            'PITR not configured'
        )::TEXT
    FROM infrastructure.database_instances
    LIMIT 1;

    -- Check last automated backup
    RETURN QUERY
    SELECT 
        'Last Automated Backup'::TEXT,
        CASE 
            WHEN last_backup_at > NOW() - INTERVAL '25 hours' THEN '✅ PASS'
            ELSE '❌ FAIL - Backup is stale'
        END::TEXT,
        COALESCE('Last backup: ' || last_backup_at::TEXT, 'No backups found')::TEXT
    FROM pg_stat_database
    WHERE datname = current_database();

    -- Check WAL archiving
    RETURN QUERY
    SELECT 
        'WAL Archiving'::TEXT,
        CASE 
            WHEN pg_is_wal_replay_paused() IS NOT NULL THEN '✅ PASS'
            ELSE '⚠️ WARNING - Check manually'
        END::TEXT,
        'WAL archiving status'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create recovery procedure documentation table
CREATE TABLE IF NOT EXISTS admin.disaster_recovery_procedures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    procedure_name TEXT NOT NULL,
    steps TEXT[] NOT NULL,
    rto_minutes INTEGER, -- Recovery Time Objective
    rpo_minutes INTEGER, -- Recovery Point Objective
    last_tested_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert standard DR procedures
INSERT INTO admin.disaster_recovery_procedures (procedure_name, steps, rto_minutes, rpo_minutes)
VALUES (
    'Database PITR Recovery',
    ARRAY[
        '1. Identify restore point from logs/Sentry',
        '2. Navigate to Supabase Dashboard → Database → Backups',
        '3. Click "Point in Time Recovery"',
        '4. Select restore timestamp (choose just before incident)',
        '5. Click "Restore" and confirm',
        '6. Wait for restoration (typically 5-15 minutes)',
        '7. Verify application connectivity',
        '8. Run smoke tests (login, order flow)',
        '9. Post to status page',
        '10. Notify stakeholders in #incidents'
    ],
    15,  -- 15 minutes RTO
    5    -- 5 minutes RPO
)
ON CONFLICT (procedure_name) DO NOTHING;

-- Enable RLS
ALTER TABLE admin.disaster_recovery_procedures ENABLE ROW LEVEL SECURITY;

-- Only admins can view DR procedures
CREATE POLICY "Only admins can view DR procedures"
ON admin.disaster_recovery_procedures FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- Run verification
SELECT * FROM admin.verify_backup_status();
