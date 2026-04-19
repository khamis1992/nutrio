CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_identifier_window 
  ON public.rate_limits (identifier, window_start);

-- Auto-cleanup: delete expired entries
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM public.rate_limits WHERE window_end < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-vacuum for rate_limits table
ALTER TABLE public.rate_limits SET (autovacuum_vacuum_scale_factor = 0.1);