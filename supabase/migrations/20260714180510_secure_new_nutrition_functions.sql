-- Reconciled with the applied remote migration version; executable SQL is unchanged.
-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Restrict
-- customer-facing RPCs to authenticated users and keep trigger helpers private.

REVOKE ALL ON FUNCTION public.log_manual_meal_items_v2(JSONB, DATE, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_manual_meal_items_v2(JSONB, DATE, UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.log_manual_meal_items_v2(JSONB, DATE, UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.reverse_deleted_meal_fiber() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reverse_deleted_meal_fiber() FROM anon;
REVOKE ALL ON FUNCTION public.reverse_deleted_meal_fiber() FROM authenticated;

REVOKE ALL ON FUNCTION public.search_nutrition_knowledge(TEXT, DATE, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_nutrition_knowledge(TEXT, DATE, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_nutrition_knowledge(TEXT, DATE, INTEGER) TO authenticated;
