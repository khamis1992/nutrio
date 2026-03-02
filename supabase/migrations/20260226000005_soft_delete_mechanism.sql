-- MEDIUM PRIORITY: Implement soft delete mechanism for critical tables
-- Migration: 20260226000005_soft_delete_mechanism
-- Author: Security Audit Remediation
-- Description: Adds soft delete capability with recovery support

-- Create schema for soft delete utilities
CREATE SCHEMA IF NOT EXISTS soft_delete;

-- Create soft delete metadata table
CREATE TABLE IF NOT EXISTS soft_delete.metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL UNIQUE,
    soft_delete_enabled BOOLEAN DEFAULT true,
    retention_days INTEGER DEFAULT 90,
    permanently_delete_after_days INTEGER DEFAULT 365,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create soft delete trash/recycle bin table
CREATE TABLE IF NOT EXISTS soft_delete.trash (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_id UUID NOT NULL,
    table_schema TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_data JSONB NOT NULL,
    deleted_by UUID REFERENCES auth.users(id),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    permanently_delete_at TIMESTAMP WITH TIME ZONE,
    restored_at TIMESTAMP WITH TIME ZONE,
    restored_by UUID REFERENCES auth.users(id),
    UNIQUE(original_id, table_name)
);

-- Create indexes for trash queries
CREATE INDEX IF NOT EXISTS idx_trash_table 
ON soft_delete.trash(table_schema, table_name, deleted_at DESC)
WHERE restored_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_trash_deleted_by 
ON soft_delete.trash(deleted_by, deleted_at DESC);

CREATE INDEX IF NOT EXISTS idx_trash_permanent_delete 
ON soft_delete.trash(permanently_delete_at)
WHERE permanently_delete_at IS NOT NULL AND restored_at IS NULL;

