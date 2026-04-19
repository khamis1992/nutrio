-- Revoked tokens table for fleet-auth logout immediate invalidation
CREATE TABLE IF NOT EXISTS public.revoked_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token_jti TEXT NOT NULL,
  manager_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revoked_tokens_jti ON public.revoked_tokens (token_jti);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires ON public.revoked_tokens (expires_at);

-- Auto-cleanup: delete expired revoked tokens periodically
CREATE OR REPLACE FUNCTION public.cleanup_revoked_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM public.revoked_tokens WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;