-- Migration: Add GDPR export logging table
-- Purpose: Track data exports for GDPR compliance and rate limiting

-- Create GDPR export logs table
CREATE TABLE IF NOT EXISTS public.gdpr_export_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exported_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_admin_export BOOLEAN DEFAULT false,
    data_size_bytes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Add indexes for rate limiting queries
CREATE INDEX IF NOT EXISTS idx_gdpr_export_logs_user_id_created 
ON public.gdpr_export_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gdpr_export_logs_created_at 
ON public.gdpr_export_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.gdpr_export_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own export logs
DROP POLICY IF EXISTS "Users can view own export logs" ON public.gdpr_export_logs;
CREATE POLICY "Users can view own export logs"
ON public.gdpr_export_logs FOR SELECT
USING (user_id = auth.uid());

-- Admins can view all export logs
DROP POLICY IF EXISTS "Admins can view all export logs" ON public.gdpr_export_logs;
CREATE POLICY "Admins can view all export logs"
ON public.gdpr_export_logs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- Only system can insert (via Edge Function with service role)
DROP POLICY IF EXISTS "System can insert export logs" ON public.gdpr_export_logs;
CREATE POLICY "System can insert export logs"
ON public.gdpr_export_logs FOR INSERT
WITH CHECK (false); -- Inserted via service role key only

-- Add audit trigger
CREATE TRIGGER audit_gdpr_export_logs
AFTER INSERT OR UPDATE OR DELETE ON public.gdpr_export_logs
FOR EACH ROW EXECUTE FUNCTION audit.log_change();

COMMENT ON TABLE public.gdpr_export_logs IS 'Logs all GDPR data exports for compliance and rate limiting';
COMMENT ON COLUMN public.gdpr_export_logs.user_id IS 'User whose data was exported';
COMMENT ON COLUMN public.gdpr_export_logs.exported_by IS 'User who initiated the export';
COMMENT ON COLUMN public.gdpr_export_logs.is_admin_export IS 'True if export was done by admin on behalf of user';