-- Function to enable soft delete on a table
CREATE OR REPLACE FUNCTION soft_delete.enable_for_table(
    p_table_name TEXT,
    p_schema TEXT DEFAULT 'public',
    p_retention_days INTEGER DEFAULT 90
)
RETURNS VOID AS $$
BEGIN
    -- Add deleted_at column to the table
    EXECUTE format('
        ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
        CREATE INDEX IF NOT EXISTS idx_%I_deleted_at ON %I.%I(deleted_at) WHERE deleted_at IS NULL;
    ', p_schema, p_table_name, p_table_name, p_schema, p_table_name);
    
    -- Register in metadata
    INSERT INTO soft_delete.metadata (table_name, retention_days)
    VALUES (p_table_name, p_retention_days)
    ON CONFLICT (table_name) DO UPDATE SET retention_days = p_retention_days;
    
    RAISE NOTICE 'Soft delete enabled for %.%', p_schema, p_table_name;
END;
$$ LANGUAGE plpgsql;

-- Function to perform soft delete
CREATE OR REPLACE FUNCTION soft_delete.record(
    p_table_name TEXT,
    p_record_id UUID,
    p_schema TEXT DEFAULT 'public'
)
RETURNS BOOLEAN AS $$
DECLARE
    v_record_data JSONB;
    v_retention_days INTEGER;
BEGIN
    -- Get retention period
    SELECT retention_days INTO v_retention_days
    FROM soft_delete.metadata
    WHERE table_name = p_table_name;
    
    IF v_retention_days IS NULL THEN
        v_retention_days := 90; -- default
    END IF;
    
    -- Get record data before deletion
    EXECUTE format('
        SELECT to_jsonb(t) FROM %I.%I t WHERE id = $1
    ', p_schema, p_table_name)
    INTO v_record_data
    USING p_record_id;
    
    IF v_record_data IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Move to trash
    INSERT INTO soft_delete.trash (
        original_id,
        table_schema,
        table_name,
        record_data,
        deleted_by,
        permanently_delete_at
    ) VALUES (
        p_record_id,
        p_schema,
        p_table_name,
        v_record_data,
        auth.uid(),
        now() + (v_retention_days || ' days')::interval
    )
    ON CONFLICT (original_id, table_name) DO UPDATE SET
        record_data = v_record_data,
        deleted_by = auth.uid(),
        deleted_at = now(),
        permanently_delete_at = now() + (v_retention_days || ' days')::interval,
        restored_at = NULL,
        restored_by = NULL;
    
    -- Mark as deleted in original table
    EXECUTE format('
        UPDATE %I.%I SET deleted_at = now() WHERE id = $1
    ', p_schema, p_table_name)
    USING p_record_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to restore a soft-deleted record
CREATE OR REPLACE FUNCTION soft_delete.restore(
    p_trash_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_trash_record RECORD;
    v_columns TEXT;
    v_values TEXT;
BEGIN
    -- Get trash record
    SELECT * INTO v_trash_record
    FROM soft_delete.trash
    WHERE id = p_trash_id AND restored_at IS NULL;
    
    IF v_trash_record IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Restore the record (clear deleted_at)
    EXECUTE format('
        UPDATE %I.%I SET deleted_at = NULL WHERE id = $1
    ', v_trash_record.table_schema, v_trash_record.table_name)
    USING v_trash_record.original_id;
    
    -- Mark as restored in trash
    UPDATE soft_delete.trash
    SET restored_at = now(),
        restored_by = auth.uid()
    WHERE id = p_trash_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to permanently delete old records
CREATE OR REPLACE FUNCTION soft_delete.purge_old_records()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    v_record RECORD;
BEGIN
    -- Find records ready for permanent deletion
    FOR v_record IN 
        SELECT * FROM soft_delete.trash
        WHERE permanently_delete_at < now()
        AND restored_at IS NULL
    LOOP
        -- Actually delete from source table
        EXECUTE format('
            DELETE FROM %I.%I WHERE id = $1 AND deleted_at IS NOT NULL
        ', v_record.table_schema, v_record.table_name)
        USING v_record.original_id;
        
        -- Remove from trash
        DELETE FROM soft_delete.trash WHERE id = v_record.id;
        
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get deleted records for a table
CREATE OR REPLACE FUNCTION soft_delete.get_deleted_records(
    p_table_name TEXT,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    trash_id UUID,
    original_id UUID,
    record_data JSONB,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    days_until_permanent_deletion INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id as trash_id,
        t.original_id,
        t.record_data,
        t.deleted_at,
        t.deleted_by,
        EXTRACT(DAY FROM t.permanently_delete_at - now())::int as days_until_permanent_deletion
    FROM soft_delete.trash t
    WHERE t.table_name = p_table_name
    AND t.restored_at IS NULL
    ORDER BY t.deleted_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create trigger function for automatic soft delete
CREATE OR REPLACE FUNCTION soft_delete.trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    -- Instead of deleting, perform soft delete
    PERFORM soft_delete.record(TG_TABLE_NAME, OLD.id, TG_TABLE_SCHEMA);
    
    -- Prevent actual deletion
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to enable automatic soft delete trigger on a table
CREATE OR REPLACE FUNCTION soft_delete.enable_trigger(
    p_table_name TEXT,
    p_schema TEXT DEFAULT 'public'
)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('
        DROP TRIGGER IF EXISTS soft_delete_trigger ON %I.%I;
        CREATE TRIGGER soft_delete_trigger
            BEFORE DELETE ON %I.%I
            FOR EACH ROW EXECUTE FUNCTION soft_delete.trigger_function();
    ', p_schema, p_table_name, p_schema, p_table_name);
    
    RAISE NOTICE 'Soft delete trigger enabled for %.%', p_schema, p_table_name;
END;
$$ LANGUAGE plpgsql;

-- Enable soft delete on critical tables
SELECT soft_delete.enable_for_table('restaurants', 'public', 90);
SELECT soft_delete.enable_for_table('meals', 'public', 90);
SELECT soft_delete.enable_for_table('staff_members', 'public', 180);
SELECT soft_delete.enable_for_table('restaurant_addons', 'public', 90);

-- Enable automatic soft delete triggers
SELECT soft_delete.enable_trigger('restaurants');
SELECT soft_delete.enable_trigger('meals');
SELECT soft_delete.enable_trigger('staff_members');
SELECT soft_delete.enable_trigger('restaurant_addons');

-- Update RLS policies to exclude soft-deleted records

-- Helper function to add deleted_at filter to existing policies
CREATE OR REPLACE FUNCTION soft_delete.update_policies_for_table(
    p_table_name TEXT,
    p_schema TEXT DEFAULT 'public'
)
RETURNS VOID AS $$
BEGIN
    -- Note: This is a template - actual policy updates would need to be done manually
    -- or through a more sophisticated migration
    RAISE NOTICE 'Remember to update RLS policies for %.%, adding: AND deleted_at IS NULL', 
        p_schema, p_table_name;
END;
$$ LANGUAGE plpgsql;

-- Update existing restaurant policies to exclude soft-deleted
DROP POLICY IF EXISTS "Anyone can view approved restaurants" ON restaurants;
DROP POLICY IF EXISTS "Anyone can view approved restaurants" ON restaurants;
CREATE POLICY "Anyone can view approved restaurants"
ON restaurants FOR SELECT
USING (approval_status = 'approved' AND is_active = true AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Owners can view their restaurants" ON restaurants;
DROP POLICY IF EXISTS "Owners can view their restaurants" ON restaurants;
CREATE POLICY "Owners can view their restaurants"
ON restaurants FOR SELECT
USING (owner_id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Staff can view assigned restaurants" ON restaurants;
DROP POLICY IF EXISTS "Staff can view assigned restaurants" ON restaurants;
CREATE POLICY "Staff can view assigned restaurants"
ON restaurants FOR SELECT
USING (public.is_restaurant_staff(id) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Admins can view all restaurants" ON restaurants;
DROP POLICY IF EXISTS "Admins can view all restaurants" ON restaurants;
CREATE POLICY "Admins can view all restaurants"
ON restaurants FOR SELECT
USING (public.has_role(auth.uid(), 'admin') AND deleted_at IS NULL);

-- Secure soft_delete tables
ALTER TABLE soft_delete.metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE soft_delete.trash ENABLE ROW LEVEL SECURITY;

-- Only admins can manage soft delete configuration
DROP POLICY IF EXISTS "Only admins can manage soft delete config" ON soft_delete.metadata;
CREATE POLICY "Only admins can manage soft delete config"
ON soft_delete.metadata FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Admins and owners can view their deleted records
DROP POLICY IF EXISTS "View deleted records" ON soft_delete.trash;
CREATE POLICY "View deleted records"
ON soft_delete.trash FOR SELECT
USING (
    public.has_role(auth.uid(), 'admin')
    OR deleted_by = auth.uid()
    OR EXISTS (
        SELECT 1 FROM restaurants r
        JOIN staff_members sm ON sm.restaurant_id = r.id
        WHERE sm.user_id = auth.uid()
        AND soft_delete.trash.table_name = 'restaurants'
        AND soft_delete.trash.original_id = r.id
    )
);

-- Only admins can restore permanently
DROP POLICY IF EXISTS "Admins can restore deleted records" ON soft_delete.trash;
CREATE POLICY "Admins can restore deleted records"
ON soft_delete.trash FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Comments
COMMENT ON TABLE soft_delete.trash IS 'Recycle bin for soft-deleted records with automatic permanent deletion';
COMMENT ON soft_delete.record IS 'Soft delete a record by moving it to trash';
COMMENT ON soft_delete.restore IS 'Restore a soft-deleted record from trash';
COMMENT ON COLUMN restaurants.deleted_at IS 'Soft delete timestamp - NULL if active';


