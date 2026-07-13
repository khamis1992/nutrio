-- Authentication audit data must come from the request-aware Edge Function.
-- The legacy auth trigger could only write placeholders and polluted security
-- reports with values that were not client IP addresses.
DROP TRIGGER IF EXISTS on_auth_user_signin ON auth.users;
DROP FUNCTION IF EXISTS public.log_user_ip();

DELETE FROM public.user_ip_logs
WHERE ip_address = '0.0.0.0'::INET;

DELETE FROM public.user_ip_logs
WHERE ip_address <<= '192.168.1.0/24'::CIDR
  AND action = 'login'
  AND user_agent IS NULL
  AND country_code IS NULL
  AND country_name IS NULL
  AND city IS NULL;
