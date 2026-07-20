BEGIN;

CREATE OR REPLACE FUNCTION public.delete_my_health_program_data(p_enrollment_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted UUID;
BEGIN
  DELETE FROM public.health_program_enrollments
  WHERE id = p_enrollment_id AND user_id = auth.uid()
  RETURNING id INTO v_deleted;
  IF v_deleted IS NULL THEN RAISE EXCEPTION 'Enrollment not found'; END IF;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_health_program_data(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_health_program_data(UUID) TO authenticated;

COMMIT;
