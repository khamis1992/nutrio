\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role;
  END IF;
END;
$do$;

CREATE SCHEMA auth;
CREATE SCHEMA security;

CREATE TYPE public.app_role AS ENUM (
  'admin', 'staff', 'partner', 'restaurant', 'driver', 'coach'
);

CREATE TABLE auth.users (
  id UUID PRIMARY KEY,
  email TEXT
);

CREATE OR REPLACE FUNCTION auth.role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $function$
  SELECT NULLIF(current_setting('request.jwt.claim.role', true), '');
$function$;

CREATE TABLE public.user_roles (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  PRIMARY KEY (user_id, role)
);

CREATE TABLE public.fleet_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE security.test_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  actor_user_id UUID,
  resource_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE TABLE security.event_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  event_type TEXT NOT NULL
);

CREATE OR REPLACE FUNCTION public.admin_security_posture()
RETURNS JSONB
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT jsonb_build_object(
    'generated_at', clock_timestamp(),
    'release_version', 'test-base',
    'status', 'healthy',
    'failure_count', 0,
    'warning_count', 0,
    'checks', '[]'::JSONB
  );
$function$;

CREATE OR REPLACE FUNCTION security.record_event(
  p_event_type TEXT,
  p_category TEXT,
  p_severity TEXT DEFAULT 'info',
  p_source TEXT DEFAULT 'edge',
  p_outcome TEXT DEFAULT 'success',
  p_actor_user_id UUID DEFAULT NULL,
  p_actor_role TEXT DEFAULT NULL,
  p_actor_type TEXT DEFAULT 'user',
  p_action TEXT DEFAULT NULL,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id TEXT DEFAULT NULL,
  p_request_id TEXT DEFAULT NULL,
  p_correlation_id TEXT DEFAULT NULL,
  p_session_fingerprint TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_country_code TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB,
  p_occurred_at TIMESTAMPTZ DEFAULT clock_timestamp(),
  p_evidence_signature TEXT DEFAULT NULL,
  p_signature_key_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_event_id UUID;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  INSERT INTO security.test_events (
    event_type, actor_user_id, resource_id, metadata
  ) VALUES (
    p_event_type, p_actor_user_id, p_resource_id, COALESCE(p_metadata, '{}'::JSONB)
  )
  RETURNING id INTO v_event_id;

  INSERT INTO security.event_ledger (event_type)
  VALUES (p_event_type);

  RETURN v_event_id;
END;
$function$;
