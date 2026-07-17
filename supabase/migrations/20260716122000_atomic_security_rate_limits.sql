-- Distributed, atomic rate limiting for Edge Functions. Deno KV remains the
-- first choice, while this database bucket is the consistent fallback.

BEGIN;

CREATE SCHEMA IF NOT EXISTS security;

CREATE TABLE IF NOT EXISTS security.rate_limit_buckets (
  identifier TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL CHECK (request_count >= 0),
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT security_rate_limit_identifier_length
    CHECK (char_length(identifier) BETWEEN 3 AND 250),
  CONSTRAINT security_rate_limit_window_order
    CHECK (window_end > window_start)
);

CREATE INDEX IF NOT EXISTS security_rate_limit_window_end_idx
  ON security.rate_limit_buckets (window_end);

ALTER TABLE security.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.rate_limit_buckets FORCE ROW LEVEL SECURITY;
REVOKE ALL ON security.rate_limit_buckets FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.consume_security_rate_limit(
  p_identifier TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO security, public, pg_temp
AS $function$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_count INTEGER;
  v_window_end TIMESTAMPTZ;
  v_allowed BOOLEAN;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  IF char_length(trim(COALESCE(p_identifier, ''))) NOT BETWEEN 3 AND 250 THEN
    RAISE EXCEPTION 'Invalid rate limit identifier';
  END IF;

  IF p_limit NOT BETWEEN 1 AND 100000 OR p_window_seconds NOT BETWEEN 1 AND 86400 THEN
    RAISE EXCEPTION 'Invalid rate limit configuration';
  END IF;

  -- Serialize only callers sharing this exact bucket.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_identifier, 718204));

  SELECT request_count, window_end
  INTO v_count, v_window_end
  FROM security.rate_limit_buckets
  WHERE identifier = p_identifier
  FOR UPDATE;

  IF NOT FOUND OR v_window_end <= v_now THEN
    v_count := 1;
    v_window_end := v_now + make_interval(secs => p_window_seconds);
    v_allowed := true;

    INSERT INTO security.rate_limit_buckets (
      identifier, request_count, window_start, window_end, updated_at
    ) VALUES (
      p_identifier, v_count, v_now, v_window_end, v_now
    )
    ON CONFLICT (identifier) DO UPDATE SET
      request_count = EXCLUDED.request_count,
      window_start = EXCLUDED.window_start,
      window_end = EXCLUDED.window_end,
      updated_at = EXCLUDED.updated_at;
  ELSIF v_count >= p_limit THEN
    v_allowed := false;
  ELSE
    v_count := v_count + 1;
    v_allowed := true;

    UPDATE security.rate_limit_buckets
    SET request_count = v_count,
        updated_at = v_now
    WHERE identifier = p_identifier;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'remaining', GREATEST(p_limit - v_count, 0),
    'reset_at', floor(extract(epoch FROM v_window_end) * 1000)::BIGINT
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_security_rate_limit(TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_security_rate_limit(TEXT, INTEGER, INTEGER)
  TO service_role;

COMMENT ON FUNCTION public.consume_security_rate_limit(TEXT, INTEGER, INTEGER) IS
  'Service-role-only atomic rate limiter used by trusted Edge Functions.';

COMMIT;
