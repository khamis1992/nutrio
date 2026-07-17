-- Admin-safe reader for IP activity.
-- The admin users page should not depend on direct table SELECT behavior,
-- because user_ip_logs is intentionally protected by RLS.

CREATE OR REPLACE FUNCTION public.admin_list_user_ip_logs()
RETURNS TABLE (
  user_id UUID,
  ip_address TEXT,
  country_code TEXT,
  country_name TEXT,
  city TEXT,
  action TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    logs.user_id,
    logs.ip_address::TEXT AS ip_address,
    logs.country_code,
    logs.country_name,
    logs.city,
    logs.action,
    logs.created_at
  FROM public.user_ip_logs AS logs
  ORDER BY logs.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_user_ip_logs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_user_ip_logs() TO authenticated;
