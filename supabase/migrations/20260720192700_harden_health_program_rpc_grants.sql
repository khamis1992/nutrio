-- Supabase projects may grant new public-schema functions to anon through
-- role-specific default privileges. Health-program RPCs always require a user.

REVOKE EXECUTE ON FUNCTION public.enroll_in_health_program(TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_health_program_status(UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.submit_health_program_checkin(UUID, SMALLINT, SMALLINT, SMALLINT, SMALLINT, SMALLINT, SMALLINT, SMALLINT, SMALLINT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) FROM anon;
REVOKE EXECUTE ON FUNCTION public.acknowledge_health_program_safety_event(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.review_health_program_gate(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.publish_health_program_version(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_my_health_program_data(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_health_program_onboarding(UUID) FROM anon;

GRANT EXECUTE ON FUNCTION public.enroll_in_health_program(TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_health_program_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_health_program_checkin(UUID, SMALLINT, SMALLINT, SMALLINT, SMALLINT, SMALLINT, SMALLINT, SMALLINT, SMALLINT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.acknowledge_health_program_safety_event(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_health_program_gate(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_health_program_version(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_health_program_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_health_program_onboarding(UUID) TO authenticated;
