begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions, pg_temp;

select plan(28);

select has_table('public', 'care_professional_credentials', 'verified credentials are durable');
select has_table('public', 'care_plan_reviews', 'plan reviews are durable');
select has_table('public', 'care_escalations', 'care escalations are durable');
select has_table('public', 'care_team_events', 'care events are auditable');
select has_column('public', 'coach_client_assignments', 'consent_scopes', 'assignments carry explicit consent scopes');
select has_column('public', 'coach_client_assignments', 'assignment_type', 'assignments distinguish care roles');
select ok(not has_table_privilege('authenticated', 'public.coach_applications', 'INSERT'), 'applications cannot bypass the guarded RPC');
select ok(not has_table_privilege('authenticated', 'public.coach_client_assignments', 'UPDATE'), 'assignment state cannot be changed directly');
select ok(not has_table_privilege('authenticated', 'public.coach_notes', 'INSERT'), 'care notes cannot bypass the audit RPC');
select ok(not has_function_privilege('anon', 'public.request_care_professional(uuid,text,text[],uuid)', 'EXECUTE'), 'anonymous users cannot request care');
select ok(has_function_privilege('authenticated', 'public.request_care_professional(uuid,text,text[],uuid)', 'EXECUTE'), 'authenticated clients can call the guarded care request RPC');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', 'ca000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'care-client@local.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'ca000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'care-dietitian@local.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'ca000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'care-fitness@local.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'ca000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'care-other@local.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'ca000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'care-admin@local.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into public.profiles (user_id, full_name)
values
  ('ca000000-0000-4000-8000-000000000001', 'Care Client'),
  ('ca000000-0000-4000-8000-000000000002', 'Verified Dietitian'),
  ('ca000000-0000-4000-8000-000000000003', 'Verified Fitness Coach'),
  ('ca000000-0000-4000-8000-000000000004', 'Unrelated User'),
  ('ca000000-0000-4000-8000-000000000005', 'Care Admin')
on conflict (user_id) do update set full_name = excluded.full_name;

