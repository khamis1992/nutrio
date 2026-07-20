-- Close phase-one findings reported by the Supabase database linter.

ALTER VIEW public.partner_meal_nutrition_missing_queue
  SET (security_invoker = true, security_barrier = true);

ALTER FUNCTION public.wearable_provider_precedence(TEXT)
  SET search_path TO public, pg_temp;

COMMENT ON VIEW public.partner_meal_nutrition_missing_queue IS
  'Partner/admin nutrition-quality queue evaluated with the caller permissions and meal RLS policies.';

COMMENT ON FUNCTION public.wearable_provider_precedence(TEXT) IS
  'Returns the deterministic provider precedence with a fixed search path.';
