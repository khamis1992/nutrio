-- Resolve phase-one security-advisor findings after the integrated schema is
-- deployed. Trigger functions remain callable by PostgreSQL triggers without
-- being exposed as REST RPCs.

begin;

alter view public.public_meal_catalog set (security_invoker = true);
alter view public.public_restaurant_catalog set (security_invoker = true);

alter function public.wearable_metric_source_precedence(text, text)
  set search_path = public, pg_temp;

revoke all on function public.wearable_metric_source_precedence(text, text)
  from public, anon;
grant execute on function public.wearable_metric_source_precedence(text, text)
  to authenticated, service_role;

revoke all on function public.refresh_my_wearable_sync_staleness(interval)
  from public, anon;
grant execute on function public.refresh_my_wearable_sync_staleness(interval)
  to authenticated, service_role;

revoke all on function public.get_user_micronutrient_adequacy(date, date)
  from public, anon;
grant execute on function public.get_user_micronutrient_adequacy(date, date)
  to authenticated, service_role;

revoke all on function public.apply_meal_nutrition_quality()
  from public, anon, authenticated;
revoke all on function public.commit_order_item_nutrition_snapshots()
  from public, anon, authenticated;
revoke all on function public.enforce_committed_order_item_immutability()
  from public, anon, authenticated;
revoke all on function public.set_order_item_nutrition_snapshot()
  from public, anon, authenticated;
revoke all on function public.set_schedule_nutrition_snapshot()
  from public, anon, authenticated;

grant execute on function public.apply_meal_nutrition_quality() to service_role;
grant execute on function public.commit_order_item_nutrition_snapshots() to service_role;
grant execute on function public.enforce_committed_order_item_immutability() to service_role;
grant execute on function public.set_order_item_nutrition_snapshot() to service_role;
grant execute on function public.set_schedule_nutrition_snapshot() to service_role;

commit;