insert into public.user_roles (user_id, role)
values ('ca000000-0000-4000-8000-000000000005', 'admin'::public.app_role)
on conflict (user_id, role) do nothing;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ca000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
select lives_ok(
  $$select public.submit_care_professional_application(
    'dietitian', 'Licensed dietitian providing evidence-based nutrition support for Nutrio clients.',
    array['Sports Nutrition'], 'BSc Nutrition', 'Qatar Ministry of Public Health', 'RD-CARE-01', 'QA',
    current_date + 365, 'Nutrition guidance within documented goals and client consent.', array['en','ar'], null
  )$$,
  'a professional can submit a complete credential application'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ca000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
select lives_ok(
  $$select public.submit_care_professional_application(
    'fitness_coach', 'Certified fitness coach supporting safe resistance and activity planning for Nutrio clients.',
    array['Strength Training'], 'CPT', 'Recognized Fitness Registry', 'CPT-CARE-01', 'QA',
    current_date + 365, 'Fitness coaching limited to exercise planning and adherence support.', array['en'], null
  )$$,
  'a fitness professional can submit a complete credential application'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ca000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}', true);
select throws_ok(
  $$select public.admin_review_care_professional_application(
    (select id from public.coach_applications where user_id = 'ca000000-0000-4000-8000-000000000002'),
    'approved', 'Registered Dietitian', 'Provides nutrition guidance within documented client consent.',
    array['view_macros','view_weight','view_meal_adherence','send_guidance','schedule_sessions'], 'Evidence checked.', 60, 120
  )$$,
  '42501', 'ADMIN_AAL2_REQUIRED',
  'credential approval requires an AAL2 admin'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ca000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}', true);
select lives_ok(
  $$select public.admin_review_care_professional_application(
    (select id from public.coach_applications where user_id = 'ca000000-0000-4000-8000-000000000002'),
    'approved', 'Registered Dietitian', 'Provides nutrition guidance within documented client consent.',
    array['view_macros','view_weight','view_meal_adherence','send_guidance','schedule_sessions'], 'Evidence checked.', 60, 120
  )$$,
  'an AAL2 admin can verify a dietitian'
);
select lives_ok(
  $$select public.admin_review_care_professional_application(
    (select id from public.coach_applications where user_id = 'ca000000-0000-4000-8000-000000000003'),
    'approved', 'Certified Fitness Coach', 'Provides exercise planning and adherence support within consent.',
    array['view_weight','view_workouts','send_guidance','schedule_sessions'], 'Evidence checked.', 60, 120
  )$$,
  'an AAL2 admin can verify a fitness coach'
);
reset role;

select is((select count(*) from public.care_professional_credentials where verification_status = 'verified' and user_id in ('ca000000-0000-4000-8000-000000000002','ca000000-0000-4000-8000-000000000003')), 2::bigint, 'only reviewed professionals receive verified credentials');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ca000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
select lives_ok(
  $$select public.request_care_professional('ca000000-0000-4000-8000-000000000002', 'nutrition_guidance', array['macros','weight','meal_adherence','messages'], 'ca100000-0000-4000-8000-000000000001')$$,
  'a client can request a verified dietitian with explicit scopes'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ca000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
select lives_ok(
  $$select public.respond_care_assignment((select id from public.coach_client_assignments where client_id = 'ca000000-0000-4000-8000-000000000001' and assignment_type = 'nutrition_guidance'), 'accept')$$,
  'the requested dietitian can accept the assignment'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ca000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
select lives_ok(
  $$select public.request_care_professional('ca000000-0000-4000-8000-000000000003', 'fitness_coaching', array['weight','workouts','messages'], 'ca100000-0000-4000-8000-000000000002')$$,
  'a client can add a second professional in another care role'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ca000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
select lives_ok(
  $$select public.respond_care_assignment((select id from public.coach_client_assignments where client_id = 'ca000000-0000-4000-8000-000000000001' and assignment_type = 'fitness_coaching'), 'accept')$$,
  'the fitness coach can join the same client care team'
);
reset role;

select is((select count(*) from public.coach_client_assignments where client_id = 'ca000000-0000-4000-8000-000000000001' and status = 'active'), 2::bigint, 'one client can have a dietitian and fitness coach concurrently');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ca000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
select throws_ok(
  $$select public.request_care_professional('ca000000-0000-4000-8000-000000000002', 'nutrition_guidance', array['macros'], 'ca100000-0000-4000-8000-000000000003')$$,
  'P0001', 'ACTIVE_CARE_ASSIGNMENT_TYPE_EXISTS',
  'a client cannot create a duplicate active role'
);
reset role;

insert into public.body_measurements (user_id, log_date, weight_kg)
values ('ca000000-0000-4000-8000-000000000001', current_date, 82.4)
on conflict (user_id, log_date) do update set weight_kg = excluded.weight_kg;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ca000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
select is((select count(*) from public.body_measurements where user_id = 'ca000000-0000-4000-8000-000000000001'), 1::bigint, 'a verified professional can read a consented scope');
select lives_ok(
  $$select public.add_care_note(
    (select id from public.coach_client_assignments where client_id = 'ca000000-0000-4000-8000-000000000001' and assignment_type = 'nutrition_guidance'),
    'nutrition', 'Client is progressing toward the agreed protein target.'
  )$$,
  'the assigned professional can add an auditable note through the RPC'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ca000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}', true);
select is((select count(*) from public.body_measurements where user_id = 'ca000000-0000-4000-8000-000000000001'), 0::bigint, 'an unrelated user cannot read client measurements');
select is((select count(*) from public.coach_notes where client_id = 'ca000000-0000-4000-8000-000000000001'), 0::bigint, 'an unrelated user cannot read professional notes');
reset role;

select is((select count(*) from public.care_team_events where client_id = 'ca000000-0000-4000-8000-000000000001'), 5::bigint, 'assignment and note actions leave an audit trail');

select * from finish();
rollback;
