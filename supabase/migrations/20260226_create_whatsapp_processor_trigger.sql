-- Create a function to invoke the WhatsApp notification processor edge function
-- This can be called by a cron job or trigger

CREATE OR REPLACE FUNCTION trigger_whatsapp_notification_processor()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Note: This function serves as a marker/trigger
    -- The actual invocation should be done via pg_net or a scheduled job
    -- For now, we just log that processing is needed
    
    -- Check if there are pending notifications
    IF EXISTS (
        SELECT 1 FROM notification_queue 
        WHERE status = 'pending' 
        LIMIT 1
    ) THEN
        -- Log that processing is needed
        RAISE NOTICE 'Pending WhatsApp notifications found. Edge function should be invoked.';
    END IF;
END;
$$;

COMMENT ON trigger_whatsapp_notification_processor() IS 
'Marker function to indicate WhatsApp notifications need processing. 
In production, set up a cron job to call the process-whatsapp-notifications edge function every minute.';

-- Create a simple schedule table for cron-like functionality (if pg_cron is not available)
CREATE TABLE IF NOT EXISTS edge_function_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    function_name TEXT NOT NULL UNIQUE,
    last_run_at TIMESTAMPTZ,
    run_interval_minutes INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert the WhatsApp processor schedule
INSERT INTO edge_function_schedule (function_name, run_interval_minutes, is_active)
VALUES ('process-whatsapp-notifications', 1, true)
ON CONFLICT (function_name) DO NOTHING;

COMMENT ON TABLE edge_function_schedule IS 
'Simple scheduling table for edge functions. Used when pg_cron is not available.';
