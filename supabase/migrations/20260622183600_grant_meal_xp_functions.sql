REVOKE ALL ON FUNCTION public.award_xp_for_meal_log(UUID, INTEGER, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_xp_for_meal_log(UUID, INTEGER, TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION
  public.complete_meal_atomic(UUID, UUID, DATE, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER),
  public.uncomplete_meal_atomic(UUID, UUID, DATE)
  TO authenticated;
