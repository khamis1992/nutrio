COMMENT ON FUNCTION public.schedule_meals_atomic(UUID, JSONB, UUID) IS
  'Atomically validates and schedules one or more customer meals, consumes quotas, and charges server-priced add-ons.';
