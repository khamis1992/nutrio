begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions, pg_temp;

select plan(20);

select has_column('public', 'meal_schedules', 'subscription_id', 'schedules retain the exact subscription allocation');
select has_column('public', 'meal_schedules', 'quota_month_start', 'schedules retain the monthly quota period');
select has_column('public', 'meal_schedules', 'quota_week_start', 'schedules retain the weekly quota period');
select has_column('public', 'meal_schedules', 'snack_quota_consumed', 'schedules record snack quota consumption');
select has_table('public', 'schedule_operation_events', 'schedule operations have a durable audit ledger');
select has_index('public', 'schedule_operation_events', 'schedule_operation_single_cancel_idx', 'cancellation is replay-safe per schedule');
select has_function('public', 'schedule_meals_atomic', array['uuid', 'jsonb', 'uuid'], 'atomic scheduling keeps its public contract');
select has_function('public', 'cancel_meal_schedule', array['uuid', 'text'], 'customer cancellation keeps its public contract');
select has_function('public', 'admin_cancel_meal_schedule', array['uuid', 'text'], 'admin cancellation keeps its public contract');
select has_function('public', 'update_my_scheduled_delivery', array['uuid', 'text', 'uuid', 'uuid'], 'delivery edits use a guarded RPC');

select ok(not has_table_privilege('authenticated', 'public.meal_schedules', 'INSERT'), 'customers cannot insert schedules directly');
select ok(not has_table_privilege('authenticated', 'public.meal_schedules', 'UPDATE'), 'customers cannot update schedules directly');
select ok(not has_table_privilege('authenticated', 'public.meal_schedules', 'DELETE'), 'customers cannot delete schedules directly');
select ok(has_table_privilege('authenticated', 'public.meal_schedules', 'SELECT'), 'customers retain RLS-scoped schedule reads');

select ok(has_function_privilege('authenticated', 'public.schedule_meals_atomic(uuid,jsonb,uuid)', 'EXECUTE'), 'customers can call atomic scheduling');
select ok(has_function_privilege('authenticated', 'public.cancel_meal_schedule(uuid,text)', 'EXECUTE'), 'customers can call guarded cancellation');
select ok(not has_function_privilege('anon', 'public.cancel_meal_schedule(uuid,text)', 'EXECUTE'), 'anonymous callers cannot cancel schedules');
select ok(not has_function_privilege('authenticated', 'public.cancel_meal_schedule_core(uuid,text,text)', 'EXECUTE'), 'the cancellation core is private');
select ok(not has_function_privilege('authenticated', 'public.schedule_meals_atomic_legacy_20260720(uuid,jsonb,uuid)', 'EXECUTE'), 'the legacy scheduling implementation is private');
select ok(not has_table_privilege('authenticated', 'public.schedule_operation_events', 'INSERT'), 'customers cannot forge schedule audit events');

select * from finish();
rollback;
