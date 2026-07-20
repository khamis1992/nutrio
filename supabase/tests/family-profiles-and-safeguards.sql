begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions, pg_temp;

select plan(18);

select has_table('public', 'family_members', 'family profiles are durable');
select has_table('public', 'family_member_consent_events', 'family consent history is durable');
select has_column('public', 'family_members', 'allergies', 'family profiles carry independent allergies');
select has_column('public', 'family_members', 'monthly_meal_allowance', 'family profiles carry an allowance');
select has_column('public', 'meal_schedules', 'family_member_id', 'schedules retain their beneficiary');

select has_function('public', 'list_my_family_profiles', array[]::text[], 'family listing uses a guarded RPC');
select has_function('public', 'create_my_family_profile', array['text','text','date','text','text[]','text[]','integer','integer','integer','integer','boolean'], 'family creation uses a guarded RPC');
select has_function('public', 'update_my_family_profile', array['uuid','text','text[]','text[]','integer','integer','integer','integer'], 'family updates use a guarded RPC');
select has_function('public', 'deactivate_my_family_profile', array['uuid'], 'family withdrawal uses a guarded RPC');
select has_function('public', 'schedule_family_meals_atomic', array['uuid','jsonb','uuid','uuid'], 'family scheduling is atomic');

select ok(not has_table_privilege('authenticated', 'public.family_members', 'INSERT'), 'customers cannot insert family rows directly');
select ok(not has_table_privilege('authenticated', 'public.family_members', 'UPDATE'), 'customers cannot update family rows directly');
select ok(not has_table_privilege('authenticated', 'public.family_members', 'DELETE'), 'customers cannot delete family rows directly');
select ok(not has_table_privilege('authenticated', 'public.family_member_consent_events', 'INSERT'), 'customers cannot forge consent history');

select ok(has_function_privilege('authenticated', 'public.create_my_family_profile(text,text,date,text,text[],text[],integer,integer,integer,integer,boolean)', 'EXECUTE'), 'authenticated customers can create guarded profiles');
select ok(has_function_privilege('authenticated', 'public.schedule_family_meals_atomic(uuid,jsonb,uuid,uuid)', 'EXECUTE'), 'authenticated customers can schedule for a beneficiary');
select ok(not has_function_privilege('anon', 'public.create_my_family_profile(text,text,date,text,text[],text[],integer,integer,integer,integer,boolean)', 'EXECUTE'), 'anonymous callers cannot create family profiles');
select ok(not has_function_privilege('anon', 'public.schedule_family_meals_atomic(uuid,jsonb,uuid,uuid)', 'EXECUTE'), 'anonymous callers cannot schedule for a beneficiary');

select * from finish();
rollback;
