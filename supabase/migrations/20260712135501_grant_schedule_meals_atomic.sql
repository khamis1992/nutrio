GRANT EXECUTE ON FUNCTION public.schedule_meals_atomic(UUID, JSONB, UUID)
  TO authenticated, service_role;
