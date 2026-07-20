-- Keep the privacy-safe verification projection behind its RPC contracts.
-- SECURITY INVOKER prevents the view owner from bypassing underlying RLS.

ALTER VIEW public.current_meal_nutrition_verifications
  SET (security_invoker = true, security_barrier = true);

REVOKE ALL ON public.current_meal_nutrition_verifications
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.current_meal_nutrition_verifications TO service_role;

COMMENT ON VIEW public.current_meal_nutrition_verifications IS
  'Private security-invoker projection used by scoped Nutrio Verified RPC contracts.';
