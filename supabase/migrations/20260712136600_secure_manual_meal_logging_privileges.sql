DO $$
DECLARE
  v_function RECORD;
BEGIN
  EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.meal_history FROM anon, authenticated';
  EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.progress_logs FROM anon, authenticated';
  EXECUTE 'GRANT SELECT ON public.meal_history, public.progress_logs TO authenticated';
  EXECUTE 'GRANT ALL ON public.meal_history, public.progress_logs TO service_role';

  FOR v_function IN
    SELECT p.oid::REGPROCEDURE AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'subtract_meal_from_progress',
        'audit_meal_history_delete',
        'deduct_xp_for_meal_deletion'
      )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      v_function.signature
    );
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_function.signature);
  END LOOP;

  EXECUTE 'REVOKE ALL ON FUNCTION public.log_manual_meal_items(JSONB, DATE, UUID, TEXT) FROM PUBLIC, anon';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.log_manual_meal_items(JSONB, DATE, UUID, TEXT) TO authenticated, service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.delete_meal_entry_atomic(UUID, UUID, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, TIMESTAMPTZ, UUID, DATE, INTEGER) FROM PUBLIC, anon';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.delete_meal_entry_atomic(UUID, UUID, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, TIMESTAMPTZ, UUID, DATE, INTEGER) TO authenticated, service_role';
END;
$$;
