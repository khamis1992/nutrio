-- Migration: Webhook Retry System
-- Purpose: Ensure reliable webhook delivery with exponential backoff

-- Create webhook delivery queue
CREATE TABLE IF NOT EXISTS public.webhook_delivery_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_url TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    headers JSONB DEFAULT '{}',
    
    -- Retry tracking
    attempt_count INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    last_http_status INTEGER,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'failed', 'delivered')),
    
    -- Timestamps
    first_attempt_at TIMESTAMP WITH TIME ZONE,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_webhook_queue_status_retry 
ON public.webhook_delivery_queue(status, next_retry_at) 
WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_webhook_queue_created 
ON public.webhook_delivery_queue(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_queue_event 
ON public.webhook_delivery_queue(event_type, status);

-- Enable RLS
ALTER TABLE public.webhook_delivery_queue ENABLE ROW LEVEL SECURITY;

-- Only system can access (via Edge Functions with service role)
DROP POLICY IF EXISTS "System access only" ON public.webhook_delivery_queue;
CREATE POLICY "System access only"
ON public.webhook_delivery_queue FOR ALL
USING (false);

-- Function to calculate next retry with exponential backoff
CREATE OR REPLACE FUNCTION calculate_next_retry(attempt_count INTEGER)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
    base_delay INTEGER := 60; -- 1 minute base
    max_delay INTEGER := 14400; -- 4 hours max
    delay INTEGER;
BEGIN
    -- Exponential backoff: 1min, 5min, 15min, 1hr, 4hr
    delay := LEAST(
        base_delay * POWER(3, attempt_count - 1),
        max_delay
    );
    
    -- Add jitter (±10%) to prevent thundering herd
    delay := delay + (random() * delay * 0.2 - delay * 0.1)::INTEGER;
    
    RETURN NOW() + (delay || ' seconds')::INTERVAL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to schedule webhook
CREATE OR REPLACE FUNCTION schedule_webhook(
    p_webhook_url TEXT,
    p_event_type TEXT,
    p_payload JSONB,
    p_headers JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.webhook_delivery_queue (
        webhook_url,
        event_type,
        payload,
        headers,
        next_retry_at
    ) VALUES (
        p_webhook_url,
        p_event_type,
        p_payload,
        p_headers,
        NOW() -- First attempt immediately
    )
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark webhook delivered
CREATE OR REPLACE FUNCTION mark_webhook_delivered(p_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.webhook_delivery_queue
    SET 
        status = 'delivered',
        delivered_at = NOW(),
        last_attempt_at = NOW()
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark webhook failed and schedule retry
CREATE OR REPLACE FUNCTION mark_webhook_failed(
    p_id UUID,
    p_error TEXT,
    p_http_status INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_queue_record RECORD;
BEGIN
    SELECT * INTO v_queue_record
    FROM public.webhook_delivery_queue
    WHERE id = p_id;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Check if max attempts reached
    IF v_queue_record.attempt_count >= v_queue_record.max_attempts THEN
        -- Move to dead letter queue (just mark as failed)
        UPDATE public.webhook_delivery_queue
        SET 
            status = 'failed',
            last_error = p_error,
            last_http_status = p_http_status,
            last_attempt_at = NOW()
        WHERE id = p_id;
        
        -- Log for manual review
        RAISE WARNING 'Webhook % failed after % attempts: %', 
            p_id, v_queue_record.attempt_count, p_error;
    ELSE
        -- Schedule retry
        UPDATE public.webhook_delivery_queue
        SET 
            status = 'pending',
            attempt_count = attempt_count + 1,
            last_error = p_error,
            last_http_status = p_http_status,
            last_attempt_at = NOW(),
            next_retry_at = calculate_next_retry(attempt_count + 1)
        WHERE id = p_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View for monitoring webhook queue
CREATE OR REPLACE VIEW webhook_queue_status AS
SELECT 
    status,
    event_type,
    COUNT(*) as count,
    MIN(created_at) as oldest,
    MAX(created_at) as newest
FROM public.webhook_delivery_queue
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status, event_type;

-- Add audit trigger
CREATE TRIGGER audit_webhook_queue
AFTER INSERT OR UPDATE OR DELETE ON public.webhook_delivery_queue
FOR EACH ROW EXECUTE FUNCTION audit.log_change();

COMMENT ON TABLE public.webhook_delivery_queue IS 'Queue for reliable webhook delivery with retry logic';
COMMENT ON calculate_next_retry IS 'Calculates next retry time with exponential backoff and jitter';


