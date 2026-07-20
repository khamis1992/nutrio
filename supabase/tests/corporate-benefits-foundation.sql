begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions, pg_temp;

select plan(20);

select has_table('public', 'corporate_organizations', 'corporate organizations are durable');
select has_table('public', 'corporate_memberships', 'employee eligibility is durable');
select has_table('public', 'corporate_benefit_events', 'benefit redemptions are auditable');
select has_table('public', 'corporate_sponsor_invoices', 'sponsor invoices are durable');
select has_column('public', 'corporate_benefit_events', 'allowance_period_start', 'redemptions retain their allowance period');
select has_column('public', 'corporate_memberships', 'sponsor_aggregate_consent', 'aggregate reporting consent is explicit');

select has_function('public', 'get_my_corporate_benefit', array[]::text[], 'employees use a guarded benefit projection');
select has_function('public', 'accept_my_corporate_benefit', array['uuid','boolean'], 'benefit consent uses a guarded RPC');
select has_function('public', 'schedule_corporate_meals_atomic', array['uuid','jsonb','uuid','uuid'], 'sponsored scheduling is atomic');
select has_function('public', 'get_corporate_sponsor_aggregate', array['uuid','date','date'], 'sponsors receive aggregate reporting only');
select has_function('public', 'admin_generate_corporate_invoice', array['uuid','date','date'], 'invoice generation is server-owned');

select ok(not has_table_privilege('authenticated', 'public.corporate_memberships', 'SELECT'), 'employees cannot query raw membership rows');
select ok(not has_table_privilege('authenticated', 'public.corporate_memberships', 'UPDATE'), 'employees cannot mutate eligibility directly');
select ok(not has_table_privilege('authenticated', 'public.corporate_benefit_events', 'INSERT'), 'employees cannot forge redemption events');
select ok(not has_table_privilege('authenticated', 'public.corporate_sponsor_invoices', 'SELECT'), 'sponsors cannot bypass the aggregate projection');

select ok(has_function_privilege('authenticated', 'public.get_my_corporate_benefit()', 'EXECUTE'), 'authenticated employees can read their own benefit projection');
select ok(has_function_privilege('authenticated', 'public.schedule_corporate_meals_atomic(uuid,jsonb,uuid,uuid)', 'EXECUTE'), 'authenticated employees can call sponsored scheduling');
select ok(has_function_privilege('authenticated', 'public.get_corporate_sponsor_aggregate(uuid,date,date)', 'EXECUTE'), 'authorized callers can invoke the guarded aggregate RPC');
select ok(not has_function_privilege('anon', 'public.schedule_corporate_meals_atomic(uuid,jsonb,uuid,uuid)', 'EXECUTE'), 'anonymous callers cannot redeem benefits');
select ok(not has_function_privilege('anon', 'public.get_corporate_sponsor_aggregate(uuid,date,date)', 'EXECUTE'), 'anonymous callers cannot read sponsor aggregates');

select * from finish();
rollback;
